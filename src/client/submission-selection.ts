import { isSubmissionLocked, type SubmissionRecord } from "../shared/submissions";
import type { EditorState } from "./editor";

export function canSelectEntry(
  editor: EditorState,
  receipts: Record<string, SubmissionRecord>,
  date: string,
  entryId: string,
): boolean {
  const day = editor.days[date];
  const record = receipts[`${date}:${entryId}`];
  return !!day && day.revision > 0 &&
    day.entries.some((entry) => entry.id === entryId) &&
    !editor.dirtyDates.includes(date) &&
    !(record && isSubmissionLocked(record.state));
}

export function pendingEntries(
  dates: string[],
  editor: EditorState,
  receipts: Record<string, SubmissionRecord>,
) {
  return dates.flatMap((date) => (editor.days[date]?.entries ?? [])
    .filter((entry) => canSelectEntry(editor, receipts, date, entry.id))
    .map((entry) => ({ date, entryId: entry.id })));
}
