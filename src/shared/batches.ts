import type { SubmissionRecord } from "./submissions";
import { isWorkDate } from "./worklogs";

export interface BatchSelection {
  date: string;
  entryId: string;
  revision: number;
}
export interface BatchItem {
  selection: BatchSelection;
  record: SubmissionRecord | null;
  error: string | null;
}
export interface SubmissionBatch {
  id: string;
  state: "prepared" | "running" | "finished" | "interrupted";
  items: BatchItem[];
  createdAt: string;
  updatedAt: string;
  message: string;
}
export function validateBatchSelection(value: unknown): BatchSelection[] {
  if (!Array.isArray(value) || !value.length || value.length > 100)
    throw new Error("Selecione de 1 a 100 linhas salvas por lote.");
  const keys = new Set<string>();
  return value.map((item) => {
    if (
      !item ||
      !isWorkDate(item.date) ||
      typeof item.entryId !== "string" ||
      !item.entryId ||
      !Number.isSafeInteger(item.revision) ||
      item.revision < 1
    )
      throw new Error("A seleção contém uma linha ou revisão inválida.");
    const key = `${item.date}:${item.entryId}`;
    if (keys.has(key))
      throw new Error("Uma linha aparece mais de uma vez na seleção.");
    keys.add(key);
    return { date: item.date, entryId: item.entryId, revision: item.revision };
  });
}
export function canConfirmBatch(batch: SubmissionBatch): boolean {
  return (
    batch.state === "prepared" &&
    batch.items.some((i) => i.record?.state === "prepared") &&
    batch.items.every(
      (i) =>
        !i.error &&
        i.record &&
        ["prepared", "confirmed", "existing"].includes(i.record.state),
    )
  );
}
