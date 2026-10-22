import { describe, expect, it } from "vitest";
import { dateRange, endDate, localDate, restorePeriod } from "./period";

describe("calendar period", () => {
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
      "2026-10-21",
    );
  });
  it("recovers from malformed or impossible saved preferences", () => {
    const now = new Date(2026, 9, 22, 12);
    expect(
      restorePeriod({ from: "oops", to: "2026-10-22", endMode: "fixed" }, now),
    ).toEqual({ from: "2026-10-16", to: "2026-10-22", endMode: "today" });
  });
});
