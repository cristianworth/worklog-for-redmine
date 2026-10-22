import { describe, expect, it } from "vitest";
import {
  daySummary,
  mergeLoadedDays,
  toDraftDay,
  toEditor,
  type EditorState,
} from "./editor";

const saved = {
  date: "2026-10-21",
  revision: 1,
  entries: [
    {
      id: "sample",
      issue: "1001",
      minutes: 90,
      activity: "Revisão",
      comment: "Exemplo fictício.",
    },
  ],
};
describe("editing across periods", () => {
  it("preserves edited days when a period refresh returns an older stored copy", () => {
    const edited = {
      ...toEditor(saved),
      entries: [{ ...toEditor(saved).entries[0], duration: "00:45" }],
    };
    const state: EditorState = {
      days: { [saved.date]: edited },
      dirtyDates: [saved.date],
    };
    const next = mergeLoadedDays(
      state,
      [saved.date, "2026-10-22"],
      [{ ...saved, revision: 2 }],
    );
    expect(next.days[saved.date]).toEqual(edited);
    expect(next.days["2026-10-22"].entries).toEqual([]);
    expect(next.dirtyDates).toEqual([saved.date]);
    const hidden = mergeLoadedDays(next, ["2026-10-23"], []);
    expect(hidden.days[saved.date]).toEqual(edited);
    expect(
      hidden.dirtyDates.map((date) => toDraftDay(hidden.days[date]))[0]
        .entries[0].minutes,
    ).toBe(45);
  });
  it("refreshes clean days without marking them dirty", () => {
    const state: EditorState = {
      days: { [saved.date]: toEditor(saved) },
      dirtyDates: [],
    };
    expect(
      mergeLoadedDays(state, [saved.date], [{ ...saved, revision: 2 }]).days[
        saved.date
      ].revision,
    ).toBe(2);
    expect(
      mergeLoadedDays(state, [saved.date], []).days[saved.date].entries,
    ).toEqual([]);
  });
  it("keeps incomplete rows but refuses malformed durations instead of silently clearing them", () => {
    const day = toEditor(saved);
    day.entries[0].duration = "";
    expect(toDraftDay(day).entries[0].minutes).toBeNull();
    day.entries[0].duration = "00:60";
    expect(daySummary(day).invalid).toBe(true);
    expect(() => toDraftDay(day)).toThrow();
  });
});
