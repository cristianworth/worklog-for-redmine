import { canDeleteSubmission, type SubmissionRecord } from "../shared/submissions";
import type { RedmineClient } from "./redmine";
import { ConflictError, type openDraftStore } from "./storage";
import { SubmissionError } from "./submissions";

export function createDeletionService(store: ReturnType<typeof openDraftStore>, redmine: RedmineClient) {
  const active = new Set<string>();
  function get(id: string) {
    const record = store.submission(id);
    if (!record) throw new SubmissionError("Recibo não encontrado.", 404);
    return record;
  }
  async function account(record: SubmissionRecord) {
    const current = await redmine.account();
    if (current.scope !== record.snapshot.scope || current.id !== record.snapshot.userId)
      throw new ConflictError("A conta ou instância mudou. Use a configuração original para conferir ou excluir.");
  }
  async function remove(id: string, revision: number) {
    const previous = get(id);
    if (previous.state === "deleted") return previous;
    if (active.has(id) || !canDeleteSubmission(previous))
      throw new ConflictError("A exclusão exige conferência. Nenhuma exclusão será repetida automaticamente.");
    const record = store.beginDeletion(id, revision);
    active.add(id);
    try {
      try {
        await account(record);
        const check = await redmine.inspectTimeEntry(record.remoteId!, record.snapshot);
        if (check.result !== "matched")
          throw new ConflictError("O lançamento não está disponível ou diverge do recibo. Confira no Redmine; a linha permanece protegida.");
      } catch (error) {
        store.updateDeletion(id, "rejected", "A conferência anterior à exclusão falhou. Nenhuma exclusão foi solicitada; a linha permanece protegida.");
        throw error;
      }
      const result = await redmine.deleteTimeEntry(record.remoteId!);
      if (result === "deleted") {
        // Persist the remote acknowledgement before the local transaction, so local failure is recoverable.
        store.updateDeletion(id, "remote_deleted", "Redmine confirmou a exclusão. Falta concluir a remoção local; use Conferir exclusão.");
        return store.finishDeletion(id);
      }
      return store.updateDeletion(id, result, result === "rejected"
        ? "O Redmine recusou a exclusão. Confira as permissões. A linha permanece protegida."
        : "Não foi possível confirmar a exclusão. A linha permanece protegida. Use Conferir exclusão; não repita a operação.");
    } finally { active.delete(id); }
  }
  async function recover(id: string) {
    const record = get(id);
    if (record.state === "deleted") return record;
    if (!record.deletion) throw new ConflictError("Nenhuma exclusão foi iniciada para este recibo.");
    if (active.has(id) || (record.deletion.state === "deleting" && Date.now() - Date.parse(record.deletion.updatedAt) < 60000))
      throw new ConflictError("Aguarde um minuto antes de conferir a exclusão iniciada.");
    await account(record);
    if (record.deletion.state === "remote_deleted") return store.finishDeletion(id);
    let matched = false;
    try { matched = (await redmine.inspectTimeEntry(record.remoteId!, record.snapshot)).result === "matched"; }
    catch { /* Missing, hidden, divergent and unavailable entries cannot prove deletion. */ }
    return store.updateDeletion(id, matched ? "rejected" : "uncertain", matched
      ? "O lançamento ainda corresponde ao recibo no Redmine. Nenhuma exclusão foi feita nesta conferência. Você pode revisar e confirmar uma nova tentativa."
      : "A consulta não comprova a exclusão: ausência pode significar falta de acesso. Confira manualmente no Redmine; a linha permanece protegida.", record.deletion.events.length);
  }
  return { remove, recover };
}
