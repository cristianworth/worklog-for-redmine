import { resolveActivity } from "../shared/activities";
import { canConfirmBatch, validateBatchSelection, type BatchSelection, type SubmissionBatch } from "../shared/batches";
import { isSubmissionLocked, submissionDraft, type SubmissionRecord, type SubmissionSnapshot } from "../shared/submissions";
import type { DraftDay } from "../shared/worklogs";
import { DataAccessError, type IssueDetails, type SubmissionAction } from "./data-access";
import { demoIssues } from "./demo-examples";
import { sameDemoWork } from "./demo-receipts";
import type { DemoState, DemoStore } from "./demo-store";

export type DemoExclusive = <T>(action: () => T | Promise<T>) => Promise<T>;
export interface DemoSubmissionOptions {
  now?: () => Date;
  wait?: () => Promise<void>;
  outcome?: (snapshot: SubmissionSnapshot) => "confirmed" | "rejected" | "uncertain";
  issue?: (code: string) => IssueDetails | undefined;
}

export function assertDemoEditable(state: DemoState, days: DraftDay[]) {
  for (const record of state.submissions.filter((record) => isSubmissionLocked(record.state))) {
    const next = days.find((day) => day.date === record.snapshot.date);
    if (!next) continue;
    const before = state.days.find((day) => day.date === next.date)?.entries.find((entry) => entry.id === record.snapshot.entryId);
    const after = next.entries.find((entry) => entry.id === record.snapshot.entryId);
    if (!before || !after || ["issue", "minutes", "activity", "comment"].some((key) =>
      before[key as keyof typeof before] !== after[key as keyof typeof after]))
      throw new DataAccessError("Uma linha possui um resultado simulado protegido. Restaure os exemplos para recomeçar; os outros rascunhos continuam editáveis.", 409);
  }
}

export function createDemoSubmissions(store: DemoStore, exclusive: DemoExclusive, options: DemoSubmissionOptions = {}) {
  const now = () => (options.now?.() ?? new Date()).toISOString();
  const wait = options.wait ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 80)));
  const issue = options.issue ?? ((code: string) => demoIssues.find((value) => String(value.id) === code));
  const active = new Set<string>();
  const find = (state: DemoState, id: string) => {
    const record = state.submissions.find((value) => value.id === id);
    if (!record) throw new DataAccessError("Recibo simulado não encontrado. Prepare uma nova revisão.", 404);
    return record;
  };
  const replace = (state: DemoState, record: SubmissionRecord): DemoState => ({
    ...state, submissions: [...state.submissions.filter((value) => value.id !== record.id), record],
  });
  function context(state: DemoState, selection: BatchSelection): SubmissionSnapshot {
    const day = state.days.find((value) => value.date === selection.date);
    if (!day || day.revision !== selection.revision)
      throw new DataAccessError("O dia mudou. Recarregue os rascunhos antes de revisar a simulação.", 409);
    const entry = submissionDraft(day, selection.entryId);
    const task = issue(entry.issue.trim());
    if (!task) throw new DataAccessError("Tarefa fictícia não encontrada. Use 9001, 9004 ou 9007.", 400);
    const activity = resolveActivity(state.catalog.activities, entry.activity);
    if (!activity) throw new DataAccessError("Cadastre esta atividade no catálogo da demo antes de simular.", 400);
    return {
      date: day.date, entryId: entry.id, dayRevision: day.revision,
      catalogRevision: state.catalog.revision, issueId: task.id,
      projectId: task.project.id, userId: 990001, scope: "worklog-demo",
      activityId: activity.activityId, activityName: entry.activity, activityVerified: true,
      minutes: entry.minutes!, comment: entry.comment, subject: task.subject,
      projectName: task.project.name, statusName: task.status.name,
    };
  }
  function assertReview(state: DemoState, record: SubmissionRecord) {
    if (Date.parse(now()) - Date.parse(record.preparedAt) > 15 * 60 * 1000)
      throw new DataAccessError("A revisão simulada expirou. Prepare uma nova revisão.", 409);
    const fresh = context(state, { date: record.snapshot.date, entryId: record.snapshot.entryId, revision: record.snapshot.dayRevision });
    if (!sameDemoWork(record.snapshot, fresh) || fresh.catalogRevision !== record.snapshot.catalogRevision)
      throw new DataAccessError("O dia ou catálogo mudou após a revisão. Prepare uma nova simulação.", 409);
  }
  function prepareRaw(selection: BatchSelection): SubmissionRecord {
    const previous = store.read().submissions.find((value) => value.snapshot.date === selection.date && value.snapshot.entryId === selection.entryId);
    if (previous && isSubmissionLocked(previous.state)) return previous;
    let result!: SubmissionRecord;
    store.update((state) => {
      const previous = state.submissions.find((value) => value.snapshot.date === selection.date && value.snapshot.entryId === selection.entryId);
      if (previous && isSubmissionLocked(previous.state)) { result = previous; return state; }
      const snapshot = context(state, selection);
      const existing = state.creations.find((creation) => sameDemoWork(creation.snapshot, snapshot));
      const time = now();
      result = {
        id: crypto.randomUUID(), simulated: true, snapshot,
        state: existing ? "existing" : "prepared", remoteId: existing?.id ?? null,
        message: existing ? "Resultado fictício equivalente já existente. Nenhuma nova criação foi simulada." : "Revise e confirme. Esta operação é apenas uma simulação.",
        preparedAt: time, updatedAt: time,
        ...(existing ? { confirmedAt: existing.createdAt, remoteCreatedAt: existing.createdAt, verification: "matched" as const } : {}),
      };
      return { ...state, submissions: [...state.submissions.filter((value) => value.id !== previous?.id), result] };
    });
    return structuredClone(result);
  }
  async function sendRaw(id: string): Promise<SubmissionRecord> {
    let record = find(store.read(), id);
    if (isSubmissionLocked(record.state)) return record;
    if (record.state !== "prepared") throw new DataAccessError("Prepare uma nova revisão antes de simular novamente.", 409);
    assertReview(store.read(), record);
    record = { ...record, state: "sending", updatedAt: now(), message: "Simulação iniciada. Aguarde o resultado fictício." };
    store.update((state) => replace(state, record));
    await wait();
    // Creation and receipt are committed together; an earlier sending receipt survives a storage failure.
    store.update((state) => {
      const current = find(state, id);
      if (current.state !== "sending") { record = current; return state; }
      const equivalent = state.creations.find((creation) => sameDemoWork(creation.snapshot, current.snapshot));
      const outcome = equivalent ? "confirmed" : options.outcome?.(current.snapshot) ?? "confirmed";
      const time = now();
      if (outcome === "rejected") {
        record = { ...current, state: "rejected", updatedAt: time, message: "Falha fictícia antes da criação. Nenhum resultado foi criado para esta linha." };
        return replace(state, record);
      }
      const creation = equivalent ?? {
        id: state.creations.reduce((highest, value) => Math.max(highest, value.id), 990000) + 1,
        snapshot: current.snapshot, createdAt: time,
      };
      record = { ...current, state: outcome === "uncertain" ? "uncertain" : equivalent ? "existing" : "confirmed",
        remoteId: outcome === "uncertain" ? null : creation.id, updatedAt: time,
        message: outcome === "uncertain" ? "Resposta fictícia perdida. Confira o resultado; a criação não será repetida."
          : "Horas simuladas com sucesso. Nenhum dado foi enviado ao Redmine; o status do card foi mantido.",
        ...(outcome === "uncertain" ? {} : { confirmedAt: time, remoteCreatedAt: creation.createdAt, verification: "matched" as const }),
      };
      return replace({ ...state, creations: equivalent ? state.creations : [...state.creations, creation] }, record);
    });
    return structuredClone(record);
  }
  function verifyRaw(id: string): SubmissionRecord {
    let record!: SubmissionRecord;
    store.update((state) => {
      const previous = find(state, id);
      if (previous.state === "prepared" || previous.state === "rejected")
        throw new DataAccessError("Este recibo ainda não possui criação simulada para conferir.", 409);
      const matches = state.creations.filter((creation) => sameDemoWork(creation.snapshot, previous.snapshot));
      const creation = matches.length === 1 ? matches[0] : undefined;
      const time = now();
      record = creation ? {
        ...previous, state: previous.state === "existing" ? "existing" : "confirmed", remoteId: creation.id,
        confirmedAt: previous.confirmedAt ?? time, remoteCreatedAt: previous.remoteCreatedAt ?? creation.createdAt,
        lastCheckedAt: time, verification: "matched", updatedAt: time,
        message: "Resultado fictício conferido. Nenhuma criação foi repetida.",
      } : {
        ...previous, state: ["confirmed", "existing"].includes(previous.state) ? previous.state : "uncertain",
        lastCheckedAt: time, verification: "missing", updatedAt: time,
        message: "O resultado fictício não foi localizado. O recibo e a proteção contra repetição foram preservados.",
      };
      return replace(state, record);
    });
    return structuredClone(record);
  }
  function getBatch(id: string): SubmissionBatch {
    const state = store.read(), batch = state.batches.find((value) => value.id === id);
    if (!batch) throw new DataAccessError("Lote simulado não encontrado.", 404);
    const items = batch.items.map((item) => {
      if (!item.record) return item;
      const record = state.submissions.find((value) => value.id === item.record!.id);
      return record ? { ...item, record } : { ...item, error: "A revisão foi substituída. Prepare outra seleção." };
    });
    return { ...batch, items, ...(batch.state === "running" && !active.has(id) ? {
      state: "interrupted" as const, message: "A simulação pode ter sido interrompida. Confira os recibos; não há retomada automática.",
    } : {}) };
  }
  function putBatch(batch: SubmissionBatch) {
    store.update((state) => ({ ...state, batches: [...state.batches.filter((value) => value.id !== batch.id), batch] }));
  }
  const lineError = (selection: BatchSelection, error: unknown) => {
    const day = store.read().days.find((day) => day.date === selection.date);
    const index = day?.entries.findIndex((entry) => entry.id === selection.entryId) ?? -1;
    const code = day?.entries[index]?.issue;
    return `Dia ${selection.date.split("-").reverse().join("/")} · linha ${index + 1}${code ? ` · tarefa #${code}` : ""}: ${error instanceof Error ? error.message : "Falha na simulação."}`;
  };

  async function runBatch(id: string) {
    let batch = getBatch(id);
    const state = store.read();
    batch.items = batch.items.map((item) => {
      if (item.record?.state !== "prepared") return item;
      try { assertReview(state, item.record); return item; }
      catch (error) { return { ...item, error: lineError(item.selection, error) }; }
    });
    if (batch.items.some((item) => item.error)) {
      putBatch({ ...batch, state: "interrupted", updatedAt: now(), message: "Nenhuma hora foi simulada: a validação de toda a seleção encontrou impedimentos." });
      return;
    }
    let interrupted = false;
    for (const item of batch.items) {
      if (item.record?.state !== "prepared") continue;
      try {
        item.record = await sendRaw(item.record.id);
        interrupted = !["confirmed", "existing"].includes(item.record.state);
      } catch (error) { item.error = lineError(item.selection, error); interrupted = true; }
      batch.updatedAt = now();
      putBatch(batch);
      if (interrupted) break;
    }
    batch = { ...batch, state: interrupted ? "interrupted" : "finished", updatedAt: now(),
      message: interrupted ? "Simulação interrompida. Resultados anteriores foram preservados; as demais linhas não foram simuladas."
        : "Simulação concluída. Nenhuma hora foi enviada ao Redmine; os status dos cards foram mantidos." };
    putBatch(batch);
  }
  return {
    prepare: (selection: BatchSelection, signal?: AbortSignal) => exclusive(() => {
      signal?.throwIfAborted();
      validateBatchSelection([selection]);
      return prepareRaw(selection);
    }),
    act: (id: string, action: SubmissionAction) => exclusive(() => action === "confirm" ? sendRaw(id) : verifyRaw(id)),
    prepareBatch: (values: BatchSelection[]) => exclusive(() => {
      const entries = validateBatchSelection(values), time = now();
      const batch: SubmissionBatch = { id: crypto.randomUUID(), simulated: true, state: "prepared", createdAt: time, updatedAt: time,
        message: "Revise as linhas antes de confirmar a simulação. Nada será enviado ao Redmine.", items: entries.map((selection) => {
          try {
            const record = prepareRaw(selection);
            return { selection, record, error: ["sending", "uncertain"].includes(record.state) ? "Confira o resultado protegido antes de continuar." : null };
          } catch (error) { return { selection, record: null, error: lineError(selection, error) }; }
        }) };
      if (!canConfirmBatch(batch)) batch.message = "A simulação está bloqueada: confira os impedimentos da seleção inteira.";
      putBatch(batch);
      return structuredClone(batch);
    }),
    confirmBatch: (id: string) => exclusive(() => {
      const batch = getBatch(id);
      if (batch.state !== "prepared") return batch;
      if (!canConfirmBatch(batch)) throw new DataAccessError("O lote simulado contém impedimentos ou nenhuma linha pendente.", 409);
      if (Date.parse(now()) - Date.parse(batch.createdAt) > 15 * 60 * 1000)
        throw new DataAccessError("A revisão do lote expirou. Prepare outra simulação.", 409);
      putBatch({ ...batch, state: "running", updatedAt: now(), message: "Validando toda a seleção antes de simular. Aguarde os recibos." });
      active.add(id);
      queueMicrotask(() => { void exclusive(() => runBatch(id)).catch(() => {
        // The stored receipts remain authoritative after a failed browser-storage write.
      }).finally(() => active.delete(id)); });
      return getBatch(id);
    }),
    readBatch: async (id: string) => getBatch(id),
    list: (from: string, to: string) => store.read().submissions.filter((value) => value.snapshot.date >= from && value.snapshot.date <= to),
    batches: (from: string, to: string) => store.read().batches.filter((value) => value.state !== "prepared" && value.items.some((item) => item.selection.date >= from && item.selection.date <= to))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20).map((value) => getBatch(value.id)),
  };
}
