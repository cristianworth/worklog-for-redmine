import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoDataAccess } from "./demo-data-access";
import { createDemoExamples } from "./demo-examples";

afterEach(() => vi.unstubAllGlobals());

describe("isolated demo access", () => {
  it("runs every supported operation without HTTP or private configuration", async () => {
    const http = vi.fn(() => { throw new Error("HTTP is forbidden"); });
    const storage = vi.fn(() => { throw new Error("Memory sessions must not use global storage"); });
    vi.stubGlobal("fetch", http);
    vi.stubGlobal("localStorage", { getItem: storage, setItem: storage });
    const data = createDemoDataAccess({ today: "2026-10-25" });
    expect(data.mode).toBe("demo");
    expect(await data.readConnectionStatus()).toEqual({
      configured: false, hasApiKey: false, certificateException: false,
    });
    await data.checkConnection();
    expect(await data.readActivities()).toEqual(createDemoExamples("2026-10-25").catalog);
    const catalog = await data.saveActivities({ revision: 1, activities: [{ activityId: 901, name: "Synthetic review" }] });
    expect(await data.readActivities()).toEqual(catalog);
    const template = await data.saveDayTemplate({ revision: 1, entries: [{ issue: "", minutes: null, activity: "", comment: "" }] });
    expect(await data.readDayTemplate()).toEqual(template);
    const days = await data.saveDays([{ date: "2026-10-26", revision: 0, entries: [] }]);
    expect(await data.readDays("2026-10-26", "2026-10-26")).toEqual(days);
    expect(await data.readDays("2026-10-27", "2026-10-28")).toEqual([]);
    expect(await data.readIssue("9001", false)).toMatchObject({ id: 9001 });
    expect(await data.readIssue("9001", true)).toMatchObject({ id: 9001 });
    await expect(data.readIssue("9009", false)).rejects.toMatchObject({ status: 404 });
    expect(await data.listSubmissions("2026-10-26", "2026-10-28")).toEqual([]);
    expect(await data.listBatches("2026-10-26", "2026-10-28")).toEqual([]);
    expect(http).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
  });

  it("fails every unfinished submission path explicitly without falling back to HTTP", async () => {
    const http = vi.fn();
    vi.stubGlobal("fetch", http);
    const data = createDemoDataAccess();
    const selection = { date: "2026-10-26", entryId: "synthetic-row", revision: 1 };
    const operations = [
      () => data.prepareSubmission(selection),
      () => data.actOnSubmission("synthetic-receipt", "confirm"),
      () => data.actOnSubmission("synthetic-receipt", "verify"),
      () => data.actOnSubmission("synthetic-receipt", "reconcile"),
      () => data.prepareBatch([selection]),
      () => data.confirmBatch("synthetic-batch"),
      () => data.readBatch("synthetic-batch"),
    ];
    for (const operation of operations)
      await expect(operation()).rejects.toMatchObject({ status: 501, message: expect.stringContaining("Nenhuma hora foi enviada") });
    expect(await data.listSubmissions(selection.date, selection.date)).toEqual([]);
    expect(await data.listBatches(selection.date, selection.date)).toEqual([]);
    expect(http).not.toHaveBeenCalled();
  });

  it("preserves revisions, atomic day saves and independent session data", async () => {
    const first = createDemoDataAccess({ today: "2026-10-25" }), second = createDemoDataAccess({ today: "2026-10-25" });
    const catalog = { revision: 1, activities: [{ activityId: 901, name: "Synthetic" }] };
    await first.saveActivities(catalog);
    await expect(first.saveActivities(catalog)).rejects.toMatchObject({ status: 409 });
    const template = { revision: 1, entries: [] };
    await first.saveDayTemplate(template);
    await expect(first.saveDayTemplate(template)).rejects.toMatchObject({ status: 409 });
    const days = await first.saveDays([
      { date: "2026-10-26", revision: 0, entries: [] },
      { date: "2026-10-27", revision: 0, entries: [] },
    ]);
    await first.saveDays([days[1]]);
    await expect(first.saveDays(days)).rejects.toMatchObject({ status: 409 });
    expect((await first.readDays("2026-10-26", "2026-10-27")).map((day) => day.revision)).toEqual([1, 2]);
    days[0].entries.push({ id: "outside", issue: "", minutes: null, activity: "", comment: "" });
    expect((await first.readDays("2026-10-26", "2026-10-26"))[0].entries).toEqual([]);
    expect(await second.readActivities()).toEqual(createDemoExamples("2026-10-25").catalog);
    expect(await second.readDayTemplate()).toEqual(createDemoExamples("2026-10-25").template);
    expect(await second.readDays("2026-10-26", "2026-10-27")).toEqual([]);
  });

  it("honors aborted reads without changing session data", async () => {
    const data = createDemoDataAccess(), controller = new AbortController();
    controller.abort();
    for (const operation of [
      () => data.readActivities(controller.signal),
      () => data.readDays("2026-10-26", "2026-10-27", controller.signal),
      () => data.readDayTemplate(controller.signal),
      () => data.readIssue("9001", false, controller.signal),
      () => data.readConnectionStatus(controller.signal),
      () => data.listSubmissions("2026-10-26", "2026-10-27", controller.signal),
      () => data.listBatches("2026-10-26", "2026-10-27", controller.signal),
    ]) await expect(operation()).rejects.toMatchObject({ name: "AbortError" });
    expect((await data.readActivities()).activities).toHaveLength(3);
  });
});
