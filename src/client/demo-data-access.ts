import { validateActivityCatalog } from "../shared/activities";
import { validateDayTemplate } from "../shared/day-template";
import { validateDays, validatePeriod } from "../shared/worklogs";
import { DataAccessError, type WorklogDataAccess } from "./data-access";
import { createDemoStore, type DemoStorage } from "./demo-store";
import { createDemoExamples, demoIssues, demoStartDate } from "./demo-examples";
import { localDate } from "./period";

interface DemoOptions {
  storage?: DemoStorage;
  today?: string;
}

export function createBrowserDemoDataAccess(): WorklogDataAccess {
  let storage: DemoStorage | undefined;
  try { storage = window.localStorage; } catch { /* An explicit session-only notice remains visible. */ }
  return createDemoDataAccess({ storage });
}

export function createDemoDataAccess(options: DemoOptions = {}): WorklogDataAccess {
  const examples = () => createDemoExamples(options.today ?? localDate());
  const store = createDemoStore(examples(), options.storage);
  const check = (signal?: AbortSignal) => signal?.throwIfAborted();
  const unsupported = async (): Promise<never> => {
    throw new DataAccessError(
      "O fluxo de envios simulados ainda não está disponível nesta etapa da demo. Nenhuma hora foi enviada.", 501,
    );
  };
  return {
    mode: "demo",
    demo: {
      get exampleStartDate() { return demoStartDate(store.read().anchorDate); },
      get persistent() { return store.persistent; },
      get notice() { return store.notice; },
      async restoreExamples() { store.restore(examples()); },
    },
    async readActivities(signal) {
      check(signal);
      return store.read().catalog;
    },
    async saveActivities(value) {
      const next = validateActivityCatalog(value);
      return store.update((current) => {
        if (next.revision !== current.catalog.revision)
          throw new DataAccessError("O catálogo foi alterado. Preserve suas edições e recarregue o catálogo antes de salvar.", 409);
        return { ...current, catalog: { ...next, revision: next.revision + 1 } };
      }).catalog;
    },
    async readDays(from, to, signal) {
      check(signal);
      validatePeriod(from, to);
      return store.read().days
        .filter((day) => day.date >= from && day.date <= to)
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    async saveDays(values) {
      const pending = validateDays(values);
      const saved = store.update((current) => {
        const days = new Map(current.days.map((day) => [day.date, day]));
        for (const day of pending)
          if ((days.get(day.date)?.revision ?? 0) !== day.revision)
            throw new DataAccessError("Um dia foi alterado. Nenhum dia desta operação foi salvo. Suas edições continuam na tela.", 409);
        for (const day of pending) days.set(day.date, { ...day, revision: day.revision + 1 });
        return { ...current, days: [...days.values()] };
      });
      const dates = new Set(pending.map((day) => day.date));
      return saved.days.filter((day) => dates.has(day.date));
    },
    async readDayTemplate(signal) {
      check(signal);
      return store.read().template;
    },
    async saveDayTemplate(value) {
      const next = validateDayTemplate(value);
      return store.update((current) => {
        if (next.revision !== current.template.revision)
          throw new DataAccessError("O modelo foi alterado. Preserve suas edições e recarregue o modelo antes de salvar.", 409);
        return { ...current, template: { ...next, revision: next.revision + 1 } };
      }).template;
    },
    async readIssue(code, _refresh, signal) {
      check(signal);
      const issue = demoIssues.find((issue) => String(issue.id) === code);
      if (!issue) throw new DataAccessError("Tarefa fictícia não encontrada. Use 9001, 9004 ou 9007 nesta demonstração.", 404);
      return structuredClone(issue);
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
