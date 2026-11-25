import { isWorkDate, type Draft, type DraftDay } from "./worklogs";
export type SubmissionState =
  "prepared" | "sending" | "confirmed" | "rejected" | "uncertain" | "existing" | "deleted";
export interface SubmissionDeletion {
  state: "deleting" | "uncertain" | "rejected" | "remote_deleted" | "deleted";
  startedAt: string;
  updatedAt: string;
  remoteDeletedAt?: string;
  events: { at: string; state: SubmissionDeletion["state"]; message: string }[];
}
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
  deletion?: SubmissionDeletion;
  simulated?: boolean;
  id: string;
  snapshot: SubmissionSnapshot;
  state: SubmissionState;
  remoteId: number | null;
  message: string;
  preparedAt: string;
  updatedAt: string;
  confirmedAt?: string | null;
  remoteCreatedAt?: string | null;
  lastCheckedAt?: string | null;
  verification?: "matched" | "missing" | "different" | "unavailable" | null;
  origin?: "submitted" | "existing" | "imported";
  importedAt?: string | null;
  importSource?: string;
  sourceSubmissionId?: string;
}
export const isSubmissionLocked = (state: SubmissionState) =>
  ["sending", "confirmed", "uncertain", "existing", "deleted"].includes(state);
export function canDeleteSubmission(record: SubmissionRecord): boolean {
  return ["confirmed", "existing"].includes(record.state) &&
    Number.isSafeInteger(record.remoteId) && record.remoteId! > 0 &&
    (!record.deletion || record.deletion.state === "rejected");
}
export function matchesReceiptDraft(day: DraftDay, record: SubmissionRecord): boolean {
  const entry = day.entries.find((entry) => entry.id === record.snapshot.entryId);
  const s = record.snapshot;
  return !!entry && Number(entry.issue.trim()) === s.issueId && entry.minutes === s.minutes &&
    entry.activity === s.activityName && entry.comment === s.comment;
}
export function nextDeletion(record: SubmissionRecord, state: SubmissionDeletion["state"], message: string, now: string): SubmissionDeletion {
  return {
    ...record.deletion, state, startedAt: record.deletion?.startedAt ?? now, updatedAt: now,
    ...(state === "remote_deleted" ? { remoteDeletedAt: now } : {}),
    events: [...(record.deletion?.events ?? []), { at: now, state, message }],
  };
}
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

export function receiptTimestamp(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) ||
    !isWorkDate(value.slice(0, 10)) ||
    Number(value.slice(11, 13)) > 23 ||
    !Number.isFinite(Date.parse(value))
  )
    return null;
  return new Date(value).toISOString();
}
export function normalizeReceipt(record: SubmissionRecord): SubmissionRecord {
  return {
    ...record,
    // Before explicit receipt dates existed, terminal results retained their confirmation update.
    confirmedAt:
      receiptTimestamp(record.confirmedAt) ??
      (!("confirmedAt" in record) && record.state === "confirmed"
        ? receiptTimestamp(record.updatedAt)
        : null),
    remoteCreatedAt: receiptTimestamp(record.remoteCreatedAt),
    lastCheckedAt:
      receiptTimestamp(record.lastCheckedAt) ??
      (record.state === "existing" ? receiptTimestamp(record.updatedAt) : null),
    origin:
      record.origin ?? (record.state === "existing" ? "existing" : "submitted"),
  };
}
export function hasVerificationProblem(record: SubmissionRecord): boolean {
  return !!record.verification && record.verification !== "matched";
}
export function isAppropriated(record?: SubmissionRecord): boolean {
  return (
    !!record &&
    ["confirmed", "existing"].includes(record.state) &&
    !record.deletion &&
    !hasVerificationProblem(record)
  );
}
export function appropriationSummary(
  entryIds: string[],
  records: (SubmissionRecord | undefined)[],
) {
  let confirmed = 0,
    pending = 0,
    checking = 0;
  for (let i = 0; i < entryIds.length; i++) {
    const record = records[i];
    if (isAppropriated(record)) confirmed++;
    else if (
      record &&
      (isSubmissionLocked(record.state) || hasVerificationProblem(record))
    )
      checking++;
    else pending++;
  }
  const total = entryIds.length;
  const label = !total
    ? "Nenhum lançamento"
    : confirmed === total
      ? `${confirmed} de ${total} apropriadas`
      : [
          confirmed ? `${confirmed} apropriadas` : "",
          pending ? `${pending} pendentes` : "",
          checking ? `${checking} a conferir` : "",
        ]
          .filter(Boolean)
          .join(" · ");
  return {
    total,
    confirmed,
    pending,
    checking,
    complete: total > 0 && confirmed === total,
    label,
  };
}
export function acceptReceipt(
  previous: SubmissionRecord | undefined,
  next: SubmissionRecord,
): boolean {
  if (!previous) return true;
  if (previous.state === "deleted") return next.state === "deleted";
  if (previous.deletion && (!next.deletion || next.deletion.events.length < previous.deletion.events.length)) return false;
  if (
    ["confirmed", "existing"].includes(previous.state) &&
    !["confirmed", "existing", "deleted"].includes(next.state)
  )
    return false;
  return Date.parse(next.updatedAt) >= Date.parse(previous.updatedAt);
}
