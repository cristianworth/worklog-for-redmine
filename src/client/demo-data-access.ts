import { validateActivityCatalog, type ActivityCatalog } from "../shared/activities";
import { validateDayTemplate, type DayTemplate } from "../shared/day-template";
import { validateDays, validatePeriod, type DraftDay } from "../shared/worklogs";
import { DataAccessError, type IssueDetails, type WorklogDataAccess } from "./data-access";

// Session-only state proves the boundary; visitor persistence belongs to P7-B.
export function createDemoDataAccess(): WorklogDataAccess {
  let catalog: ActivityCatalog = { revision: 0, activities: [] };
  let template: DayTemplate = { revision: 0, entries: [] };
  const days = new Map<string, DraftDay>();
  const check = (signal?: AbortSignal) => signal?.throwIfAborted();
  const unsupported = async (): Promise<never> => {
    throw new DataAccessError(
      "O fluxo de envios simulados ainda não está disponível nesta etapa da demo. Nenhuma hora foi enviada.",
      501,
    );
  };
  return {
    mode: "demo",
    async readActivities(signal) {
      check(signal);
      return structuredClone(catalog);
    },
    async saveActivities(value) {
      const next = validateActivityCatalog(value);
      if (next.revision !== catalog.revision)
        throw new DataAccessError("O catálogo foi alterado. Preserve suas edições e recarregue o catálogo antes de salvar.", 409);
      catalog = { ...next, revision: next.revision + 1 };
      return structuredClone(catalog);
    },
    async readDays(from, to, signal) {
      check(signal);
      validatePeriod(from, to);
      return structuredClone([...days.values()]
        .filter((day) => day.date >= from && day.date <= to)
        .sort((a, b) => a.date.localeCompare(b.date)));
    },
    async saveDays(values) {
      const pending = validateDays(values);
      for (const day of pending)
        if ((days.get(day.date)?.revision ?? 0) !== day.revision)
          throw new DataAccessError("Um dia foi alterado. Nenhum dia desta operação foi salvo. Suas edições continuam na tela.", 409);
      const saved = pending.map((day) => ({ ...day, revision: day.revision + 1 }));
      for (const day of saved) days.set(day.date, day);
      return structuredClone(saved);
    },
    async readDayTemplate(signal) {
      check(signal);
      return structuredClone(template);
    },
    async saveDayTemplate(value) {
      const next = validateDayTemplate(value);
      if (next.revision !== template.revision)
        throw new DataAccessError("O modelo foi alterado. Preserve suas edições e recarregue o modelo antes de salvar.", 409);
      template = { ...next, revision: next.revision + 1 };
      return structuredClone(template);
    },
    async readIssue(code, _refresh, signal): Promise<IssueDetails> {
      check(signal);
      if (code !== "9001") throw new DataAccessError("Tarefa fictícia não encontrada. Nesta simulação mínima, use 9001.", 404);
      return {
        id: 9001, subject: "Tarefa fictícia para conferir o isolamento",
        status: { id: 1, name: "Aberta" },
        project: { id: 9002, name: "Projeto fictício" },
      };
    },
    async readConnectionStatus(signal) {
      check(signal);
      return { configured: false, hasApiKey: false, certificateException: false };
    },
    async checkConnection() {},
    async listSubmissions(from, to, signal) {
      check(signal);
      validatePeriod(from, to);
      return [];
    },
    async listBatches(from, to, signal) {
      check(signal);
      validatePeriod(from, to);
      return [];
    },
    prepareSubmission: unsupported,
    actOnSubmission: unsupported,
    prepareBatch: unsupported,
    readBatch: unsupported,
    confirmBatch: unsupported,
  };
}
