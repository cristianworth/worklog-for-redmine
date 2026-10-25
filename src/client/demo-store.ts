import { validateActivityCatalog, type ActivityCatalog } from "../shared/activities";
import { validateDayTemplate, type DayTemplate } from "../shared/day-template";
import { isWorkDate, validateDays, type DraftDay } from "../shared/worklogs";
import { DataAccessError } from "./data-access";

export const demoStorageKey = "worklog-for-redmine.demo.state";
export type DemoStorage = Pick<Storage, "getItem" | "setItem">;
export interface DemoState {
  schemaVersion: 1;
  anchorDate: string;
  catalog: ActivityCatalog;
  days: DraftDay[];
  template: DayTemplate;
}

function parseState(raw: string): DemoState {
  const value = JSON.parse(raw);
  if (!value || value.schemaVersion !== 1 ||
    typeof value.anchorDate !== "string" || !isWorkDate(value.anchorDate))
    throw new Error("Unsupported demo data format");
  return {
    schemaVersion: 1,
    anchorDate: value.anchorDate,
    catalog: validateActivityCatalog(value.catalog),
    days: validateDays(value.days),
    template: validateDayTemplate(value.template),
  };
}

export function createDemoStore(initial: DemoState, storage?: DemoStorage) {
  let state = structuredClone(initial);
  let mode: "browser" | "memory" | "recovery" = storage ? "browser" : "memory";
  let notice: string | null = storage ? null
    : "O armazenamento do navegador está indisponível. Os dados ficam só nesta página e serão perdidos ao recarregar.";
  const recover = () => {
    mode = "recovery";
    notice = "Não foi possível ler os dados salvos da demo: o conteúdo pode estar inválido, usar uma versão não suportada ou ter o acesso bloqueado. O conteúdo foi preservado; salvar está bloqueado. Use Restaurar exemplos para recomeçar.";
  };
  if (storage) {
    let raw: string | null;
    try {
      raw = storage.getItem(demoStorageKey);
    } catch {
      raw = null;
      mode = "memory";
      notice = "Não foi possível acessar os dados da demo neste navegador. Esta página usa dados temporários; recarregar descarta as alterações.";
    }
    if (mode === "browser") {
      if (raw !== null) {
        try { state = parseState(raw); } catch { recover(); }
      } else {
        try { storage.setItem(demoStorageKey, JSON.stringify(state)); } catch {
          mode = "memory";
          notice = "O navegador não permitiu guardar os exemplos. Esta página usa dados temporários; recarregar descarta as alterações.";
        }
      }
    }
  }

  function read(): DemoState {
    if (mode === "browser" && storage) {
      try {
        const raw = storage.getItem(demoStorageKey);
        if (raw === null) throw new Error("Demo data removed in another tab");
        state = parseState(raw);
      } catch {
        recover();
      }
    }
    return structuredClone(state);
  }

  function write(next: DemoState, restoring = false) {
    if (mode === "recovery" && !restoring)
      throw new DataAccessError(notice!, 409);
    if (storage && (mode === "browser" || restoring)) {
      try {
        // One snapshot keeps multi-day saves all-or-nothing if setItem fails.
        storage.setItem(demoStorageKey, JSON.stringify(next));
      } catch {
        notice = "Não foi possível salvar os dados da demo. O navegador pode estar sem espaço ou com acesso bloqueado. As edições continuam na tela; os dados anteriores foram preservados.";
        throw new DataAccessError(notice, 503);
      }
      mode = "browser";
      notice = null;
    }
    state = structuredClone(next);
  }

  return {
    get persistent() { return mode === "browser"; },
    get notice() { return notice; },
    read,
    update(change: (current: DemoState) => DemoState) {
      const current = read();
      if (mode === "recovery") throw new DataAccessError(notice!, 409);
      const next = change(current);
      write(next);
      return structuredClone(next);
    },
    restore(examples: DemoState) {
      const current = read();
      const revision = Math.max(current.catalog.revision, current.template.revision,
        ...current.days.map((day) => day.revision)) + 1;
      write({
        ...examples,
        catalog: { ...examples.catalog, revision },
        template: { ...examples.template, revision },
        days: examples.days.map((day) => ({ ...day, revision })),
      }, true);
    },
  };
}
