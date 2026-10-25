import type { ActivityCatalog } from "../shared/activities";
import type { DraftDay } from "../shared/worklogs";
import type { DayTemplate } from "../shared/day-template";
import type { BatchSelection, SubmissionBatch } from "../shared/batches";
import type { SubmissionRecord } from "../shared/submissions";

export interface IssueDetails {
  id: number;
  subject: string;
  status: { id: number; name: string };
  project: { id: number; name: string };
}
export interface ConnectionStatus {
  configured: boolean;
  hasApiKey: boolean;
  certificateException: boolean;
}
export type SubmissionAction = "confirm" | "verify" | "reconcile";

export interface WorklogDataAccess {
  readonly mode: "local" | "demo";
  readActivities(signal?: AbortSignal): Promise<ActivityCatalog>;
  // A successful save must confirm the next revision and the saved catalog.
  saveActivities(catalog: ActivityCatalog): Promise<ActivityCatalog>;
  readDays(from: string, to: string, signal?: AbortSignal): Promise<DraftDay[]>;
  // A successful save must acknowledge every requested date and its next revision.
  saveDays(days: DraftDay[]): Promise<DraftDay[]>;
  readDayTemplate(signal?: AbortSignal): Promise<DayTemplate>;
  saveDayTemplate(template: DayTemplate): Promise<DayTemplate>;
  readIssue(code: string, refresh: boolean, signal?: AbortSignal): Promise<IssueDetails>;
  readConnectionStatus(signal?: AbortSignal): Promise<ConnectionStatus>;
  checkConnection(): Promise<void>;
  listSubmissions(from: string, to: string, signal?: AbortSignal): Promise<SubmissionRecord[]>;
  listBatches(from: string, to: string, signal?: AbortSignal): Promise<SubmissionBatch[]>;
  prepareSubmission(selection: BatchSelection, signal?: AbortSignal): Promise<SubmissionRecord>;
  actOnSubmission(id: string, action: SubmissionAction): Promise<SubmissionRecord>;
  prepareBatch(entries: BatchSelection[]): Promise<SubmissionBatch>;
  readBatch(id: string): Promise<SubmissionBatch>;
  confirmBatch(id: string): Promise<SubmissionBatch>;
}

export class DataAccessError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DataAccessError";
  }
}
