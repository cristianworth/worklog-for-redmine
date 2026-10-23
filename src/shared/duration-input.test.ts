import { describe, expect, it } from "vitest";
import { formatDuration, parseDuration, parseDurationInput } from "./worklogs";
import {
  daySummary,
  toDraftDay,
  toEditor,
  type EditorDay,
} from "../client/editor";

describe("compact hours and minutes input", () => {
  it.each([
    ["30", 30, "00:30"],
    ["030", 30, "00:30"],
    ["130", 90, "01:30"],
    ["0130", 90, "01:30"],
    ["800", 480, "08:00"],
    ["1", 1, "00:01"],
    ["0", 0, "00:00"],
    ["59", 59, "00:59"],
    ["100", 60, "01:00"],
    ["2400", 1440, "24:00"],
    ["2530", 1530, "25:30"],
    ["01:30", 90, "01:30"],
    ["1:30", 90, "01:30"],
    [" 030 ", 30, "00:30"],
  ])(
    "interprets %s as %i minutes and formats %s",
    (input, minutes, formatted) => {
      expect(parseDurationInput(input)).toBe(minutes);
      expect(formatDuration(parseDurationInput(input)!)).toBe(formatted);
    },
  );
  it.each([
    "",
    " ",
    "60",
    "90",
    "160",
    "1:60",
    "01:30:45",
    "-30",
    "1.5",
    "1:5",
    "abc",
    "1e2",
    "1 30",
    "900719925474099100",
  ])("does not silently repair invalid input %s", (input) =>
    expect(parseDurationInput(input)).toBeNull(),
  );
  it("keeps the transport's existing HH:MM parser strict", () => {
    expect(parseDuration("130")).toBeNull();
    expect(parseDuration("01:30")).toBe(90);
  });
  it("totals and saves compact input before blur with no loss of minutes", () => {
    const day: EditorDay = {
      date: "2026-10-22",
      revision: 0,
      entries: ["030", "130", "00:45"].map((duration, i) => ({
        id: `row-${i}`,
        issue: "1001",
        duration,
        activity: "Revisão",
        comment: "Synthetic work",
      })),
    };
    expect(daySummary(day)).toEqual({ total: "02:45", invalid: false });
    const saved = toDraftDay(day);
    expect(saved.entries.map((entry) => entry.minutes)).toEqual([30, 90, 45]);
    expect(toEditor(saved).entries.map((entry) => entry.duration)).toEqual([
      "00:30",
      "01:30",
      "00:45",
    ]);
    const invalid = {
      ...day,
      entries: [{ ...day.entries[0], duration: "160" }],
    };
    expect(daySummary(invalid).invalid).toBe(true);
    expect(() => toDraftDay(invalid)).toThrow(/durações inválidas/);
  });
});
