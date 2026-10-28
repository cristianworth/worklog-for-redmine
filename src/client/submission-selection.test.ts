import { describe, expect, it } from "vitest";
import { createDemoDataAccess } from "./demo-data-access";
import { toEditor, type EditorState } from "./editor";
import { canSelectEntry, pendingEntries } from "./submission-selection";
import type { SubmissionRecord, SubmissionState } from "../shared/submissions";

async function fixture() {
  const data = createDemoDataAccess({ today: "2026-10-26" });
  const days = await data.readDays("2026-10-21", "2026-10-23");
  const editor: EditorState = { days: Object.fromEntries(days.map((day) => [day.date, toEditor(day)])), dirtyDates: [] };
  const first = days[0];
  const record = await data.prepareSubmission({ date: first.date, entryId: first.entries[0].id, revision: first.revision });
  return { days, editor, record };
}

describe("saved pending selection", () => {
  it("selects all pending rows of visible days, including partially appropriated days, in display order", async () => {
    const { days, editor, record } = await fixture();
    const receipts = { [`${days[0].date}:${record.snapshot.entryId}`]: { ...record, state: "confirmed" as const } };
    const selected = pendingEntries([days[0].date, days[1].date], editor, receipts);
    expect(selected).toEqual([
      ...days[0].entries.slice(1).map((entry) => ({ date: days[0].date, entryId: entry.id })),
      ...days[1].entries.map((entry) => ({ date: days[1].date, entryId: entry.id })),
    ]);
    expect(selected.some((item) => item.date === days[2].date)).toBe(false);
  });
  it("excludes every protected state but allows a rejected row to be reviewed again", async () => {
    const { days, editor, record } = await fixture();
    for (const state of ["confirmed", "existing", "sending", "uncertain", "rejected", "prepared"] satisfies SubmissionState[]) {
      const receipts: Record<string, SubmissionRecord> = { [`${days[0].date}:${record.snapshot.entryId}`]: { ...record, state } };
      expect(canSelectEntry(editor, receipts, days[0].date, record.snapshot.entryId)).toBe(["rejected", "prepared"].includes(state));
    }
  });
  it("skips dirty, unsaved, empty and missing days without changing their drafts", async () => {
    const { days, editor } = await fixture();
    editor.dirtyDates = [days[0].date];
    editor.days[days[1].date].revision = 0;
    editor.days[days[2].date].entries = [];
    const before = structuredClone(editor);
    expect(pendingEntries([...days.map((day) => day.date), "2026-10-20"], editor, {})).toEqual([]);
    expect(editor).toEqual(before);
  });
  it("keeps the complete selection above the batch limit so the interface can explain it instead of silently truncating", async () => {
    const { days, editor } = await fixture();
    const day = editor.days[days[0].date];
    day.entries = Array.from({ length: 101 }, (_, index) => ({ ...day.entries[0], id: `row-${index}` }));
    expect(pendingEntries([day.date], editor, {})).toHaveLength(101);
  });
});
