import {
  normalizeReceipt,
  receiptTimestamp,
  submissionDraft,
  type SubmissionRecord,
} from "../shared/submissions";
import { validateDay } from "../shared/worklogs";
import { ConflictError, type openDraftStore } from "./storage";
import type { RedmineClient } from "./redmine";

function validateRecords(input: unknown): SubmissionRecord[] {
  if (!Array.isArray(input) || !input.length || input.length > 100)
    throw new Error("Informe de 1 a 100 recibos confirmados.");
  const keys = new Set<string>(),
    ids = new Set<string>();
  return input.map((record) => {
    const s = record?.snapshot;
    if (
      !s ||
      !["confirmed", "existing"].includes(record.state) ||
      typeof record.id !== "string" ||
      !record.id ||
      typeof s.scope !== "string" ||
      !s.scope ||
      !Number.isSafeInteger(record.remoteId) ||
      record.remoteId < 1 ||
      !receiptTimestamp(record.preparedAt) ||
      !receiptTimestamp(record.updatedAt)
    )
      throw new Error("O recibo confirmado é inválido.");
    for (const key of ["issueId", "projectId", "userId", "activityId"] as const)
      if (!Number.isSafeInteger(s[key]) || s[key] < 1)
        throw new Error("O recibo contém identificadores inválidos.");
    for (const key of [
      "entryId",
      "activityName",
      "comment",
      "subject",
      "projectName",
      "statusName",
    ] as const)
      if (typeof s[key] !== "string")
        throw new Error("O recibo contém campos inválidos.");
    const day = validateDay({
      date: s.date,
      revision: 0,
      entries: [
        {
          id: s.entryId,
          issue: String(s.issueId),
          minutes: s.minutes,
          activity: s.activityName,
          comment: s.comment,
        },
      ],
    });
    submissionDraft(day, s.entryId);
    const key = `${s.scope}:${record.remoteId}`;
    if (keys.has(key) || ids.has(record.id))
      throw new Error("O mesmo recibo aparece mais de uma vez na importação.");
    keys.add(key);
    ids.add(record.id);
    return normalizeReceipt({ ...record, snapshot: { ...s } });
  });
}
export function createConfirmedImportService(
  store: ReturnType<typeof openDraftStore>,
  redmine: RedmineClient,
) {
  return {
    async import(input: unknown, source = "confirmed-history") {
      const records = validateRecords(input);
      if (!/^[a-z][a-z0-9-]{0,79}$/.test(source))
        throw new Error("Origem da importação inválida.");
      const account = await redmine.account();
      // Identity is stable for this operation; every remote record is still checked separately.
      for (const record of records) {
        if (
          record.snapshot.scope !== account.scope ||
          record.snapshot.userId !== account.id
        )
          throw new ConflictError(
            "O recibo pertence a outra conta ou instalação do Redmine.",
          );
        const check = await redmine.inspectTimeEntry(
          record.remoteId!,
          record.snapshot,
        );
        if (check.result !== "matched")
          throw new ConflictError(
            "Um registro remoto não corresponde ao recibo ou não está disponível. Nenhuma importação foi gravada.",
          );
        record.remoteCreatedAt = record.remoteCreatedAt ?? check.createdAt;
        record.lastCheckedAt = new Date().toISOString();
        record.verification = "matched";
        record.message =
          "Apropriação confirmada incorporada ao banco local. Nenhuma criação foi solicitada ao Redmine.";
      }
      return store.importConfirmed(records, source);
    },
  };
}
