import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConflictError, openDraftStore } from "./storage";

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0))
    rmSync(folder, { recursive: true, force: true });
});
const draft = {
  id: "synthetic-entry",
  issue: "1001",
  minutes: 90,
  activity: "Revisão",
  comment: "Exemplo fictício\nSegunda linha.",
};

describe("local persistence", () => {
  it("recovers the same day and incomplete drafts after closing the database", () => {
    const folder = mkdtempSync(join(tmpdir(), "worklog-test-"));
    folders.push(folder);
    const filename = join(folder, "drafts.sqlite");
    const first = openDraftStore(filename);
    try {
      first.save({
        date: "2026-10-21",
        revision: 0,
        entries: [
          draft,
          {
            ...draft,
            id: "empty",
            issue: "",
            minutes: null,
            activity: "",
            comment: "",
          },
        ],
      });
    } finally {
      first.close();
    }
    const reopened = openDraftStore(filename);
    try {
      expect(reopened.read("2026-10-21")).toEqual({
        date: "2026-10-21",
        revision: 1,
        entries: [
          draft,
          {
            ...draft,
            id: "empty",
            issue: "",
            minutes: null,
            activity: "",
            comment: "",
          },
        ],
      });
      expect(reopened.read("2026-10-22").entries).toEqual([]);
    } finally {
      reopened.close();
    }
  });
  it("persists edits, deletion of every row, and keeps other dates unchanged", () => {
    const store = openDraftStore(":memory:");
    try {
      store.save({ date: "2026-10-21", revision: 0, entries: [draft] });
      store.save({ date: "2026-10-22", revision: 0, entries: [draft] });
      store.save({
        date: "2026-10-21",
        revision: 1,
        entries: [{ ...draft, minutes: 45 }],
      });
      expect(store.read("2026-10-21").entries[0].minutes).toBe(45);
      store.save({ date: "2026-10-21", revision: 2, entries: [] });
      expect(store.read("2026-10-21").entries).toEqual([]);
      expect(store.read("2026-10-22").entries).toEqual([draft]);
    } finally {
      store.close();
    }
  });
  it("refuses stale writes and invalid payloads without losing persisted rows", () => {
    const store = openDraftStore(":memory:");
    try {
      store.save({ date: "2026-10-21", revision: 0, entries: [draft] });
      expect(() =>
        store.save({ date: "2026-10-21", revision: 0, entries: [] }),
      ).toThrow(ConflictError);
      expect(() =>
        store.save({
          date: "2026-10-21",
          revision: 1,
          entries: [{ ...draft, minutes: -10 }],
        }),
      ).toThrow();
      expect(store.read("2026-10-21").entries).toEqual([draft]);
      expect(
        store.save({ date: "2026-10-21", revision: 1, entries: [] }).revision,
      ).toBe(2);
    } finally {
      store.close();
    }
  });
});
