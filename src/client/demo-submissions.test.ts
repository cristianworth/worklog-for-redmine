import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoDataAccess } from "./demo-data-access";
import { demoStorageKey, type DemoState } from "./demo-store";
import type { DemoSubmissionOptions } from "./demo-submissions";
import { demoIssues } from "./demo-examples";
import type { WorklogDataAccess } from "./data-access";

function setup(simulation: DemoSubmissionOptions = {}) {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, raw: string) => { values.set(key, raw); }) };
  const open = () => createDemoDataAccess({ storage, today: "2026-10-25", simulation: { wait: async () => {}, ...simulation } });
  const data = open();
  const state = (): DemoState => JSON.parse(values.get(demoStorageKey)!);
  const selections = () => state().days.flatMap((day) => day.entries.map((entry) => ({ date: day.date, entryId: entry.id, revision: day.revision })));
  return { values, storage, open, data, state, selections };
}
async function finished(data: WorklogDataAccess, id: string) {
  await vi.waitFor(async () => expect((await data.readBatch(id)).state).not.toBe("running"));
  return data.readBatch(id);
}
afterEach(() => vi.unstubAllGlobals());

describe("simulated submissions and durable browser receipts", () => {
  it("requires review, confirms once, survives reload and verifies without another creation", async () => {
    const http = vi.fn(() => { throw new Error("HTTP is forbidden"); });
    vi.stubGlobal("fetch", http);
    const t = setup(), selection = t.selections()[0];
    const review = await t.data.prepareSubmission(selection);
    expect(review).toMatchObject({ state: "prepared", simulated: true });
    expect(t.state().creations).toHaveLength(0);
    const sent = await t.data.actOnSubmission(review.id, "confirm");
    expect(sent).toMatchObject({ state: "confirmed", simulated: true, remoteId: 990001 });
    expect(sent.snapshot.statusName).toBe(demoIssues[0].status.name);
    expect((await t.open().prepareSubmission(selection)).id).toBe(sent.id);
    expect(await t.open().actOnSubmission(sent.id, "confirm")).toEqual(sent);
    const checked = await t.open().actOnSubmission(sent.id, "verify");
    expect(checked.verification).toBe("matched");
    expect(checked.confirmedAt).toBe(sent.confirmedAt);
    expect(t.state().creations).toHaveLength(1);
    expect(http).not.toHaveBeenCalled();
    const day = (await t.data.readDays(selection.date, selection.date))[0];
    day.entries[0].minutes = 5;
    await expect(t.data.saveDays([day])).rejects.toMatchObject({ status: 409 });
  });

  it("simulates several dates, tracks the batch and does not repeat duplicate confirmations", async () => {
    const t = setup();
    const review = await t.data.prepareBatch(t.selections());
    expect(t.state().creations).toHaveLength(0);
    const [first, repeated] = await Promise.all([t.data.confirmBatch(review.id), t.data.confirmBatch(review.id)]);
    expect(first.simulated).toBe(true);
    expect(repeated.id).toBe(first.id);
    const result = await finished(t.data, review.id);
    expect(result.state).toBe("finished");
    expect(result.items.every((item) => item.record?.state === "confirmed")).toBe(true);
    expect(t.state().creations).toHaveLength(4);
    const reopened = t.open();
    expect((await reopened.confirmBatch(review.id)).state).toBe("finished");
    expect(await reopened.listBatches("2026-10-22", "2026-10-24")).toHaveLength(1);
    expect(await reopened.listSubmissions("2026-10-22", "2026-10-24")).toHaveLength(4);
    expect(t.state().creations).toHaveLength(4);
  });

  it("blocks the entire selection when preparation contains an invalid task", async () => {
    const t = setup();
    const day = (await t.data.readDays("2026-10-23", "2026-10-23"))[0];
    day.entries[0].issue = "9999";
    await t.data.saveDays([day]);
    const batch = await t.data.prepareBatch(t.selections());
    expect(batch.items.some((item) => item.error?.includes("23/10/2026"))).toBe(true);
    await expect(t.data.confirmBatch(batch.id)).rejects.toMatchObject({ status: 409 });
    expect(t.state().creations).toHaveLength(0);
  });

  it("validates all tasks again before the first simulated creation", async () => {
    let invalid = false;
    const t = setup({ issue: (code) => invalid && code === "9007" ? undefined : demoIssues.find((issue) => String(issue.id) === code) });
    const batch = await t.data.prepareBatch(t.selections());
    invalid = true;
    await t.data.confirmBatch(batch.id);
    const result = await finished(t.data, batch.id);
    expect(result.state).toBe("interrupted");
    expect(result.items.at(-1)?.error).toContain("24/10/2026");
    expect(t.state().creations).toHaveLength(0);
  });

  it.each(["days", "catalog"])("rejects stale %s for the entire batch", async (kind) => {
    const t = setup(), batch = await t.data.prepareBatch(t.selections());
    if (kind === "days") await t.data.saveDays(await t.data.readDays("2026-10-24", "2026-10-24"));
    else await t.data.saveActivities(await t.data.readActivities());
    await t.data.confirmBatch(batch.id);
    expect((await finished(t.data, batch.id)).state).toBe("interrupted");
    expect(t.state().creations).toHaveLength(0);
  });

  it("stops at the first rejection and preserves previous results and unsent lines", async () => {
    const t = setup({ outcome: (snapshot) => snapshot.entryId === "demo-search-review" ? "rejected" : "confirmed" });
    const batch = await t.data.prepareBatch(t.selections());
    await t.data.confirmBatch(batch.id);
    const result = await finished(t.data, batch.id);
    expect(result.state).toBe("interrupted");
    expect(result.items.map((item) => item.record?.state)).toEqual(["confirmed", "rejected", "prepared", "prepared"]);
    expect(t.state().creations).toHaveLength(1);
    expect((await t.open().readBatch(batch.id)).items[0].record?.state).toBe("confirmed");
  });

  it("reconciles a lost simulated response without retrying creation", async () => {
    const t = setup({ outcome: () => "uncertain" });
    const review = await t.data.prepareSubmission(t.selections()[0]);
    const uncertain = await t.data.actOnSubmission(review.id, "confirm");
    expect(uncertain.state).toBe("uncertain");
    expect(t.state().creations).toHaveLength(1);
    expect((await t.open().actOnSubmission(review.id, "confirm")).state).toBe("uncertain");
    expect((await t.open().actOnSubmission(review.id, "reconcile")).state).toBe("confirmed");
    expect(t.state().creations).toHaveLength(1);
  });

  it("links identical rows to the same result instead of creating them twice", async () => {
    const t = setup(), day = (await t.data.readDays("2026-10-22", "2026-10-22"))[0];
    day.entries[1] = { ...day.entries[0], id: day.entries[1].id };
    const [saved] = await t.data.saveDays([day]);
    const batch = await t.data.prepareBatch(saved.entries.map((entry) => ({ date: saved.date, entryId: entry.id, revision: saved.revision })));
    await t.data.confirmBatch(batch.id);
    const result = await finished(t.data, batch.id);
    expect(result.items.map((item) => item.record?.state)).toEqual(["confirmed", "existing"]);
    expect(result.items[0].record?.remoteId).toBe(result.items[1].record?.remoteId);
    expect(t.state().creations).toHaveLength(1);
  });

  it("does not resume an interrupted browser session or unlock an unconfirmed receipt", async () => {
    const t = setup(), batch = await t.data.prepareBatch([t.selections()[0]]);
    const state = t.state();
    state.batches[0].state = "running";
    state.submissions[0].state = "sending";
    t.values.set(demoStorageKey, JSON.stringify(state));
    const reopened = t.open();
    expect((await reopened.readBatch(batch.id)).state).toBe("interrupted");
    expect((await reopened.confirmBatch(batch.id)).state).toBe("interrupted");
    const record = await reopened.actOnSubmission(state.submissions[0].id, "reconcile");
    expect(record).toMatchObject({ state: "uncertain", verification: "missing" });
    expect(t.state().creations).toHaveLength(0);
    const day = state.days[0];
    day.entries = [];
    await expect(reopened.saveDays([day])).rejects.toMatchObject({ status: 409 });
  });

  it("keeps partial durable results when storage fails during the second creation", async () => {
    const t = setup(), batch = await t.data.prepareBatch(t.selections());
    t.storage.setItem.mockImplementation((key, raw) => {
      if (JSON.parse(raw).creations.length > 1) throw new Error("Synthetic quota failure");
      t.values.set(key, raw);
    });
    await t.data.confirmBatch(batch.id);
    expect((await finished(t.data, batch.id)).state).toBe("interrupted");
    expect(t.state().creations).toHaveLength(1);
    expect(t.state().submissions.some((record) => record.state === "sending")).toBe(true);
    expect(t.state().submissions.some((record) => record.state === "confirmed")).toBe(true);
  });

  it("expires reviews and never creates a result without a valid explicit confirmation", async () => {
    let time = new Date("2026-10-25T12:00:00Z");
    const t = setup({ now: () => time });
    const review = await t.data.prepareSubmission(t.selections()[0]);
    time = new Date("2026-10-25T12:16:00Z");
    await expect(t.data.actOnSubmission(review.id, "confirm")).rejects.toMatchObject({ status: 409 });
    expect(t.state().creations).toHaveLength(0);
  });

  it("migrates schema 1 without discarding edits and clears receipts only on explicit reset", async () => {
    const t = setup(), old: any = t.state();
    old.schemaVersion = 1;
    delete old.submissions; delete old.batches; delete old.creations;
    old.days[0].entries[0].comment = "Saved visitor edit";
    t.values.set(demoStorageKey, JSON.stringify(old));
    const reopened = t.open();
    expect((await reopened.readDays("2026-10-22", "2026-10-22"))[0].entries[0].comment).toBe("Saved visitor edit");
    expect(JSON.parse(t.values.get(demoStorageKey)!).schemaVersion).toBe(1);
    const review = await reopened.prepareSubmission(t.selections()[0]);
    await reopened.actOnSubmission(review.id, "confirm");
    expect(t.state().schemaVersion).toBe(2);
    await reopened.demo!.restoreExamples();
    expect(t.state().submissions).toEqual([]);
    expect(t.state().batches).toEqual([]);
    expect(t.state().creations).toEqual([]);
    await expect(reopened.actOnSubmission(review.id, "confirm")).rejects.toMatchObject({ status: 404 });
  });

  it("serializes restoration with active work so no worker can repopulate restored examples", async () => {
    let release!: () => void, started = false;
    const paused = new Promise<void>((resolve) => { release = resolve; });
    const t = setup({ wait: () => { started = true; return paused; } });
    const batch = await t.data.prepareBatch(t.selections());
    await t.data.confirmBatch(batch.id);
    await vi.waitFor(() => expect(started).toBe(true));
    const restoring = t.data.demo!.restoreExamples();
    release();
    await restoring;
    expect(t.state().creations).toEqual([]);
    expect(t.state().submissions).toEqual([]);
    expect(t.state().batches).toEqual([]);
    await expect(t.data.readBatch(batch.id)).rejects.toMatchObject({ status: 404 });
  });

  it("preserves a malformed schema-2 receipt instead of discarding protected history", async () => {
    const t = setup();
    const review = await t.data.prepareSubmission(t.selections()[0]);
    await t.data.actOnSubmission(review.id, "confirm");
    const damaged: any = t.state();
    damaged.submissions[0].state = "invalid-state";
    const raw = JSON.stringify(damaged);
    t.values.set(demoStorageKey, raw);
    const reopened = t.open();
    expect(reopened.demo?.notice).toContain("conteúdo foi preservado");
    await expect(reopened.prepareSubmission(t.selections()[0])).rejects.toMatchObject({ status: 409 });
    expect(t.values.get(demoStorageKey)).toBe(raw);
  });
});
