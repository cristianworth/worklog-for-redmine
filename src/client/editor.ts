import {
  formatDuration,
  isWorkDate,
  parseDurationInput,
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

export function addDurationInput(current: string, additional: string): string {
  const base = current.trim() === "" ? 0 : parseDurationInput(current);
  if (base === null) throw new Error("Corrija a duração atual antes de somar.");
  const increment = parseDurationInput(additional);
  if (increment === null) throw new Error("Use 30, 130 ou HH:MM; minutos de 00 a 59.");
  const total = base + increment;
  if (!Number.isSafeInteger(total)) throw new Error("Total de duração fora do formato suportado.");
  return formatDuration(total);
}

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
      const minutes = duration === "" ? null : parseDurationInput(duration);
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
    (entry) =>
      entry.duration !== "" && parseDurationInput(entry.duration) === null,
  );
  try {
    return {
      total: formatDuration(
        totalMinutes(
          day.entries.map((entry) => ({
            minutes: parseDurationInput(entry.duration),
          })),
        ),
      ),
      invalid,
    };
  } catch {
    return { total: "—", invalid: true };
  }
}

export function startDayWithTemplate(
  state: EditorState,
  date: string,
  entries: Draft[],
): EditorState {
  const day = state.days[date] ?? emptyDay(date);
  if (
    !isWorkDate(date) ||
    !entries.length ||
    day.revision !== 0 ||
    day.entries.length ||
    state.dirtyDates.includes(date)
  )
    return state;
  return {
    days: { ...state.days, [date]: toEditor({ ...day, entries }) },
    dirtyDates: [...state.dirtyDates, date],
  };
}
