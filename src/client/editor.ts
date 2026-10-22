import {
  formatDuration,
  parseDuration,
  totalMinutes,
  type Draft,
  type DraftDay,
} from "../shared/worklogs";

export type EditorEntry = Omit<Draft, "minutes"> & { duration: string };
export interface EditorDay {
  date: string;
  revision: number;
  entries: EditorEntry[];
}
export interface EditorState {
  days: Record<string, EditorDay>;
  dirtyDates: string[];
}
export const emptyDay = (date: string): EditorDay => ({
  date,
  revision: 0,
  entries: [],
});
export const toEditor = (day: DraftDay): EditorDay => ({
  ...day,
  entries: day.entries.map(({ minutes, ...entry }) => ({
    ...entry,
    duration: minutes === null ? "" : formatDuration(minutes),
  })),
});

export function mergeLoadedDays(
  state: EditorState,
  dates: string[],
  saved: DraftDay[],
): EditorState {
  const days = { ...state.days };
  const loaded = new Map(saved.map((day) => [day.date, toEditor(day)]));
  for (const date of dates) {
    // A period refresh must never replace an edited day with an older stored copy.
    if (!state.dirtyDates.includes(date))
      days[date] = loaded.get(date) ?? emptyDay(date);
  }
  return { ...state, days };
}

export function toDraftDay(day: EditorDay): DraftDay {
  return {
    ...day,
    entries: day.entries.map(({ duration, ...entry }) => {
      const minutes = duration === "" ? null : parseDuration(duration);
      if (duration !== "" && minutes === null)
        throw new Error("Corrija as durações inválidas antes de salvar.");
      return { ...entry, minutes };
    }),
  };
}

export function daySummary(day: EditorDay): {
  total: string;
  invalid: boolean;
} {
  const invalid = day.entries.some(
    (entry) => entry.duration !== "" && parseDuration(entry.duration) === null,
  );
  try {
    return {
      total: formatDuration(
        totalMinutes(
          day.entries.map((entry) => ({
            minutes: parseDuration(entry.duration),
          })),
        ),
      ),
      invalid,
    };
  } catch {
    return { total: "—", invalid: true };
  }
}
