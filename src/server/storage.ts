import {
  isSubmissionLocked,
  type SubmissionRecord,
  type SubmissionState,
} from "../shared/submissions";
import {
  validateActivityCatalog,
  type ActivityCatalog,
} from "../shared/activities";
import { DatabaseSync } from "node:sqlite";
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
    row ? JSON.parse(row.details) : null;
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
  function putReview(
    record: SubmissionRecord,
    fingerprint: string,
  ): SubmissionRecord {
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
      remoteId: number | null;
      message: string;
    },
  ): SubmissionRecord {
    const record = submission(id);
    if (!record)
      throw new ConflictError("O registro do envio não foi encontrado.");
    if (record.state === "confirmed" || record.state === "existing")
      return record;
    const next = { ...record, ...result, updatedAt: new Date().toISOString() };
    db.prepare(
      "UPDATE submission_records SET state = ?, details = ? WHERE id = ?",
    ).run(next.state, JSON.stringify(next), id);
    return next;
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

  function saveMany(input: unknown): DraftDay[] {
    const days = validateDays(input);
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const day of days) {
        const locked = submissions(day.date, day.date).filter((record) =>
          isSubmissionLocked(record.state),
        );
        const stored = read(day.date);
        for (const record of locked) {
          const previous = stored.entries.find(
            (e) => e.id === record.snapshot.entryId,
          );
          const next = day.entries.find(
            (e) => e.id === record.snapshot.entryId,
          );
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
      db.exec("COMMIT");
      return saved;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
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
    assertSnapshot,
    close: () => db.close(),
  };
}
