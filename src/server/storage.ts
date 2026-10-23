import { submissionFingerprint } from "./submission-identity";
import { canConfirmBatch, type SubmissionBatch } from "../shared/batches";
import {
  isSubmissionLocked,
  normalizeReceipt,
  receiptTimestamp,
  type SubmissionRecord,
  type SubmissionState,
} from "../shared/submissions";
import {
  validateActivityCatalog,
  type ActivityCatalog,
} from "../shared/activities";
import { DatabaseSync, backup } from "node:sqlite";
import {
  validateDay,
  validateDays,
  validatePeriod,
  type DraftDay,
} from "../shared/worklogs";

export class ConflictError extends Error {}

export function openDraftStore(filename: string) {
  const db = new DatabaseSync(filename);
  db.exec(`CREATE TABLE IF NOT EXISTS draft_days (
    date TEXT PRIMARY KEY, revision INTEGER NOT NULL, entries TEXT NOT NULL
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS activity_catalog (
    id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL, activities TEXT NOT NULL
  )`);

  function readActivities(): ActivityCatalog {
    const row = db
      .prepare("SELECT revision, activities FROM activity_catalog WHERE id = 1")
      .get() as { revision: number; activities: string } | undefined;
    return row
      ? validateActivityCatalog({
          revision: row.revision,
          activities: JSON.parse(row.activities),
        })
      : { revision: 0, activities: [] };
  }
  function saveActivities(input: unknown): ActivityCatalog {
    const catalog = validateActivityCatalog(input);
    db.exec("BEGIN IMMEDIATE");
    try {
      if (readActivities().revision !== catalog.revision)
        throw new ConflictError(
          "O catálogo foi alterado em outra aba. Suas edições continuam aqui; copie-as e recarregue o catálogo antes de salvar.",
        );
      const saved = { ...catalog, revision: catalog.revision + 1 };
      db.prepare(
        `INSERT INTO activity_catalog (id, revision, activities) VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET revision = excluded.revision, activities = excluded.activities`,
      ).run(saved.revision, JSON.stringify(saved.activities));
      db.exec("COMMIT");
      return saved;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  db.exec(`CREATE TABLE IF NOT EXISTS submission_records (
    id TEXT PRIMARY KEY, date TEXT NOT NULL, entry_id TEXT NOT NULL, state TEXT NOT NULL,
    fingerprint TEXT NOT NULL, details TEXT NOT NULL, UNIQUE(date, entry_id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS submission_fingerprint ON submission_records(fingerprint)
    WHERE state IN ('sending','confirmed','uncertain');`);
  const decodeSubmission = (row: any): SubmissionRecord | null =>
    row ? normalizeReceipt(JSON.parse(row.details)) : null;
  function submission(id: string): SubmissionRecord | null {
    return decodeSubmission(
      db.prepare("SELECT details FROM submission_records WHERE id = ?").get(id),
    );
  }
  function submissionForEntry(
    date: string,
    entryId: string,
  ): SubmissionRecord | null {
    return decodeSubmission(
      db
        .prepare(
          "SELECT details FROM submission_records WHERE date = ? AND entry_id = ?",
        )
        .get(date, entryId),
    );
  }
  function submissions(from: string, to: string): SubmissionRecord[] {
    validatePeriod(from, to);
    return db
      .prepare(
        "SELECT details FROM submission_records WHERE date BETWEEN ? AND ? ORDER BY date, entry_id",
      )
      .all(from, to)
      .map((row) => decodeSubmission(row)!);
  }
  function assertSnapshot(record: SubmissionRecord) {
    const day = read(record.snapshot.date),
      s = record.snapshot;
    const entry = day.entries.find((e) => e.id === s.entryId);
    if (
      day.revision !== s.dayRevision ||
      !entry ||
      Number(entry.issue.trim()) !== s.issueId ||
      entry.minutes !== s.minutes ||
      entry.comment !== s.comment ||
      entry.activity !== s.activityName ||
      readActivities().revision !== s.catalogRevision
    )
      throw new ConflictError(
        "O rascunho ou catálogo mudou após a revisão. Prepare uma nova revisão antes de enviar.",
      );
  }
  function writeSubmission(record: SubmissionRecord, fingerprint: string) {
    db.prepare(
      `INSERT INTO submission_records (id, date, entry_id, state, fingerprint, details) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(date,entry_id) DO UPDATE SET id=excluded.id,state=excluded.state,fingerprint=excluded.fingerprint,details=excluded.details`,
    ).run(
      record.id,
      record.snapshot.date,
      record.snapshot.entryId,
      record.state,
      fingerprint,
      JSON.stringify(record),
    );
  }
  function putReview(
    record: SubmissionRecord,
    fingerprint: string,
  ): SubmissionRecord {
    record = normalizeReceipt(record);
    if (record.state === "existing")
      record = {
        ...record,
        verification: "matched",
        lastCheckedAt: record.lastCheckedAt ?? record.updatedAt,
      };
    db.exec("BEGIN IMMEDIATE");
    try {
      assertSnapshot(record);
      const previous = submissionForEntry(
        record.snapshot.date,
        record.snapshot.entryId,
      );
      if (previous && isSubmissionLocked(previous.state))
        throw new ConflictError(
          "Esta linha já possui envio iniciado ou confirmado. Confira o resultado; não reenvie.",
        );
      writeSubmission(record, fingerprint);
      db.exec("COMMIT");
      return record;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  function beginSubmission(id: string): SubmissionRecord {
    db.exec("BEGIN IMMEDIATE");
    try {
      const record = submission(id);
      if (!record || record.state !== "prepared")
        throw new ConflictError(
          "Esta revisão já foi utilizada ou substituída. Confira o resultado antes de qualquer novo envio.",
        );
      if (Date.now() - Date.parse(record.preparedAt) > 15 * 60 * 1000)
        throw new ConflictError("A revisão expirou. Prepare uma nova revisão.");
      assertSnapshot(record);
      const next = {
        ...record,
        state: "sending" as const,
        updatedAt: new Date().toISOString(),
        message:
          "Envio iniciado. Não reenvie enquanto o resultado não for confirmado.",
      };
      try {
        db.prepare(
          "UPDATE submission_records SET state = ?, details = ? WHERE id = ?",
        ).run(next.state, JSON.stringify(next), id);
      } catch {
        throw new ConflictError(
          "Já há envio equivalente iniciado ou confirmado neste computador. Confira os resultados existentes.",
        );
      }
      db.exec("COMMIT");
      return next;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  function finishSubmission(
    id: string,
    result: {
      state: SubmissionState;
      remoteCreatedAt?: string | null;
      remoteId: number | null;
      message: string;
    },
  ): SubmissionRecord {
    const record = submission(id);
    if (!record)
      throw new ConflictError("O registro do envio não foi encontrado.");
    if (record.state === "confirmed" || record.state === "existing")
      return record;
    const now = new Date().toISOString();
    const next: SubmissionRecord = {
      ...record,
      ...result,
      updatedAt: now,
      confirmedAt:
        record.confirmedAt ?? (result.state === "confirmed" ? now : null),
      remoteCreatedAt:
        record.remoteCreatedAt ?? receiptTimestamp(result.remoteCreatedAt),
      lastCheckedAt: ["confirmed", "existing"].includes(result.state)
        ? now
        : record.lastCheckedAt,
      verification: ["confirmed", "existing"].includes(result.state)
        ? "matched"
        : record.verification,
      origin: result.state === "existing" ? "existing" : record.origin,
    };
    db.prepare(
      "UPDATE submission_records SET state = ?, details = ? WHERE id = ?",
    ).run(next.state, JSON.stringify(next), id);
    return next;
  }

  function recordVerification(
    id: string,
    check: {
      result: "matched" | "missing" | "different" | "unavailable";
      createdAt: string | null;
    },
  ): SubmissionRecord {
    const record = submission(id);
    if (!record || !["confirmed", "existing"].includes(record.state))
      throw new ConflictError(
        "Confira primeiro o resultado do envio iniciado.",
      );
    const now = new Date().toISOString();
    const messages = {
      matched:
        "Lançamento conferido no Redmine. Os campos correspondem; nenhum envio foi realizado.",
      missing:
        "O registro não foi encontrado ou está oculto para esta conta. A confirmação original foi preservada; o reenvio continua bloqueado.",
      different:
        "Os campos atuais no Redmine divergem do recibo original. Confira manualmente; o reenvio continua bloqueado.",
      unavailable:
        "Não foi possível concluir a conferência. A confirmação original foi preservada; o reenvio continua bloqueado.",
    };
    const next: SubmissionRecord = {
      ...record,
      verification: check.result,
      remoteCreatedAt:
        record.remoteCreatedAt ??
        (check.result === "matched" ? receiptTimestamp(check.createdAt) : null),
      lastCheckedAt: now,
      updatedAt: now,
      message: messages[check.result],
    };
    db.prepare("UPDATE submission_records SET details = ? WHERE id = ?").run(
      JSON.stringify(next),
      id,
    );
    return next;
  }

  db.exec(`CREATE TABLE IF NOT EXISTS submission_batches (
    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, details TEXT NOT NULL
  )`);
  function batch(id: string): SubmissionBatch | null {
    const row = db
      .prepare("SELECT details FROM submission_batches WHERE id = ?")
      .get(id);
    return row ? JSON.parse(row.details as string) : null;
  }
  function saveBatch(value: SubmissionBatch): SubmissionBatch {
    db.prepare(
      `INSERT INTO submission_batches (id, created_at, details) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET details=excluded.details`,
    ).run(value.id, value.createdAt, JSON.stringify(value));
    return value;
  }
  function batches(from: string, to: string): SubmissionBatch[] {
    validatePeriod(from, to);
    return db
      .prepare(
        "SELECT details FROM submission_batches ORDER BY created_at DESC",
      )
      .all()
      .map((row) => JSON.parse(row.details as string) as SubmissionBatch)
      .filter((value) => value.state !== "prepared")
      .filter((value) =>
        value.items.some(
          (item) => item.selection.date >= from && item.selection.date <= to,
        ),
      )
      .slice(0, 20);
  }
  function beginBatch(id: string): SubmissionBatch {
    db.exec("BEGIN IMMEDIATE");
    try {
      const value = batch(id);
      if (!value || !canConfirmBatch(value))
        throw new ConflictError(
          "Este lote não pode ser confirmado. Prepare uma nova revisão das linhas pendentes.",
        );
      if (Date.now() - Date.parse(value.createdAt) > 15 * 60 * 1000)
        throw new ConflictError(
          "A revisão do lote expirou. Prepare uma nova revisão.",
        );
      for (const item of value.items) {
        const current = submission(item.record!.id);
        if (!current || current.state !== item.record!.state)
          throw new ConflictError(
            "Uma revisão do lote mudou. Confira os resultados e prepare uma nova revisão.",
          );
        if (current.state === "prepared") assertSnapshot(current);
      }
      const next = saveBatch({
        ...value,
        state: "running",
        updatedAt: new Date().toISOString(),
        message: "Envio iniciado. Os resultados são gravados por linha.",
      });
      db.exec("COMMIT");
      return next;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  type DayRow = { date: string; revision: number; entries: string };
  const decode = (row: DayRow): DraftDay =>
    validateDay({ ...row, entries: JSON.parse(row.entries) });

  function read(date: string): DraftDay {
    const row = db
      .prepare("SELECT date, revision, entries FROM draft_days WHERE date = ?")
      .get(date) as DayRow | undefined;
    return row ? decode(row) : validateDay({ date, revision: 0, entries: [] });
  }

  function readRange(from: string, to: string): DraftDay[] {
    validatePeriod(from, to);
    return (
      db
        .prepare(
          "SELECT date, revision, entries FROM draft_days WHERE date BETWEEN ? AND ? ORDER BY date",
        )
        .all(from, to) as DayRow[]
    ).map(decode);
  }

  function writeDays(days: DraftDay[]): DraftDay[] {
    for (const day of days) {
      const locked = submissions(day.date, day.date).filter((record) =>
        isSubmissionLocked(record.state),
      );
      const stored = read(day.date);
      for (const record of locked) {
        const previous = stored.entries.find(
          (e) => e.id === record.snapshot.entryId,
        );
        const next = day.entries.find((e) => e.id === record.snapshot.entryId);
        if (!next || JSON.stringify(next) !== JSON.stringify(previous))
          throw new ConflictError(
            "Uma linha com envio iniciado, confirmado ou incerto não pode ser alterada ou removida. Confira o resultado no Redmine.",
          );
      }
      if (read(day.date).revision !== day.revision) {
        throw new ConflictError(
          `O dia ${day.date.split("-").reverse().join("/")} foi alterado em outra aba. Nenhum dia desta operação foi salvo. Suas edições continuam na tela; copie-as antes de recarregar.`,
        );
      }
    }
    const saved = days.map((day) => ({ ...day, revision: day.revision + 1 }));
    const write =
      db.prepare(`INSERT INTO draft_days (date, revision, entries) VALUES (?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET revision = excluded.revision, entries = excluded.entries`);
    for (const day of saved)
      write.run(day.date, day.revision, JSON.stringify(day.entries));
    return saved;
  }
  function saveMany(input: unknown): DraftDay[] {
    const days = validateDays(input);
    db.exec("BEGIN IMMEDIATE");
    try {
      const saved = writeDays(days);
      db.exec("COMMIT");
      return saved;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function importConfirmed(records: SubmissionRecord[], source: string) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const all = db
        .prepare("SELECT details FROM submission_records")
        .all()
        .map((row) => decodeSubmission(row)!);
      const days = new Map<string, DraftDay>();
      const changed = new Set<string>();
      const catalogRevision = readActivities().revision;
      const planned: SubmissionRecord[] = [];
      let addedRows = 0,
        linkedRows = 0,
        alreadyPresent = 0;
      const now = new Date().toISOString();
      const sameFields = (
        entry: DraftDay["entries"][number],
        snapshot: SubmissionRecord["snapshot"],
      ) =>
        Number(entry.issue.trim()) === snapshot.issueId &&
        entry.minutes === snapshot.minutes &&
        entry.comment === snapshot.comment &&
        entry.activity === snapshot.activityName;
      for (const incoming of records) {
        if (
          !["confirmed", "existing"].includes(incoming.state) ||
          !incoming.remoteId ||
          incoming.verification !== "matched"
        )
          throw new ConflictError(
            "A importação exige recibos confirmados e conferidos.",
          );
        const s = incoming.snapshot;
        if (!days.has(s.date)) days.set(s.date, read(s.date));
        const day = days.get(s.date)!;
        const known = all.filter(
          (record) =>
            record.snapshot.scope === s.scope &&
            record.remoteId === incoming.remoteId,
        );
        if (known.length > 1)
          throw new ConflictError(
            "Há mais de um vínculo local para este ID remoto. Confira os dados antes de importar.",
          );
        let entry;
        if (known.length) {
          if (known[0].snapshot.date !== s.date)
            throw new ConflictError(
              "O ID remoto já está vinculado a outra data.",
            );
          entry = day.entries.find(
            (entry) => entry.id === known[0].snapshot.entryId,
          );
          if (!entry || !sameFields(entry, s))
            throw new ConflictError(
              "O vínculo local diverge do registro confirmado. Nenhuma linha foi importada.",
            );
          alreadyPresent++;
        } else {
          const matches = day.entries.filter((entry) => sameFields(entry, s));
          if (matches.length > 1)
            throw new ConflictError(
              "Há rascunhos locais idênticos e a associação é ambígua. Nenhuma linha foi importada.",
            );
          entry = matches[0];
          if (entry) linkedRows++;
          else {
            if (day.entries.some((entry) => entry.id === s.entryId))
              throw new ConflictError(
                "O identificador da linha já pertence a outro rascunho.",
              );
            entry = {
              id: s.entryId,
              issue: String(s.issueId),
              minutes: s.minutes,
              activity: s.activityName,
              comment: s.comment,
            };
            day.entries.push(entry);
            changed.add(s.date);
            addedRows++;
          }
        }
        const previous = all.find(
          (record) =>
            record.snapshot.date === s.date &&
            record.snapshot.entryId === entry!.id,
        );
        if (
          previous &&
          isSubmissionLocked(previous.state) &&
          (previous.snapshot.scope !== s.scope ||
            previous.remoteId !== incoming.remoteId)
        )
          throw new ConflictError(
            "Uma linha já possui outro envio protegido. Nenhuma linha foi importada.",
          );
        const next: SubmissionRecord = {
          ...incoming,
          id: previous?.id ?? incoming.id,
          snapshot: {
            ...s,
            entryId: entry.id,
            catalogRevision,
          },
          origin:
            previous && isSubmissionLocked(previous.state)
              ? previous.origin
              : "imported",
          importedAt: previous?.importedAt ?? now,
          importSource: previous?.importSource ?? source,
          sourceSubmissionId: incoming.id,
          confirmedAt: previous?.confirmedAt ?? incoming.confirmedAt,
          remoteCreatedAt:
            previous?.remoteCreatedAt ?? incoming.remoteCreatedAt,
          updatedAt: now,
        };
        planned.push(next);
        // Include earlier associations in ambiguity checks within this same transaction.
        if (previous) all.splice(all.indexOf(previous), 1, next);
        else all.push(next);
      }
      const saved = writeDays(
        [...changed].map((date) => validateDay(days.get(date)!)),
      );
      const revisions = new Map(saved.map((day) => [day.date, day.revision]));
      for (const record of planned) {
        record.snapshot.dayRevision =
          revisions.get(record.snapshot.date) ??
          days.get(record.snapshot.date)!.revision;
        assertSnapshot(record);
        writeSubmission(record, submissionFingerprint(record.snapshot));
      }
      db.exec("COMMIT");
      return { addedRows, linkedRows, alreadyPresent, records: planned };
    } catch (error) {
      db.exec("ROLLBACK");
      if (error instanceof ConflictError) throw error;
      throw new ConflictError(
        "A importação encontrou um conflito de dados. Nenhuma linha ou recibo foi gravado.",
      );
    }
  }

  function save(input: unknown): DraftDay {
    return saveMany([input])[0];
  }
  return {
    read,
    readRange,
    save,
    saveMany,
    readActivities,
    saveActivities,
    submission,
    submissionForEntry,
    submissions,
    putReview,
    beginSubmission,
    finishSubmission,
    recordVerification,
    importConfirmed,
    backupTo: (filename: string) => backup(db, filename),
    assertSnapshot,
    batch,
    batches,
    saveBatch,
    beginBatch,
    close: () => db.close(),
  };
}
