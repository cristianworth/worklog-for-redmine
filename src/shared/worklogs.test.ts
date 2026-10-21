import { describe, expect, it } from "vitest";
import {
  formatDuration,
  isWorkDate,
  parseDuration,
  totalMinutes,
  validateDay,
} from "./worklogs";

describe("duration totals", () => {
  it("adds 01:30 and 00:45 without rounding", () => {
    expect(
      formatDuration(
        totalMinutes([
          { minutes: parseDuration("01:30") },
          { minutes: parseDuration("00:45") },
        ]),
      ),
    ).toBe("02:15");
  });
  it("keeps totals above 24 hours without wrapping to a new day", () => {
    expect(
      formatDuration(
        totalMinutes([{ minutes: 23 * 60 + 45 }, { minutes: 90 }]),
      ),
    ).toBe("25:15");
  });
  it("excludes empty durations and keeps zero valid as a draft", () => {
    expect(
      totalMinutes([{ minutes: null }, { minutes: 0 }, { minutes: 45 }]),
    ).toBe(45);
    expect(parseDuration("00:00")).toBe(0);
  });
  it.each(["01:60", "-01:30", "1.5", "abc", "", "1:5", "9007199254740991:00"])(
    "rejects malformed duration %s",
    (input) => {
      expect(parseDuration(input)).toBeNull();
    },
  );
});

describe("calendar dates and draft boundaries", () => {
  it("rejects impossible dates without timezone conversion", () => {
    expect(isWorkDate("2026-02-30")).toBe(false);
    expect(isWorkDate("2024-02-29")).toBe(true);
    expect(isWorkDate("2026-10-21")).toBe(true);
  });
  it("rejects duplicate row identities and invalid minute values", () => {
    const entry = {
      id: "one",
      issue: "",
      minutes: 90,
      activity: "",
      comment: "",
    };
    expect(() =>
      validateDay({ date: "2026-10-21", revision: 0, entries: [entry, entry] }),
    ).toThrow();
    for (const minutes of [-1, 1.5, "90"]) {
      expect(() =>
        validateDay({
          date: "2026-10-21",
          revision: 0,
          entries: [{ ...entry, minutes }],
        }),
      ).toThrow();
    }
  });
});
