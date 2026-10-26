import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserDemoDataAccess, createDemoDataAccess } from "./demo-data-access";
import { createDemoExamples } from "./demo-examples";
import { demoStorageKey } from "./demo-store";

function setup() {
  const values = new Map<string, string>([
    ["worklog.period", "local-preference"], ["another-app", "unrelated-data"],
  ]);
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
  };
  const open = (today = "2026-10-25") => createDemoDataAccess({ storage, today });
  return { values, storage, open };
}
afterEach(() => vi.unstubAllGlobals());

describe("visitor demo persistence and recovery", () => {
  it("places new examples on the previous three weekdays even on weekends", () => {
    for (const today of ["2026-10-24", "2026-10-25", "2026-10-26"])
      expect(createDemoExamples(today).days.map((day) => day.date)).toEqual(["2026-10-21", "2026-10-22", "2026-10-23"]);
  });
  it("preserves an older visitor's weekend data without rewriting the snapshot", async () => {
    const t = setup();
    t.open();
    const previous = JSON.parse(t.values.get(demoStorageKey)!);
    previous.days[2].date = "2026-10-24";
    previous.days[2].entries[0].comment = "Saved fictional weekend history";
    const raw = JSON.stringify(previous);
    t.values.set(demoStorageKey, raw);
    expect(await t.open().readDays("2026-10-24", "2026-10-24")).toEqual([previous.days[2]]);
    expect(t.values.get(demoStorageKey)).toBe(raw);
  });
  it("seeds recent examples once and keeps their dates and data across later visits", async () => {
    const t = setup(), first = t.open();
    const initial = JSON.parse(t.values.get(demoStorageKey)!);
    expect(initial.days.map((day: { date: string }) => day.date)).toEqual(["2026-10-21", "2026-10-22", "2026-10-23"]);
    expect(new Set(initial.catalog.activities.map((activity: { activityId: number }) => activity.activityId)).size).toBe(3);
    expect(initial.catalog.activities.every((activity: object) => !("projectId" in activity))).toBe(true);
    expect(first.demo?.persistent).toBe(true);
    expect(first.demo?.exampleStartDate).toBe("2026-10-21");
    expect(await first.readIssue("9004", false)).toMatchObject({ id: 9004 });
    expect(await first.readIssue("9007", false)).toMatchObject({ id: 9007 });
    expect((await first.readDays("2026-10-25", "2026-10-25"))).toEqual([]);
    const second = t.open("2026-11-04");
    expect(await second.readDays("2026-10-21", "2026-10-23")).toEqual(initial.days);
    expect(JSON.parse(t.values.get(demoStorageKey)!).anchorDate).toBe("2026-10-25");
    expect(second.demo?.exampleStartDate).toBe("2026-10-21");
    expect(t.storage.setItem).toHaveBeenCalledTimes(1);
  });

  it("persists only explicit saves and keeps catalog, days and template independent", async () => {
    const t = setup(), first = t.open();
    const catalog = await first.readActivities();
    catalog.activities[0].name = "Alteração fictícia";
    expect((await t.open().readActivities()).activities[0].name).toBe("Desenvolvimento");
    const savedCatalog = await first.saveActivities(catalog);
    const template = await first.readDayTemplate();
    template.entries[0].minutes = 45;
    const savedTemplate = await first.saveDayTemplate(template);
    const days = await first.readDays("2026-10-21", "2026-10-23");
    days[0].entries[0].minutes = 150;
    const savedDays = await first.saveDays([days[0]]);
    const reopened = t.open();
    expect(await reopened.readActivities()).toEqual(savedCatalog);
    expect(await reopened.readDayTemplate()).toEqual(savedTemplate);
    expect(await reopened.readDays("2026-10-21", "2026-10-21")).toEqual(savedDays);
    expect(await reopened.readDays("2026-10-22", "2026-10-23")).toEqual(days.slice(1));
    expect(t.storage.getItem.mock.calls.every(([key]) => key === demoStorageKey)).toBe(true);
    expect(t.storage.setItem.mock.calls.every(([key]) => key === demoStorageKey)).toBe(true);
    expect(t.values.get("worklog.period")).toBe("local-preference");
    expect(t.values.get("another-app")).toBe("unrelated-data");
  });

  it("detects stale edits across tabs and saves all selected days or none", async () => {
    const t = setup(), first = t.open(), second = t.open();
    const catalog = await first.readActivities();
    await first.saveActivities(catalog);
    await expect(second.saveActivities(catalog)).rejects.toMatchObject({ status: 409 });
    const template = await first.readDayTemplate();
    await second.saveDayTemplate(template);
    await expect(first.saveDayTemplate(template)).rejects.toMatchObject({ status: 409 });
    const days = await first.readDays("2026-10-21", "2026-10-23");
    await second.saveDays([days[1]]);
    const before = t.values.get(demoStorageKey);
    await expect(first.saveDays(days)).rejects.toMatchObject({ status: 409 });
    expect(t.values.get(demoStorageKey)).toBe(before);
    expect((await first.readDays("2026-10-21", "2026-10-23")).map((day) => day.revision)).toEqual([1, 2, 1]);
  });

  it("preserves the prior snapshot and edits when the browser rejects a write", async () => {
    const t = setup(), data = t.open();
    const pending = await data.readDays("2026-10-21", "2026-10-23");
    pending[0].entries[0].comment = "Edição que não deve sumir";
    const before = t.values.get(demoStorageKey);
    t.storage.setItem.mockImplementation(() => { throw new DOMException("Quota exceeded", "QuotaExceededError"); });
    await expect(data.saveDays(pending)).rejects.toMatchObject({ status: 503 });
    expect(data.demo?.notice).toContain("dados anteriores foram preservados");
    expect(t.values.get(demoStorageKey)).toBe(before);
    expect(pending[0].entries[0].comment).toBe("Edição que não deve sumir");
    await expect(data.demo!.restoreExamples()).rejects.toMatchObject({ status: 503 });
    expect(t.values.get(demoStorageKey)).toBe(before);
  });

  it.each([
    "not-json",
    JSON.stringify({ schemaVersion: 999 }),
    JSON.stringify({ ...createDemoExamples("2026-10-25"), days: [{ date: "invalid" }] }),
  ])("preserves invalid or future data until explicit restoration: %s", async (raw) => {
    const t = setup();
    t.values.set(demoStorageKey, raw);
    const data = t.open();
    expect(data.demo?.notice).toContain("salvar está bloqueado");
    expect(t.storage.setItem).not.toHaveBeenCalled();
    await expect(data.saveActivities(await data.readActivities())).rejects.toMatchObject({ status: 409 });
    expect(t.values.get(demoStorageKey)).toBe(raw);
    await data.demo!.restoreExamples();
    expect(data.demo?.persistent).toBe(true);
    expect(data.demo?.notice).toBeNull();
    expect(JSON.parse(t.values.get(demoStorageKey)!).schemaVersion).toBe(2);
    expect(t.values.get("another-app")).toBe("unrelated-data");
  });

  it("restores only demo examples with fresh dates and invalidates old saved revisions", async () => {
    const t = setup(), first = t.open();
    const previous = await first.readActivities();
    const changed = await first.saveActivities({ ...previous, activities: [] });
    const nextVisit = t.open("2026-11-01");
    await nextVisit.demo!.restoreExamples();
    const restored = t.open("2026-11-02");
    expect((await restored.readActivities()).activities).toHaveLength(3);
    expect((await restored.readActivities()).revision).toBeGreaterThan(changed.revision);
    await expect(first.saveActivities(previous)).rejects.toMatchObject({ status: 409 });
    expect(await restored.readDays("2026-10-21", "2026-10-23")).toEqual([]);
    expect(await restored.readDays("2026-10-28", "2026-10-30")).toHaveLength(3);
    expect(restored.demo?.exampleStartDate).toBe("2026-10-28");
    expect((await restored.readDayTemplate()).entries).toHaveLength(2);
    expect(t.values.get("worklog.period")).toBe("local-preference");
    expect(t.values.get("another-app")).toBe("unrelated-data");
  });

  it("shows an explicit memory-only session when storage cannot be accessed or initialized", async () => {
    for (const failRead of [true, false]) {
      const storage = {
        getItem: () => { if (failRead) throw new Error("Blocked"); return null; },
        setItem: () => { throw new Error("Blocked"); },
      };
      const data = createDemoDataAccess({ storage, today: "2026-10-25" });
      expect(data.demo?.persistent).toBe(false);
      expect(data.demo?.notice).toContain("temporários");
      const catalog = await data.readActivities();
      await data.saveActivities({ ...catalog, activities: [] });
      expect((await data.readActivities()).activities).toEqual([]);
      expect((await createDemoDataAccess({ storage, today: "2026-10-25" }).readActivities()).activities).toHaveLength(3);
    }
    vi.stubGlobal("window", { get localStorage() { throw new Error("SecurityError"); } });
    expect(createBrowserDemoDataAccess().demo?.persistent).toBe(false);
  });

  it("does not overwrite storage that becomes invalid while a page is open", async () => {
    const t = setup(), data = t.open();
    t.values.set(demoStorageKey, "damaged-later");
    await expect(data.saveDayTemplate(await data.readDayTemplate())).rejects.toMatchObject({ status: 409 });
    expect(t.values.get(demoStorageKey)).toBe("damaged-later");
    expect(data.demo?.notice).toContain("conteúdo foi preservado");
  });
});
