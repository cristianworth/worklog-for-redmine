import { describe, expect, it } from "vitest";
import {
  dateRange,
  workdayRange,
  endDate,
  localDate,
  restorePeriod,
  changeEndMode,
  normalizePeriod,
} from "./period";

describe("calendar period", () => {
  it("displays weekdays across month boundaries and omits weekend-only periods", () => {
    expect(workdayRange("2026-10-23", "2026-10-26")).toEqual(["2026-10-23", "2026-10-26"]);
    expect(workdayRange("2026-10-24", "2026-10-25")).toEqual([]);
    expect(workdayRange("2026-10-30", "2026-11-03")).toEqual(["2026-10-30", "2026-11-02", "2026-11-03"]);
    expect(workdayRange("2026-10-26", "2026-10-26")).toEqual(["2026-10-26"]);
    expect(() => workdayRange("2026-10-26", "2026-10-23")).toThrow();
  });
  it("includes both Wednesdays and the weekend without a fixed workweek", () => {
    expect(dateRange("2026-10-14", "2026-10-21")).toEqual([
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
    ]);
    expect(dateRange("2026-10-21", "2026-10-21")).toEqual(["2026-10-21"]);
    expect(dateRange("2024-02-28", "2024-03-01")).toEqual([
      "2024-02-28",
      "2024-02-29",
      "2024-03-01",
    ]);
    expect(() => dateRange("2026-10-22", "2026-10-21")).toThrow();
  });
  it("keeps the chosen start and follows today after reopening", () => {
    const stored = { from: "2026-10-14", to: "2026-10-21", endMode: "today" };
    const now = new Date(2026, 9, 22, 0, 5);
    const restored = restorePeriod(stored, now);
    expect(restored.from).toBe("2026-10-14");
    expect(restored.endMode).toBe("today");
    expect(localDate(now)).toBe("2026-10-22");
    expect(endDate(restored, localDate(now))).toBe("2026-10-22");
    expect(endDate({ ...restored, endMode: "fixed" }, localDate(now))).toBe(
      "2026-10-22",
    );
  });
  it("recovers from malformed or impossible saved preferences", () => {
    const now = new Date(2026, 9, 22, 12);
    expect(
      restorePeriod({ from: "oops", to: "2026-10-22", endMode: "fixed" }, now),
    ).toEqual({ from: "2026-10-16", to: "2026-10-22", endMode: "today" });
  });
});

describe("predictable end-mode transitions", () => {
  it("normalizes an old hidden end date without changing the chosen start", () => {
    const restored = restorePeriod(
      { from: "2026-10-14", to: "2000-01-06", endMode: "today" },
      new Date(2026, 9, 22),
    );
    expect(restored).toEqual({
      from: "2026-10-14",
      to: "2026-10-22",
      endMode: "today",
    });
    expect(changeEndMode(restored, "fixed", "2026-10-22").to).toBe(
      "2026-10-22",
    );
  });
  it("freezes the visible current date when switching off today after midnight", () => {
    const old = {
      from: "2026-10-14",
      to: "2026-10-22",
      endMode: "today" as const,
    };
    expect(changeEndMode(old, "fixed", "2026-10-23")).toEqual({
      from: old.from,
      to: "2026-10-23",
      endMode: "fixed",
    });
  });
  it("preserves a fixed historical period explicitly selected by the user", () => {
    const fixed = {
      from: "2000-01-05",
      to: "2000-01-06",
      endMode: "fixed" as const,
    };
    expect(restorePeriod(fixed, new Date(2026, 9, 22))).toEqual(fixed);
    expect(normalizePeriod(fixed, "2026-10-22")).toEqual(fixed);
    expect(changeEndMode(fixed, "today", "2026-10-22").to).toBe("2026-10-22");
  });
  it.each([
    { from: "", to: "2026-10-22", endMode: "fixed" },
    { from: "2026-10-21", to: "", endMode: "fixed" },
    { from: "2026-10-23", to: "2026-10-22", endMode: "fixed" },
    { from: "2026-02-30", to: "2026-10-22", endMode: "today" },
  ])("rejects an unfinished or invalid automatic-query period %j", (period) => {
    expect(() =>
      normalizePeriod(
        period as Parameters<typeof normalizePeriod>[0],
        "2026-10-22",
      ),
    ).toThrow();
  });
});
