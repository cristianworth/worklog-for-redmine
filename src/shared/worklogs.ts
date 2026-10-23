export interface Draft {
  id: string;
  issue: string;
  minutes: number | null;
  activity: string;
  comment: string;
}

export interface DraftDay {
  date: string;
  revision: number;
  entries: Draft[];
}

export function parseDuration(value: string): number | null {
  if (!/^\d+:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  const total = hours * 60 + minutes;
  return minutes < 60 && Number.isSafeInteger(total) ? total : null;
}

// Compact input is HHMM, not decimal hours; the stored/API duration remains integer minutes.
export function parseDurationInput(value: string): number | null {
  const input = value.trim();
  if (!/^\d+$/.test(input)) return parseDuration(input);
  const hours = input.length > 2 ? input.slice(0, -2) : "0";
  const minutes = input.slice(-2).padStart(2, "0");
  return parseDuration(`${hours}:${minutes}`);
}

export function formatDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

export function totalMinutes(entries: Pick<Draft, "minutes">[]): number {
  const total = entries.reduce((sum, entry) => sum + (entry.minutes ?? 0), 0);
  if (!Number.isSafeInteger(total))
    throw new Error("Total de duração fora do formato suportado.");
  return total;
}

export function isWorkDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function validateDay(value: unknown): DraftDay {
  const day = value as Partial<DraftDay> | null;
  if (
    !day ||
    typeof day !== "object" ||
    typeof day.date !== "string" ||
    !isWorkDate(day.date) ||
    !Number.isSafeInteger(day.revision) ||
    day.revision! < 0 ||
    !Array.isArray(day.entries)
  ) {
    throw new Error("Data ou formato do dia inválido.");
  }
  const ids = new Set<string>();
  for (const entry of day.entries) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.id !== "string" ||
      !entry.id ||
      ids.has(entry.id) ||
      typeof entry.issue !== "string" ||
      typeof entry.activity !== "string" ||
      typeof entry.comment !== "string" ||
      !(
        entry.minutes === null ||
        (Number.isSafeInteger(entry.minutes) && entry.minutes >= 0)
      )
    ) {
      throw new Error("Formato de rascunho inválido.");
    }
    ids.add(entry.id);
  }
  totalMinutes(day.entries);
  return {
    date: day.date,
    revision: day.revision!,
    entries: day.entries.map(({ id, issue, minutes, activity, comment }) => ({
      id,
      issue,
      minutes,
      activity,
      comment,
    })),
  };
}

export function validateDays(value: unknown): DraftDay[] {
  if (!Array.isArray(value)) throw new Error("Lista de dias inválida.");
  const days = value.map(validateDay);
  if (new Set(days.map((day) => day.date)).size !== days.length) {
    throw new Error("O mesmo dia aparece mais de uma vez.");
  }
  return days;
}

export function validatePeriod(
  from: unknown,
  to: unknown,
): { from: string; to: string } {
  if (
    typeof from !== "string" ||
    typeof to !== "string" ||
    !isWorkDate(from) ||
    !isWorkDate(to) ||
    from > to
  ) {
    throw new Error(
      "Informe um período válido, com início anterior ou igual ao fim.",
    );
  }
  return { from, to };
}
