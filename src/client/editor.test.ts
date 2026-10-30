import { describe, expect, it } from "vitest";
import {
  addDurationInput,
  missingEntryFields,
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

describe("required draft fields", () => {
  it("identifies every missing field, including whitespace, without mutating the draft", () => {
    const entry = { id: "fictional", issue: " ", duration: "", activity: "\t", comment: "\n" };
    const before = { ...entry };
    expect(missingEntryFields(entry)).toEqual({
      issue: "Informe o número da tarefa.", duration: "Informe a duração.",
      activity: "Selecione uma atividade.", comment: "Informe a observação.",
    });
    expect(entry).toEqual(before);
  });
  it("clears each missing-field error when supplied and accepts zero minutes as informed", () => {
    const entry = { id: "fictional", issue: "9001", duration: "0", activity: "Revisão", comment: "Exemplo fictício" };
    expect(missingEntryFields(entry)).toEqual({});
    expect(missingEntryFields({ ...entry, comment: " " })).toEqual({ comment: "Informe a observação." });
  });
  it("keeps incomplete drafts saveable independently of required-for-submission feedback", () => {
    const day = toEditor(saved);
    day.entries[0] = { ...day.entries[0], issue: "", duration: "", activity: "", comment: "" };
    expect(Object.keys(missingEntryFields(day.entries[0]))).toHaveLength(4);
    expect(toDraftDay(day).entries[0].minutes).toBeNull();
  });
});

describe("adding duration to a draft", () => {
  it.each([
    ["1:00", "30", "01:30"],
    ["01:00", "030", "01:30"],
    ["01:45", "30", "02:15"],
    ["01:00", "130", "02:30"],
    ["01:00", "1:30", "02:30"],
    ["", "30", "00:30"],
    ["23:45", "30", "24:15"],
  ])("adds %s and %s as minutes, producing %s", (current, additional, expected) => {
    expect(addDurationInput(current, additional)).toBe(expected);
  });
  it("refuses a malformed base or increment instead of silently replacing the current duration", () => {
    expect(() => addDurationInput("01:60", "30")).toThrow("Corrija a duração atual");
    for (const increment of ["", "60", "-30", "0.5", "1:70", "abc"])
      expect(() => addDurationInput("01:00", increment)).toThrow("Use 30, 130 ou HH:MM");
  });
  it("refuses integer overflow and keeps the strict HH:MM storage contract", () => {
    expect(() => addDurationInput("150119987579016:31", "1")).toThrow("Total de duração");
    const day = toEditor(saved);
    day.entries[0].duration = addDurationInput(day.entries[0].duration, "030");
    expect(toDraftDay(day).entries[0].minutes).toBe(120);
  });
});
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
