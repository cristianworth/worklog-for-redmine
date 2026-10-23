import { totalMinutes, type Draft } from "./worklogs";

export type TemplateEntry = Omit<Draft, "id">;
export interface DayTemplate {
  revision: number;
  entries: TemplateEntry[];
}

export function validateDayTemplate(value: unknown): DayTemplate {
  const template = value as Partial<DayTemplate> | null;
  if (
    !template ||
    typeof template !== "object" ||
    !Number.isSafeInteger(template.revision) ||
    template.revision! < 0 ||
    !Array.isArray(template.entries) ||
    template.entries.length > 100
  )
    throw new Error("Informe um modelo válido com até 100 linhas.");
  const entries = template.entries.map((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.issue !== "string" ||
      typeof entry.activity !== "string" ||
      typeof entry.comment !== "string" ||
      !(
        entry.minutes === null ||
        (Number.isSafeInteger(entry.minutes) && entry.minutes >= 0)
      )
    )
      throw new Error("Confira os campos e as durações das linhas do modelo.");
    const issue = entry.issue.trim();
    if (
      issue &&
      (!/^[1-9]\d*$/.test(issue) || !Number.isSafeInteger(Number(issue)))
    )
      throw new Error(
        "Use um código de tarefa inteiro positivo ou deixe-o vazio para preencher no dia.",
      );
    // A template carries only editable defaults, never dates, identifiers or submission receipts.
    return {
      issue,
      minutes: entry.minutes,
      activity: entry.activity,
      comment: entry.comment,
    };
  });
  totalMinutes(entries);
  return { revision: template.revision!, entries };
}

export function instantiateDayTemplate(
  template: DayTemplate,
  makeId: () => string,
): Draft[] {
  return validateDayTemplate(template).entries.map((entry) => ({
    ...entry,
    id: makeId(),
  }));
}
