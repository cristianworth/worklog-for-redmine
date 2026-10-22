import { randomUUID } from "node:crypto";
import {
  canConfirmBatch,
  validateBatchSelection,
  type SubmissionBatch,
} from "../shared/batches";
import { ConflictError, type openDraftStore } from "./storage";
import { SubmissionError, type createSubmissionService } from "./submissions";
import { RedmineError } from "./redmine";

export function createBatchService(
  store: ReturnType<typeof openDraftStore>,
  submissions: ReturnType<typeof createSubmissionService>,
) {
  const active = new Set<string>();
  function get(id: string): SubmissionBatch {
    const value = store.batch(id);
    if (!value) throw new SubmissionError("Lote não encontrado.", 404);
    const items = value.items.map((item) => {
      if (!item.record) return item;
      const current = store.submission(item.record.id);
      return current
        ? { ...item, record: current }
        : {
            ...item,
            error: "Esta revisão foi substituída. Prepare uma nova seleção.",
          };
    });
    if (value.state === "running" && !active.has(id))
      return {
        ...value,
        items,
        state: "interrupted",
        message:
          "A execução foi interrompida. Confira os resultados; as linhas não enviadas exigem uma nova seleção e confirmação.",
      };
    return { ...value, items };
  }
  async function prepare(input: unknown): Promise<SubmissionBatch> {
    let entries;
    try {
      entries = validateBatchSelection(input);
    } catch (error) {
      throw new SubmissionError((error as Error).message);
    }
    const now = new Date().toISOString();
    const value: SubmissionBatch = {
      id: randomUUID(),
      state: "prepared",
      items: [],
      createdAt: now,
      updatedAt: now,
      message: "Revise todas as linhas. Nenhuma criação foi solicitada.",
    };
    for (const selection of entries) {
      try {
        const record = await submissions.prepare(
          selection.date,
          selection.entryId,
          selection.revision,
        );
        value.items.push({
          selection,
          record,
          error: ["sending", "uncertain"].includes(record.state)
            ? "Confira o resultado desta linha antes de preparar outro envio."
            : null,
        });
      } catch (error) {
        value.items.push({
          selection,
          record: null,
          error:
            error instanceof ConflictError ||
            error instanceof SubmissionError ||
            error instanceof RedmineError
              ? error.message
              : "Não foi possível revisar esta linha. Nenhum envio foi iniciado.",
        });
      }
    }
    if (!canConfirmBatch(value))
      value.message =
        "Há impedimentos ou nenhuma linha pendente. Corrija os campos ou confira os resultados antes de preparar outro lote.";
    return store.saveBatch(value);
  }
  function start(id: string): Promise<SubmissionBatch> {
    const value = store.beginBatch(id);
    active.add(id);
    return run(value);
  }
  async function run(value: SubmissionBatch): Promise<SubmissionBatch> {
    let interrupted = false;
    try {
      for (const item of value.items) {
        if (item.record!.state !== "prepared") continue;
        try {
          const result = await submissions.send(item.record!.id);
          item.record = result;
          if (!["confirmed", "existing"].includes(result.state))
            interrupted = true;
        } catch (error) {
          item.error =
            error instanceof ConflictError || error instanceof SubmissionError
              ? error.message
              : "A execução parou. Confira o resultado desta linha antes de tentar outra seleção.";
          interrupted = true;
        }
        value.updatedAt = new Date().toISOString();
        store.saveBatch(value);
        if (interrupted) break;
      }
      value.state = interrupted ? "interrupted" : "finished";
      value.message = interrupted
        ? "Lote interrompido na primeira falha. Os resultados anteriores foram preservados; as demais linhas não foram enviadas."
        : "Lote concluído. Confira o resultado de cada linha; os status dos cards foram mantidos.";
      value.updatedAt = new Date().toISOString();
      store.saveBatch(value);
    } finally {
      active.delete(value.id);
    }
    return get(value.id);
  }
  return {
    prepare,
    start,
    get,
    list: (from: string, to: string) =>
      store.batches(from, to).map((value) => get(value.id)),
  };
}
