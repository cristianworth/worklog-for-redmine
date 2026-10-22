import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarRange,
  Database,
  FlaskConical,
  ChevronDown,
  LockKeyhole,
  Check,
  FilePlus2,
  LoaderCircle,
  Save,
  Settings2,
  Upload,
  WifiOff,
} from "lucide-react";
import { validateDays, type DraftDay } from "../shared/worklogs";
import {
  dateRange,
  normalizePeriod,
  changeEndMode,
  endDate,
  localDate,
  periodStorageKey,
  restorePeriod,
  shortDate,
  type PeriodPreference,
} from "./period";
import {
  daySummary,
  emptyDay,
  mergeLoadedDays,
  toDraftDay,
  toEditor,
  type EditorEntry,
  type EditorState,
} from "./editor";
import { DaySection } from "./DaySection";
import { RedmineSettings } from "./RedmineSettings";
import { ActivityCatalogEditor } from "./ActivityCatalogEditor";
import {
  validateActivityCatalog,
  type ActivityCatalog,
} from "../shared/activities";

function initialPeriod(): PeriodPreference {
  try {
    return restorePeriod(
      JSON.parse(localStorage.getItem(periodStorageKey) ?? "null"),
    );
  } catch {
    return restorePeriod(null);
  }
}

async function readDays(response: Response): Promise<DraftDay[]> {
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Não foi possível acessar os rascunhos.");
  return validateDays(data.days);
}

export function App() {
  const [period, setPeriod] = useState(initialPeriod);
  const [filters, setFilters] = useState(period);
  const [today, setToday] = useState(localDate);
  const [editor, setEditor] = useState<EditorState>({
    days: {},
    dirtyDates: [],
  });
  const [visibleDates, setVisibleDates] = useState<string[]>([]);
  const [activeRange, setActiveRange] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [message, setMessage] = useState("");
  const [preferenceNotice, setPreferenceNotice] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [catalog, setCatalog] = useState<ActivityCatalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [catalogDirty, setCatalogDirty] = useState(false);
  const [catalogRetry, setCatalogRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setCatalogError("");
    fetch("/api/activities", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error || "Não foi possível carregar o catálogo.",
          );
        const loaded = validateActivityCatalog(data);
        if (!controller.signal.aborted)
          setCatalog((current) =>
            !current || loaded.revision >= current.revision ? loaded : current,
          );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setCatalogError(
            "Não foi possível carregar o catálogo. Seus rascunhos continuam disponíveis. Confira se o servidor foi reiniciado após a atualização e tente recarregar o catálogo.",
          );
      });
    return () => controller.abort();
  }, [catalogRetry]);
  const [retry, setRetry] = useState(0);
  const effectiveEnd = endDate(period, today);

  useEffect(() => {
    if (saving) return;
    const refresh = () => setToday(localDate());
    refresh();
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [saving]);

  useEffect(() => {
    let next: PeriodPreference;
    try {
      next = normalizePeriod(filters, today);
      setFilterError("");
    } catch (error) {
      setFilterError(
        error instanceof Error ? error.message : "Informe um período válido.",
      );
      return;
    }
    if (saving) return;
    const timer = window.setTimeout(() => {
      setPeriod((current) =>
        current.from === next.from &&
        current.to === next.to &&
        current.endMode === next.endMode
          ? current
          : next,
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filters, today, saving]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);
    setError("");
    let dates: string[];
    try {
      dates = dateRange(period.from, effectiveEnd);
    } catch (error) {
      setLoading(false);
      setLoadFailed(true);
      setError(error instanceof Error ? error.message : "Período inválido.");
      return;
    }
    fetch(`/api/days?from=${period.from}&to=${effectiveEnd}`, {
      signal: controller.signal,
    })
      .then(readDays)
      .then((saved) => {
        if (controller.signal.aborted) return;
        if (
          saved.some((day) => day.date < period.from || day.date > effectiveEnd)
        )
          throw new Error("A resposta não corresponde ao período solicitado.");
        setEditor((current) => mergeLoadedDays(current, dates, saved));
        setVisibleDates(dates);
        setActiveRange({ from: period.from, to: effectiveEnd });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(error.message || "Não foi possível abrir o período.");
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [period.from, effectiveEnd, retry]);

  useEffect(() => {
    try {
      localStorage.setItem(periodStorageKey, JSON.stringify(period));
      setPreferenceNotice("");
    } catch {
      setPreferenceNotice(
        "Este navegador não permitiu lembrar o período. Seus rascunhos continuam no banco local.",
      );
    }
  }, [period]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (editor.dirtyDates.length || catalogDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editor.dirtyDates.length, catalogDirty]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  function changeEntries(date: string, entries: EditorEntry[]) {
    setEditor((current) => ({
      days: {
        ...current.days,
        [date]: { ...(current.days[date] ?? emptyDay(date)), entries },
      },
      dirtyDates: current.dirtyDates.includes(date)
        ? current.dirtyDates
        : [...current.dirtyDates, date],
    }));
    setMessage("");
    setError("");
  }

  async function copyCode(key: string, issue: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error();
      await navigator.clipboard.writeText(issue);
      setCopied(key);
      setMessage(`Código ${issue} copiado.`);
    } catch {
      setError(
        "Não foi possível copiar o código. Selecione o número e copie manualmente.",
      );
    }
  }

  async function save() {
    if (!editor.dirtyDates.length || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const pending = editor.dirtyDates.map((date) =>
        toDraftDay(editor.days[date]),
      );
      const saved = await readDays(
        await fetch("/api/days", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days: pending }),
        }),
      );
      const expected = new Map(
        pending.map((day) => [day.date, day.revision + 1]),
      );
      if (
        saved.length !== pending.length ||
        saved.some((day) => expected.get(day.date) !== day.revision)
      )
        throw new Error(
          "Não foi possível confirmar o salvamento de todos os dias. Suas edições continuam na tela.",
        );
      setEditor((current) => ({
        days: {
          ...current.days,
          ...Object.fromEntries(saved.map((day) => [day.date, toEditor(day)])),
        },
        dirtyDates: current.dirtyDates.filter((date) => !expected.has(date)),
      }));
      setMessage(
        `${saved.length === 1 ? "Rascunhos de 1 dia salvos" : `Rascunhos de ${saved.length} dias salvos`} neste computador.`,
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar. Suas alterações continuam na tela.",
      );
    } finally {
      setSaving(false);
    }
  }

  function showPending() {
    const dates = [...editor.dirtyDates].sort();
    const next: PeriodPreference = {
      from: dates[0],
      to: dates[dates.length - 1],
      endMode: "fixed",
    };
    setFilters(next);
  }

  const dirtyCount = editor.dirtyDates.length;
  const hiddenCount = editor.dirtyDates.filter(
    (date) => !visibleDates.includes(date),
  ).length;
  const invalidDates = editor.dirtyDates.filter(
    (date) => daySummary(editor.days[date]).invalid,
  );
  const blocked = loading || saving || loadFailed;
  const canSave = dirtyCount > 0 && !blocked && !invalidDates.length;
  const selectedEnd = endDate(filters, today);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <a
            className="brand"
            href="/"
            onClick={(event) => {
              if (dirtyCount) event.preventDefault();
            }}
          >
            <span className="brand-mark" aria-hidden="true">
              w.
            </span>
            <span>
              Worklog <small>for Redmine</small>
            </span>
          </a>
          <div className="header-actions">
            <span className="local-badge">
              <Database size={14} aria-hidden="true" />
              Banco local
            </span>
            <button
              className="button quiet"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen(!settingsOpen)}
            >
              <Settings2 size={17} aria-hidden="true" />
              Configurações
              {catalogDirty && (
                <small className="catalog-pending">Não salvo</small>
              )}
            </button>
          </div>
        </div>
      </header>
      <main>
        <div className="settings-area" hidden={!settingsOpen}>
          {settingsOpen && (
            <RedmineSettings onClose={() => setSettingsOpen(false)} />
          )}
          <ActivityCatalogEditor
            catalog={catalog}
            loadError={catalogError}
            onSaved={setCatalog}
            onDirtyChange={setCatalogDirty}
            onReload={() => setCatalogRetry((current) => current + 1)}
          />
        </div>
        <div className="page-heading">
          <div>
            <p className="eyebrow">SEUS DIAS, EM ORDEM</p>
            <h1>Apontamentos</h1>
            <p className="intro">
              Preencha no seu ritmo. Salve agora, envie depois.
            </p>
          </div>
          <span className="future-control model-control">
            <button className="button secondary" disabled>
              <FilePlus2 size={16} aria-hidden="true" />
              Modelo do dia
            </button>
            <small>Em breve</small>
          </span>
        </div>

        <section
          className="data-context"
          aria-label="Modo de uso e armazenamento"
        >
          <details className="data-details">
            <summary>
              <Database size={18} aria-hidden="true" />
              <span>
                <strong>Modo local</strong>
                <small>Rascunhos no banco deste computador</small>
              </span>
              <ChevronDown size={15} aria-hidden="true" />
            </summary>
            <div className="data-description">
              <p>
                <strong>Seus dados:</strong> salvar grava os rascunhos no banco
                local. Eles continuam disponíveis após reiniciar a aplicação.
              </p>
              <p>
                <strong>Futura demo pública:</strong> usará exemplos fictícios e
                armazenamento no navegador de cada visitante, separado deste
                banco. Não acessará seus apontamentos nem o Redmine real.
              </p>
            </div>
          </details>
          <span className="future-control demo-control">
            <button
              className="button quiet"
              disabled
              aria-describedby="demo-status"
            >
              <FlaskConical size={16} aria-hidden="true" />
              Abrir demonstração
            </button>
            <small id="demo-status">Em breve</small>
          </span>
        </section>

        <section className="period-panel" aria-label="Período de trabalho">
          <div className="period-title">
            <CalendarRange size={18} aria-hidden="true" />
            <h2>Período de trabalho</h2>
            <span className="period-hint">Todos os dias, em sequência</span>
          </div>
          <div className="period-controls">
            <label className="date-field" htmlFor="period-start">
              De
              <input
                id="period-start"
                type="date"
                value={filters.from}
                disabled={saving}
                onChange={(event) =>
                  setFilters({ ...filters, from: event.target.value })
                }
              />
            </label>
            <ArrowRight className="range-arrow" size={16} aria-hidden="true" />
            <label className="date-field" htmlFor="period-end">
              Até
              <input
                id="period-end"
                type="date"
                value={selectedEnd}
                disabled={saving || filters.endMode === "today"}
                onChange={(event) =>
                  setFilters({ ...filters, to: event.target.value })
                }
              />
            </label>
            <label className="today-toggle">
              <input
                type="checkbox"
                checked={filters.endMode === "today"}
                disabled={saving}
                onChange={(event) =>
                  setFilters((current) =>
                    changeEndMode(
                      current,
                      event.target.checked ? "today" : "fixed",
                      today,
                    ),
                  )
                }
              />
              <span>
                Até hoje<small>Acompanha a data atual</small>
              </span>
            </label>
            <span className="period-auto" role="status">
              {loading ? (
                <>
                  <LoaderCircle className="spin" size={14} aria-hidden="true" />
                  Atualizando período…
                </>
              ) : (
                <>
                  <Check size={14} aria-hidden="true" />
                  Atualização automática
                </>
              )}
            </span>
          </div>
          {filterError && (
            <p className="field-error" role="alert">
              {filterError}
            </p>
          )}
        </section>

        <div className="draft-toolbar">
          <span className="draft-explanation">
            <span className="draft-dot" />
            Rascunhos locais
            <span className="explanation-detail">
              Salvar não envia horas ao Redmine.
            </span>
          </span>
          <div className="send-control">
            <button
              className="button send-button"
              disabled
              aria-describedby="send-status"
            >
              <Upload size={18} aria-hidden="true" />
              Enviar ao Redmine
              <LockKeyhole size={13} aria-hidden="true" />
            </button>
            <span id="send-status">
              <strong>Em breve</strong> · revisão antes do envio
            </span>
          </div>
        </div>
        {preferenceNotice && <p className="notice">{preferenceNotice}</p>}
        {hiddenCount > 0 && (
          <div className="notice pending-notice">
            <span>
              {hiddenCount === 1
                ? "Há 1 dia alterado fora do período exibido. Ele também será salvo."
                : `Há ${hiddenCount} dias alterados fora do período exibido. Eles também serão salvos.`}
            </span>
            <button
              className="text-button"
              disabled={saving || loading}
              onClick={showPending}
            >
              Ver dias alterados
            </button>
          </div>
        )}
        {invalidDates.length > 0 && (
          <div className="error-banner" role="alert">
            <AlertCircle size={17} aria-hidden="true" />
            <span>
              Revise as durações em {invalidDates.map(shortDate).join(", ")}{" "}
              antes de salvar.
            </span>
            {hiddenCount > 0 && (
              <button
                className="text-button"
                disabled={saving || loading}
                onClick={showPending}
              >
                Abrir alterações
              </button>
            )}
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <AlertCircle size={17} aria-hidden="true" />
            <span>{error}</span>
            {loadFailed && (
              <button
                className="button secondary"
                disabled={loading}
                onClick={() => setRetry((value) => value + 1)}
              >
                Tentar novamente
              </button>
            )}
          </div>
        )}
        <div className="days-caption">
          <span>
            {activeRange
              ? `${shortDate(activeRange.from)} — ${shortDate(activeRange.to)}`
              : "Seus rascunhos"}
          </span>
          <span>
            {loading ? (
              <>
                <LoaderCircle className="spin" size={14} aria-hidden="true" />
                Carregando período…
              </>
            ) : (
              "Duração em horas:minutos"
            )}
          </span>
        </div>
        <div className="days-list" aria-busy={loading}>
          {visibleDates.map((date) => (
            <DaySection
              key={date}
              day={editor.days[date] ?? emptyDay(date)}
              activities={catalog?.activities ?? []}
              dirty={editor.dirtyDates.includes(date)}
              disabled={blocked}
              today={today}
              copied={copied}
              onChange={(entries) => changeEntries(date, entries)}
              onCopy={copyCode}
            />
          ))}
        </div>
        {!visibleDates.length && loading && (
          <div className="initial-loading" role="status">
            <LoaderCircle className="spin" size={22} aria-hidden="true" />
            Abrindo seus dias…
          </div>
        )}
        <div
          className={`save-bar ${dirtyCount || saving ? "has-pending" : ""}`}
        >
          <div className="save-status" aria-live="polite">
            <span className={`save-status-icon ${dirtyCount ? "pending" : ""}`}>
              {saving ? (
                <LoaderCircle className="spin" size={18} aria-hidden="true" />
              ) : dirtyCount ? (
                <Save size={18} aria-hidden="true" />
              ) : (
                <Check size={18} aria-hidden="true" />
              )}
            </span>
            <div>
              <strong>
                {saving
                  ? "Salvando rascunhos…"
                  : dirtyCount
                    ? `${dirtyCount} ${dirtyCount === 1 ? "dia com alterações não salvas" : "dias com alterações não salvas"}`
                    : loading
                      ? "Carregando rascunhos…"
                      : loadFailed
                        ? "Não foi possível abrir o período"
                        : message || "Tudo salvo neste computador"}
              </strong>
              <p>
                {dirtyCount
                  ? "Salvar inclui todos os dias alterados, mesmo fora do período."
                  : "Nenhum apontamento foi enviado ao Redmine."}
              </p>
            </div>
          </div>
          <button className="button primary" disabled={!canSave} onClick={save}>
            {saving ? (
              <LoaderCircle className="spin" size={17} aria-hidden="true" />
            ) : (
              <Save size={17} aria-hidden="true" />
            )}
            {saving ? "Salvando…" : "Salvar rascunhos"}
          </button>
        </div>
        {message && dirtyCount > 0 && (
          <p className="copy-feedback" role="status">
            {message}
          </p>
        )}
        <footer className="page-footer">
          <span>Worklog for Redmine</span>
          <span>
            <WifiOff size={13} aria-hidden="true" />
            Organização local · sem envio automático
          </span>
        </footer>
      </main>
    </div>
  );
}
