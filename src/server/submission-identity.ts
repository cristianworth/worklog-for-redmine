import { createHash } from "node:crypto";
import type { SubmissionSnapshot } from "../shared/submissions";
export function submissionFingerprint(snapshot: SubmissionSnapshot): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        snapshot.scope,
        snapshot.issueId,
        snapshot.projectId,
        snapshot.userId,
        snapshot.date,
        snapshot.minutes,
        snapshot.comment,
        snapshot.activityId,
      ]),
    )
    .digest("hex");
}
