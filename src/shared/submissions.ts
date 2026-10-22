import { isWorkDate, type Draft, type DraftDay } from "./worklogs";
export type SubmissionState =
  "prepared" | "sending" | "confirmed" | "rejected" | "uncertain" | "existing";
export interface SubmissionSnapshot {
  date: string;
  entryId: string;
  dayRevision: number;
  catalogRevision: number;
  issueId: number;
  projectId: number;
  userId: number;
  scope: string;
  activityId: number;
  activityName: string;
  activityVerified: boolean;
  minutes: number;
  comment: string;
  subject: string;
  projectName: string;
  statusName: string;
}
export interface SubmissionRecord {
  id: string;
  snapshot: SubmissionSnapshot;
  state: SubmissionState;
  remoteId: number | null;
  message: string;
  preparedAt: string;
  updatedAt: string;
}
export const isSubmissionLocked = (state: SubmissionState) =>
  ["sending", "confirmed", "uncertain", "existing"].includes(state);
export function submissionDraft(day: DraftDay, entryId: string): Draft {
  const entry = day.entries.find((entry) => entry.id === entryId);
  if (!isWorkDate(day.date) || !entry)
    throw new Error("A linha salva não foi encontrada.");
  if (
    !/^[1-9]\d*$/.test(entry.issue.trim()) ||
    !Number.isSafeInteger(Number(entry.issue.trim()))
  )
    throw new Error("Informe um código de tarefa inteiro e positivo.");
  if (
    entry.minutes === null ||
    !Number.isSafeInteger(entry.minutes) ||
    entry.minutes < 0
  )
    throw new Error("Informe uma duração válida antes de enviar.");
  if (!entry.comment.trim())
    throw new Error("Preencha a observação antes de enviar.");
  if (!entry.activity.trim())
    throw new Error("Preencha a atividade antes de enviar.");
  return entry;
}
export function matchesTimeEntry(
  entry: any,
  snapshot: SubmissionSnapshot,
): boolean {
  const hours = Number(entry?.hours);
  return (
    !!entry &&
    (typeof entry.hours === "number" ||
      (typeof entry.hours === "string" && !!entry.hours.trim())) &&
    Number.isSafeInteger(entry.id) &&
    entry.id > 0 &&
    entry.issue?.id === snapshot.issueId &&
    entry.project?.id === snapshot.projectId &&
    entry.user?.id === snapshot.userId &&
    entry.activity?.id === snapshot.activityId &&
    entry.spent_on === snapshot.date &&
    entry.comments === snapshot.comment &&
    Number.isFinite(hours) &&
    Math.round(hours * 60) === snapshot.minutes
  );
}
