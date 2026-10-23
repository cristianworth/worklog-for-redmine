import { submissionFingerprint } from "./submission-identity";
import { randomUUID } from "node:crypto";
import { resolveActivity } from "../shared/activities";
import {
  submissionDraft,
  isSubmissionLocked,
  type SubmissionRecord,
  type SubmissionSnapshot,
} from "../shared/submissions";
import { isWorkDate } from "../shared/worklogs";
import { ConflictError, type openDraftStore } from "./storage";
import { type RedmineClient } from "./redmine";
export class SubmissionError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}
export function createSubmissionService(
  store: ReturnType<typeof openDraftStore>,
  redmine: RedmineClient,
) {
  async function context(
    date: string,
    entryId: string,
    expectedRevision: number,
  ) {
    if (
      !isWorkDate(date) ||
      !entryId ||
      !Number.isSafeInteger(expectedRevision)
    )
      throw new SubmissionError("Selecione uma linha salva válida.");
    const day = store.read(date);
    if (day.revision !== expectedRevision)
      throw new ConflictError(
        "O dia mudou. Recarregue os rascunhos antes de revisar o envio.",
      );
    let entry;
    try {
      entry = submissionDraft(day, entryId);
    } catch (error) {
      throw new SubmissionError((error as Error).message);
    }
    const [account, issue] = await Promise.all([
      redmine.account(),
      redmine.issue(entry.issue.trim()),
    ]);
    const catalog = store.readActivities();
    const activity = resolveActivity(
      catalog.activities,
      issue.project.id,
      entry.activity,
    );
    if (!activity)
      throw new SubmissionError(
        "Cadastre esta atividade para o projeto da tarefa em Configurações antes de enviar.",
      );
    const available = await redmine.projectActivities(issue.project.id);
    if (available && !available.some((a) => a.id === activity.activityId))
      throw new SubmissionError(
        "O código da atividade não está disponível no projeto da tarefa. Confira o catálogo local.",
      );
    return {
      date,
      entryId,
      dayRevision: day.revision,
      catalogRevision: catalog.revision,
      issueId: issue.id,
      projectId: issue.project.id,
      userId: account.id,
      scope: account.scope,
      activityId: activity.activityId,
      activityName: entry.activity,
      activityVerified: available !== null,
      minutes: entry.minutes!,
      comment: entry.comment,
      subject: issue.subject,
      projectName: issue.project.name,
      statusName: issue.status.name,
    } satisfies SubmissionSnapshot;
  }
  async function prepare(
    date: string,
    entryId: string,
    revision: number,
  ): Promise<SubmissionRecord> {
    const previous = store.submissionForEntry(date, entryId);
    if (previous && isSubmissionLocked(previous.state)) return previous;
    const snapshot = await context(date, entryId, revision);
    const existing = await redmine.existingTimeEntries(snapshot);
    const fingerprint = submissionFingerprint(snapshot);
    const now = new Date().toISOString();
    return store.putReview(
      {
        id: randomUUID(),
        snapshot,
        state: existing.length ? "existing" : "prepared",
        remoteId: existing.length === 1 ? existing[0] : null,
        message: existing.length
          ? "Já existe lançamento equivalente no Redmine. Nenhum novo envio foi feito."
          : "Revise os dados e confirme o envio desta linha.",
        preparedAt: now,
        updatedAt: now,
      },
      fingerprint,
    );
  }
  async function send(id: string): Promise<SubmissionRecord> {
    const record = store.beginSubmission(id);
    try {
      const fresh = await context(
        record.snapshot.date,
        record.snapshot.entryId,
        record.snapshot.dayRevision,
      );
      if (
        [
          "scope",
          "projectId",
          "userId",
          "activityId",
          "minutes",
          "comment",
          "issueId",
          "date",
          "catalogRevision",
        ].some(
          (key) =>
            fresh[key as keyof SubmissionSnapshot] !==
            record.snapshot[key as keyof SubmissionSnapshot],
        )
      )
        throw new ConflictError(
          "O contexto remoto mudou após a revisão. Prepare uma nova revisão.",
        );
      const existing = await redmine.existingTimeEntries(fresh);
      if (existing.length)
        return store.finishSubmission(id, {
          state: "existing",
          remoteId: existing.length === 1 ? existing[0] : null,
          message:
            "Já existe lançamento equivalente no Redmine. Nenhum novo envio foi feito.",
        });
      store.assertSnapshot(record);
    } catch (error) {
      return store.finishSubmission(id, {
        state: "rejected",
        remoteId: null,
        message:
          error instanceof ConflictError || error instanceof SubmissionError
            ? error.message
            : "A conferência anterior ao envio falhou. Nenhuma criação foi solicitada; confira o acesso e prepare uma nova revisão.",
      });
    }
    const latest = store.submission(id);
    if (latest && latest.state !== "sending") return latest;
    let result;
    try {
      result = await redmine.createTimeEntry(record.snapshot);
    } catch {
      result = {
        state: "uncertain" as const,
        remoteId: null,
        message:
          "Não foi possível confirmar o envio iniciado. Não reenvie; confira o resultado no Redmine.",
      };
    }
    return store.finishSubmission(id, result);
  }
  async function reconcile(id: string): Promise<SubmissionRecord> {
    const record = store.submission(id);
    if (!record) throw new SubmissionError("Envio não encontrado.", 404);
    if (record.state !== "uncertain" && record.state !== "sending")
      return record;
    if (
      record.state === "sending" &&
      Date.now() - Date.parse(record.updatedAt) < 60000
    )
      return record;
    const account = await redmine.account();
    if (account.scope !== record.snapshot.scope)
      throw new ConflictError(
        "A conta ou o servidor mudou. Confira o envio usando a configuração original.",
      );
    const remoteId =
      record.remoteId ??
      (await (async () => {
        const ids = await redmine.existingTimeEntries(record.snapshot);
        return ids.length === 1 ? ids[0] : null;
      })());
    if (remoteId) {
      const check = await redmine.inspectTimeEntry(remoteId, record.snapshot);
      if (check.result === "matched")
        return store.finishSubmission(id, {
          state: "confirmed",
          remoteId,
          remoteCreatedAt: check.createdAt,
          message:
            "Resultado conferido no Redmine. Horas confirmadas; status mantido.",
        });
    }
    return store.finishSubmission(id, {
      state: "uncertain",
      remoteId: record.remoteId,
      message:
        "A consulta não confirmou um único lançamento correspondente. Confira manualmente no Redmine. O reenvio continua bloqueado.",
    });
  }
  async function verify(id: string): Promise<SubmissionRecord> {
    const record = store.submission(id);
    if (!record) throw new SubmissionError("Envio não encontrado.", 404);
    if (!["confirmed", "existing"].includes(record.state)) return reconcile(id);
    const account = await redmine.account();
    if (
      account.scope !== record.snapshot.scope ||
      account.id !== record.snapshot.userId
    )
      throw new ConflictError(
        "A conta ou o servidor mudou. Confira usando a configuração original.",
      );
    try {
      if (!record.remoteId)
        return store.recordVerification(id, {
          result: "unavailable",
          createdAt: null,
        });
      return store.recordVerification(
        id,
        await redmine.inspectTimeEntry(record.remoteId, record.snapshot),
      );
    } catch {
      return store.recordVerification(id, {
        result: "unavailable",
        createdAt: null,
      });
    }
  }
  return { prepare, send, reconcile, verify };
}
