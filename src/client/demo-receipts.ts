import { receiptTimestamp, type SubmissionRecord, type SubmissionSnapshot } from "../shared/submissions";
import { validateBatchSelection, type SubmissionBatch } from "../shared/batches";
import { isWorkDate } from "../shared/worklogs";

export interface DemoCreation {
  id: number;
  snapshot: SubmissionSnapshot;
  createdAt: string;
}
const positive = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const invalid = (): never => { throw new Error("Invalid simulated receipt data"); };

function snapshot(value: any): SubmissionSnapshot {
  if (!value || !isWorkDate(value.date) || !positive(value.dayRevision) ||
    !positive(value.catalogRevision) || value.scope !== "worklog-demo" ||
    !["issueId", "projectId", "userId", "activityId"].every((key) => positive(value[key])) ||
    !["entryId", "activityName", "comment", "subject", "projectName", "statusName"].every((key) => typeof value[key] === "string") ||
    !value.entryId || !Number.isSafeInteger(value.minutes) || value.minutes < 0 ||
    typeof value.activityVerified !== "boolean") invalid();
  return structuredClone(value);
}
function record(value: any): SubmissionRecord {
  if (!value || value.simulated !== true || typeof value.id !== "string" || !value.id ||
    !["prepared", "sending", "confirmed", "existing", "rejected", "uncertain"].includes(value.state) ||
    !(value.remoteId === null || positive(value.remoteId)) || typeof value.message !== "string" ||
    !receiptTimestamp(value.preparedAt) || !receiptTimestamp(value.updatedAt) ||
    ["confirmedAt", "remoteCreatedAt", "lastCheckedAt"].some((key) => value[key] != null && !receiptTimestamp(value[key])) ||
    (value.verification != null && !["matched", "missing", "different", "unavailable"].includes(value.verification))) invalid();
  return { ...structuredClone(value), snapshot: snapshot(value.snapshot) };
}
function unique<T extends { id: string | number }>(values: T[]): T[] {
  if (new Set(values.map((value) => value.id)).size !== values.length) invalid();
  return values;
}
export function validateDemoReceipts(value: any) {
  if (!Array.isArray(value.submissions) || !Array.isArray(value.batches) || !Array.isArray(value.creations)) invalid();
  const submissions = unique<SubmissionRecord>(value.submissions.map(record));
  const batches = unique<SubmissionBatch>(value.batches.map((batch: any) => {
    if (!batch || batch.simulated !== true || typeof batch.id !== "string" || !batch.id ||
      !["prepared", "running", "finished", "interrupted"].includes(batch.state) ||
      !receiptTimestamp(batch.createdAt) || !receiptTimestamp(batch.updatedAt) ||
      typeof batch.message !== "string" || !Array.isArray(batch.items)) invalid();
    const selections = validateBatchSelection(batch.items.map((item: any) => item?.selection));
    return { ...structuredClone(batch), items: batch.items.map((item: any, index: number) => {
      if (!(item.error === null || typeof item.error === "string")) invalid();
      return { selection: selections[index], record: item.record === null ? null : record(item.record), error: item.error };
    }) };
  }));
  const creations = unique<DemoCreation>(value.creations.map((creation: any) => {
    if (!creation || !positive(creation.id) || !receiptTimestamp(creation.createdAt)) invalid();
    return { id: creation.id, snapshot: snapshot(creation.snapshot), createdAt: creation.createdAt };
  }));
  return { submissions, batches, creations };
}

export function sameDemoWork(a: SubmissionSnapshot, b: SubmissionSnapshot): boolean {
  return ["scope", "issueId", "projectId", "userId", "date", "minutes", "comment", "activityId"]
    .every((key) => a[key as keyof SubmissionSnapshot] === b[key as keyof SubmissionSnapshot]);
}
