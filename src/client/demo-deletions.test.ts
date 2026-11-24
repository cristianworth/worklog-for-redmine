import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoDataAccess } from "./demo-data-access";
import { demoStorageKey, type DemoState } from "./demo-store";

afterEach(() => vi.unstubAllGlobals());
async function setup() {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }) };
  const open = () => createDemoDataAccess({ storage, today: "2026-11-24", simulation: { wait: async () => {} } });
  const data = open();
  const state = (): DemoState => JSON.parse(values.get(demoStorageKey)!);
  const day = state().days[0];
  const selection = { date: day.date, entryId: day.entries[0].id, revision: day.revision };
  const batch = await data.prepareBatch([selection]);
  await data.confirmBatch(batch.id);
  await vi.waitFor(async () => expect((await data.readBatch(batch.id)).state).toBe("finished"));
  const record = (await data.readBatch(batch.id)).items[0].record!;
  return { values, storage, open, data, state, day, selection, batch, record };
}

describe("isolated demo deletion", () => {
  it("removes the fictional creation and row atomically while keeping receipts and batch history after reload", async () => {
    const http = vi.fn(() => { throw new Error("Network is forbidden"); });
    vi.stubGlobal("fetch", http);
    const t = await setup();
    const before = t.state();
    const deleted = await t.data.deleteSubmission(t.record.id, t.day.revision);
    expect(deleted).toMatchObject({ state: "deleted", simulated: true, remoteId: t.record.remoteId });
    expect(deleted.snapshot).toEqual(t.record.snapshot);
    expect(deleted.deletion?.remoteDeletedAt).toBeTruthy();
    expect(t.state().days[0]).toEqual({ ...t.day, revision: t.day.revision + 1,
      entries: t.day.entries.filter((entry) => entry.id !== t.selection.entryId) });
    expect(t.state().days.slice(1)).toEqual(before.days.slice(1));
    expect(t.state().creations).toHaveLength(0);
    expect((await t.open().readBatch(t.batch.id)).items[0].record).toEqual(deleted);
    expect(await t.open().deleteSubmission(t.record.id, t.day.revision)).toEqual(deleted);
    expect((await t.open().prepareSubmission(t.selection)).state).toBe("deleted");
    await expect(t.open().saveDays([{ ...t.day, revision: t.day.revision + 1 }])).rejects.toThrow(/excluída/);
    const remaining = t.state().days[0];
    expect((await t.open().saveDays([{ ...remaining, entries: [] }]))[0].entries).toEqual([]);
    expect(http).not.toHaveBeenCalled();
  });
  it("preserves all stored data when browser persistence fails", async () => {
    const t = await setup(), before = t.values.get(demoStorageKey);
    t.storage.setItem.mockImplementationOnce(() => { throw new Error("synthetic quota"); });
    await expect(t.data.deleteSubmission(t.record.id, t.day.revision)).rejects.toThrow(/salvar/);
    expect(t.values.get(demoStorageKey)).toBe(before);
    expect((await t.data.actOnSubmission(t.record.id, "verify")).state).toBe("confirmed");
  });
  it("rejects stale revisions, uncertain receipts and divergent or duplicate links", async () => {
    const t = await setup();
    await expect(t.data.deleteSubmission(t.record.id, 999)).rejects.toThrow();
    for (const mutation of [
      (state: DemoState) => { state.submissions[0].state = "uncertain"; state.submissions[0].remoteId = null; },
      (state: DemoState) => { state.creations[0].snapshot.minutes++; },
      (state: DemoState) => { state.submissions.push({ ...state.submissions[0], id: "duplicate-link" }); },
    ]) {
      const state = t.state(); mutation(state);
      const before = t.values.get(demoStorageKey)!;
      t.values.set(demoStorageKey, JSON.stringify(state));
      await expect(t.data.deleteSubmission(t.record.id, t.day.revision)).rejects.toThrow();
      expect(t.state().days[0]).toEqual(t.day);
      t.values.set(demoStorageKey, before);
    }
  });
  it("serializes concurrent deletion and refuses a stale save from another page", async () => {
    const t = await setup();
    const results = await Promise.all([t.data.deleteSubmission(t.record.id, t.day.revision), t.data.deleteSubmission(t.record.id, t.day.revision)]);
    expect(results[0]).toEqual(results[1]);
    expect(t.state().days[0].revision).toBe(t.day.revision + 1);
    await expect(t.open().saveDays([t.day])).rejects.toThrow();
  });
});
