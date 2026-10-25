import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoDataAccess } from "./demo-data-access";
import type { WorklogDataAccess } from "./data-access";
import { WorklogDataProvider, useWorklogData } from "./WorklogDataProvider";
import { App } from "./App";
import { RedmineSettings } from "./RedmineSettings";
import { createHttpDataAccess } from "./http-data-access";

afterEach(() => vi.unstubAllGlobals());

describe("replaceable worklog data access", () => {
  it("separates period preferences and hides credential instructions in demo mode", () => {
    const getItem = vi.fn(() => null);
    vi.stubGlobal("localStorage", { getItem });
    const demo = createDemoDataAccess();
    const local = createHttpDataAccess();
    const renderApp = (value: WorklogDataAccess) => renderToStaticMarkup(
      <WorklogDataProvider value={value}><App /></WorklogDataProvider>,
    );
    expect(renderApp(demo)).toContain("dados e envios simulados");
    expect(getItem).toHaveBeenLastCalledWith("worklog.demo.period");
    expect(renderApp(local)).toContain("Banco local");
    expect(getItem).toHaveBeenLastCalledWith("worklog.period");
    const renderSettings = (value: WorklogDataAccess) => renderToStaticMarkup(
      <WorklogDataProvider value={value}><RedmineSettings onClose={() => {}} /></WorklogDataProvider>,
    );
    expect(renderSettings(demo)).not.toContain(".env");
    expect(renderSettings(demo)).toContain("Conferir simulação");
    expect(renderSettings(local)).toContain(".env");
  });
  it("provides all four operations with synthetic memory data and no HTTP", async () => {
    const http = vi.fn(() => {
      throw new Error("HTTP must not be called");
    });
    vi.stubGlobal("fetch", http);
    const memory = createDemoDataAccess();
    let received: WorklogDataAccess | undefined;
    function Consumer() {
      received = useWorklogData();
      return null;
    }
    renderToStaticMarkup(
      <WorklogDataProvider value={memory}><Consumer /></WorklogDataProvider>,
    );
    expect(received).toBe(memory);
    const data = received!;
    const initialCatalog = await data.readActivities();
    expect(initialCatalog.activities).toHaveLength(3);
    const saved = await data.saveActivities({
      revision: initialCatalog.revision,
      activities: [{ activityId: 902, name: "Synthetic planning" }],
    });
    expect(await data.readActivities()).toEqual(saved);
    expect(await data.readDays("2026-10-26", "2026-10-28")).toEqual([]);
    const stored = await data.saveDays([
      { date: "2026-10-26", revision: 0, entries: [] },
    ]);
    expect(await data.readDays("2026-10-26", "2026-10-28")).toEqual(stored);
    expect(await data.readDays("2026-10-27", "2026-10-28")).toEqual([]);
    saved.activities[0].name = "Changed outside the store";
    expect((await data.readActivities()).activities[0].name).toBe(
      "Synthetic planning",
    );
    expect(http).not.toHaveBeenCalled();
  });

  it("requires explicit configuration instead of falling back to HTTP", () => {
    const http = vi.fn();
    vi.stubGlobal("fetch", http);
    function Consumer() {
      useWorklogData();
      return null;
    }
    expect(() => renderToStaticMarkup(<Consumer />)).toThrow(
      "O acesso aos dados não foi configurado.",
    );
    expect(http).not.toHaveBeenCalled();
  });
});
