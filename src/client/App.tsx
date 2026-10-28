import { DayTemplateEditor } from "./DayTemplateEditor";
import {
  instantiateDayTemplate,
  type DayTemplate,
} from "../shared/day-template";
import { BatchReview } from "./BatchReview";
import { canSelectEntry, pendingEntries } from "./submission-selection";
import type { BatchSelection, SubmissionBatch } from "../shared/batches";
import { SubmissionReview } from "./SubmissionReview";
import { publicDemoUrl, repositoryUrl } from "./app-links";
import {
  acceptReceipt,
  type SubmissionRecord,
} from "../shared/submissions";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarRange,
  Database,
  FlaskConical,
  ChevronDown,
  Check,
  FilePlus2,
  LoaderCircle,
  Save,
  Settings2,
  Upload,
  WifiOff,
} from "lucide-react";
import {
  workdayRange,
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
  startDayWithTemplate,
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
import type { ActivityCatalog } from "../shared/activities";
import { useWorklogData } from "./WorklogDataProvider";
import { DemoControls } from "./DemoControls";
import worklogMark from "./assets/worklog-mark.svg?no-inline";

function initialPeriod(storageKey: string, exampleStartDate?: string, reset = false): PeriodPreference {
  const fallback = exampleStartDate
    ? restorePeriod({ from: exampleStartDate, to: localDate(), endMode: "today" })
    : restorePeriod(null);
  if (reset) return fallback;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    return stored === null ? fallback : restorePeriod(stored);
  } catch {
    return fallback;
  }
}

export function App() {
  const [restoration, setRestoration] = useState(0);
  return <WorklogApp key={restoration} resetPeriod={restoration > 0}
    onDemoRestored={() => setRestoration((current) => current + 1)} />;
}

function WorklogApp({ resetPeriod, onDemoRestored }: {
  resetPeriod: boolean;
  onDemoRestored(): void;
}) {
  const data = useWorklogData();
  const storageKey = data.mode === "demo" ? "worklog.demo.period" : periodStorageKey;
  const saveLocation = data.mode === "demo"
    ? data.demo?.persistent ? "neste navegador" : "nesta sessão de demonstração"
    : "neste computador";
  const [period, setPeriod] = useState(() => initialPeriod(storageKey, data.demo?.exampleStartDate, resetPeriod));
  const [filters, setFilters] = useState(period);
  const [today, setToday] = useState(localDate);
  const [editor, setEditor] = useState<EditorState>({
    days: {},
    dirtyDates: [],
  });
  const [visibleDates, setVisibleDates] = useState<string[]>([]);
  const [dayCollapseOverrides, setDayCollapseOverrides] = useState<Partial<Record<string, boolean>>>({});
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
  const [templateOpen, setTemplateOpen] = useState(false);
  const [dayTemplate, setDayTemplate] = useState<DayTemplate | null>(null);
  const [templateDirty, setTemplateDirty] = useState(false);
  const [catalog, setCatalog] = useState<ActivityCatalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [catalogDirty, setCatalogDirty] = useState(false);
  const [catalogRetry, setCatalogRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setCatalogError("");
    data
      .readActivities(controller.signal)
      .then((loaded) => {
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
  }, [data, catalogRetry]);
  const [retry, setRetry] = useState(0);
  const effectiveEnd = endDate(period, today);
  const [selection, setSelection] = useState<
    { date: string; entryId: string }[]
  >([]);
  const [batchReview, setBatchReview] = useState<{
    entries?: BatchSelection[];
    batchId?: string;
  } | null>(null);
  const [recentBatches, setRecentBatches] = useState<SubmissionBatch[]>([]);
  const [review, setReview] = useState<{
    date: string;
    entryId: string;
    revision: number;
  } | null>(null);
  const [receipts, setReceipts] = useState<Record<string, SubmissionRecord>>(
    {},
  );
  const [receiptsLoaded, setReceiptsLoaded] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [receiptRetry, setReceiptRetry] = useState(0);
  const receiveRecord = useCallback(
    (record: SubmissionRecord) =>
      setReceipts((current) => ({
        ...current,
        [`${record.snapshot.date}:${record.snapshot.entryId}`]: record,
      })),
    [],
  );
  const receiveBatch = useCallback((batch: SubmissionBatch) => {
    setRecentBatches((current) =>
      [batch, ...current.filter((value) => value.id !== batch.id)].slice(0, 20),
    );
    setReceipts((current) => {
      const next = { ...current };
      for (const item of batch.items)
        if (item.record) {
          const record = item.record,
            key = `${record.snapshot.date}:${record.snapshot.entryId}`,
            previous = next[key];
          if (acceptReceipt(previous, record)) next[key] = record;
        }
      return next;
    });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setReceiptsLoaded(false);
    setReceiptError("");
    setSelection([]);
    Promise.all([
      data.listSubmissions(period.from, effectiveEnd, controller.signal),
      data.listBatches(period.from, effectiveEnd, controller.signal),
    ])
      .then(([submissions, batches]) => {
        if (controller.signal.aborted) return;
        setReceipts((current) => {
          const next = { ...current };
          for (const record of submissions) {
            const key = `${record.snapshot.date}:${record.snapshot.entryId}`,
              previous = next[key];
            if (acceptReceipt(previous, record)) next[key] = record;
          }
          return next;
        });
        setRecentBatches(batches);
        setReceiptsLoaded(true);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setReceiptError(
            "Não foi possível carregar os resultados de envio. Confira se o servidor foi reiniciado após a atualização e recarregue os resultados antes de editar ou enviar.",
          );
      });
    return () => controller.abort();
  }, [data, period.from, effectiveEnd, receiptRetry]);
  const canSelect = (date: string, entryId: string) => canSelectEntry(editor, receipts, date, entryId);
  const visiblePending = pendingEntries(visibleDates, editor, receipts);
  const canReview =
    !!selection.length &&
    selection.length <= 100 &&
    receiptsLoaded &&
    !loading &&
    !saving &&
    selection.every((item) => canSelect(item.date, item.entryId));
  function pendingDay(date: string) {
    return pendingEntries([date], editor, receipts);
  }
  function openBatch(entries: { date: string; entryId: string }[]) {
    if (
      !entries.length ||
      entries.length > 100 ||
      !receiptsLoaded ||
      loading ||
      saving ||
      entries.some((item) => !canSelect(item.date, item.entryId))
    )
      return;
    setBatchReview({
      entries: entries.map((item) => ({
        ...item,
        revision: editor.days[item.date].revision,
      })),
    });
  }
  function toggleDay(date: string) {
    const pending = pendingDay(date);
    const all =
      pending.length > 0 &&
      pending.every((item) =>
        selection.some((s) => s.date === date && s.entryId === item.entryId),
      );
    setSelection((current) => [
      ...current.filter((item) => item.date !== date),
      ...(all ? [] : pending),
    ]);
  }
  function openReview(date: string, entryId: string) {
    const day = editor.days[date];
    if (day) setReview({ date, entryId, revision: day.revision });
  }

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
      dates = workdayRange(period.from, effectiveEnd);
    } catch (error) {
      setLoading(false);
      setLoadFailed(true);
      setError(error instanceof Error ? error.message : "Período inválido.");
      return;
    }
    data
      .readDays(period.from, effectiveEnd, controller.signal)
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
  }, [data, period.from, effectiveEnd, retry]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(period));
      setPreferenceNotice("");
    } catch {
      setPreferenceNotice(
        data.mode === "demo"
          ? "O navegador não permitiu lembrar o período. Confira o aviso de armazenamento da demonstração."
          : "Este navegador não permitiu lembrar o período. Seus rascunhos continuam no banco local.",
      );
    }
  }, [period, storageKey]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (editor.dirtyDates.length || catalogDirty || templateDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editor.dirtyDates.length, catalogDirty, templateDirty]);

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

  function useDayTemplate(date: string) {
    if (!dayTemplate || blocked) return;
    const entries = instantiateDayTemplate(dayTemplate, () =>
      crypto.randomUUID(),
    );
    setEditor((current) => startDayWithTemplate(current, date, entries));
    setMessage(
      `Modelo aplicado em ${shortDate(date)}. Confira as linhas e salve os rascunhos.`,
    );
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
      const saved = await data.saveDays(pending);
      const expected = new Map(
        pending.map((day) => [day.date, day.revision + 1]),
      );
      setEditor((current) => ({
        days: {
          ...current.days,
          ...Object.fromEntries(saved.map((day) => [day.date, toEditor(day)])),
        },
        dirtyDates: current.dirtyDates.filter((date) => !expected.has(date)),
      }));
      setMessage(
        `${saved.length === 1 ? "Rascunhos de 1 dia salvos" : `Rascunhos de ${saved.length} dias salvos`} ${saveLocation}.`,
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
      <a className="skip-link" href="#main-content">Pular para os apontamentos</a>
      {data.mode === "demo" && <div className="demo-mode">
        <strong>Demonstração · dados e envios simulados</strong>
        <span>Nenhuma conexão com o Redmine</span>
      </div>}
      <header className="app-header">
        <div className="header-inner">
          <a
            className="brand"
            href={import.meta.env.BASE_URL}
            onClick={(event) => {
              if (dirtyCount || catalogDirty || templateDirty)
                event.preventDefault();
            }}
          >
            <img className="brand-mark" src={worklogMark} width="44" height="44" alt="" />
            <span>
              Worklog <small>for Redmine</small>
            </span>
          </a>
          <div className="header-actions">
            <span className="local-badge">
              <Database size={14} aria-hidden="true" />
              {data.mode === "demo" ? "Demonstração isolada" : "Banco local"}
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
      {review && (
        <SubmissionReview
          {...review}
          onClose={() => {
            setReview(null);
            setSelection([]);
          }}
          onRecord={receiveRecord}
        />
      )}
      {batchReview && (
        <BatchReview
          {...batchReview}
          onClose={() => {
            setBatchReview(null);
            setSelection([]);
            setReceiptRetry((value) => value + 1);
          }}
          onBatch={receiveBatch}
        />
      )}
      <main id="main-content" tabIndex={-1}>
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
            <h1>Apontamentos</h1>
            <p className="intro">
              Preencha no seu ritmo. Salve agora, envie depois.
            </p>
          </div>
          <button
            className="button secondary model-control"
            aria-expanded={templateOpen}
            aria-controls="day-template-area"
            onClick={() => setTemplateOpen(!templateOpen)}
          >
            <FilePlus2 size={16} aria-hidden="true" />
            Modelo do dia
            {templateDirty && (
              <small className="catalog-pending">Não salvo</small>
            )}
          </button>
        </div>

        <div id="day-template-area" hidden={!templateOpen}>
          <DayTemplateEditor
            activities={catalog?.activities ?? []}
            onTemplate={setDayTemplate}
            onDirtyChange={setTemplateDirty}
            onClose={() => setTemplateOpen(false)}
          />
        </div>

        <section
          className="data-context"
          aria-label="Modo de uso e armazenamento"
        >
          <details className="data-details">
            <summary>
              <Database size={18} aria-hidden="true" />
              <span>
                <strong>{data.mode === "demo" ? "Demonstração isolada" : "Modo local"}</strong>
                <small>{data.mode === "demo"
                  ? data.demo?.persistent ? "Exemplos salvos somente neste navegador" : "Dados temporários ou aguardando recuperação"
                  : "Rascunhos no banco deste computador"}</small>
              </span>
              <ChevronDown size={15} aria-hidden="true" />
            </summary>
            <div className="data-description">
              {data.mode === "demo" ? <p>
                Os exemplos são fictícios e não acessam o Redmine. Salve suas edições para recuperá-las neste navegador.
                A revisão e a confirmação produzem somente recibos fictícios neste navegador.
              </p> : <>
              <p>
                <strong>Seus dados:</strong> salvar grava os rascunhos no banco
                local. Eles continuam disponíveis após reiniciar a aplicação.
              </p>
              <p>
                <strong>Demo pública:</strong> usa exemplos fictícios e
                armazenamento no navegador de cada visitante. Você pode
                experimentá-la sem compartilhar os apontamentos deste computador.
              </p>
              </>}
            </div>
          </details>
          {data.mode !== "demo" && <span className="demo-control">
            <a
              className="button quiet"
              href={publicDemoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-describedby="demo-status"
            >
              <FlaskConical size={16} aria-hidden="true" />
              Abrir demonstração
            </a>
            <small id="demo-status">Exemplos fictícios · abre em outra aba</small>
          </span>}
        </section>

        {data.demo && <DemoControls session={data.demo} onRestored={onDemoRestored} />}
        {data.demo && resetPeriod && <p className="notice" role="status">Exemplos restaurados. Os dados e as edições anteriores da demonstração foram descartados.</p>}

        <section className="period-panel" aria-label="Período de trabalho">
          <div className="period-title">
            <CalendarRange size={18} aria-hidden="true" />
            <h2>Período de trabalho</h2>
            <span className="period-hint">Segunda a sexta, em sequência</span>
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
              className="button secondary"
              disabled={loading || saving || loadFailed || !receiptsLoaded || !visiblePending.length}
              onClick={() => setSelection(visiblePending)}
              aria-describedby="send-status"
            >
              Selecionar todos
            </button>
            {!!selection.length && (
              <button className="text-button" onClick={() => setSelection([])}>
                Limpar seleção
              </button>
            )}
            <button
              className="button send-button"
              disabled={!canReview}
              onClick={() => openBatch(selection)}
              aria-describedby="send-status"
            >
              <Upload size={18} aria-hidden="true" />
              {data.mode === "demo" ? "Simular selecionados" : "Enviar selecionados"}
              {selection.length ? ` (${selection.length})` : ""}
            </button>
            <span id="send-status">
              {selection.length > 100
                ? "O limite é de 100 linhas por lote. Reduza a seleção ou o período."
                : "Selecionar todos inclui apenas pendentes salvos deste período. Revise antes de enviar."}
            </span>
          </div>
        </div>
        {recentBatches.some((batch) => batch.state !== "prepared") && (
          <div className="recent-batches">
            <span>{data.mode === "demo" ? "Simulações recentes neste período" : "Envios recentes neste período"}</span>
            {recentBatches
              .filter((batch) => batch.state !== "prepared")
              .slice(0, 5)
              .map((batch) => (
                <button
                  className="text-button"
                  key={batch.id}
                  onClick={() => setBatchReview({ batchId: batch.id })}
                >
                  Ver lote · {batch.items.length} {batch.items.length === 1 ? "linha" : "linhas"} ·{" "}
                  {batch.state === "finished"
                    ? "Concluído"
                    : batch.state === "running"
                      ? "Em andamento"
                      : "Interrompido"}
                </button>
              ))}
          </div>
        )}
        {!receiptError && !receiptsLoaded && (
          <p className="notice" role="status">
            Carregando resultados de envio…
          </p>
        )}
        {receiptError && (
          <div className="notice error" role="alert">
            <span>{receiptError}</span>
            <button
              className="text-button"
              onClick={() => setReceiptRetry((current) => current + 1)}
            >
              Recarregar resultados
            </button>
          </div>
        )}
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
              simulated={data.mode === "demo"}
              collapsed={dayCollapseOverrides[date]}
              onCollapsedChange={(collapsed) =>
                setDayCollapseOverrides((current) => ({ ...current, [date]: collapsed }))
              }
              day={editor.days[date] ?? emptyDay(date)}
              activities={catalog?.activities ?? []}
              hasTemplate={!!dayTemplate?.entries.length}
              onUseTemplate={() => useDayTemplate(date)}
              dirty={editor.dirtyDates.includes(date)}
              disabled={blocked || !receiptsLoaded}
              submissions={receipts}
              selectedEntryIds={selection
                .filter((item) => item.date === date)
                .map((item) => item.entryId)}
              onSelect={(entryId) =>
                setSelection((current) =>
                  current.some(
                    (item) => item.date === date && item.entryId === entryId,
                  )
                    ? current.filter(
                        (item) =>
                          item.date !== date || item.entryId !== entryId,
                      )
                    : [...current, { date, entryId }],
                )
              }
              onSelectDay={() => toggleDay(date)}
              onSendDay={() => openBatch(pendingDay(date))}
              onResult={(entryId) => openReview(date, entryId)}
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
        {!visibleDates.length && !loading && !loadFailed && activeRange && (
          <p className="notice" role="status">O período selecionado não contém dias de trabalho (segunda a sexta).</p>
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
                        : message || `Tudo salvo ${saveLocation}`}
              </strong>
              <p>
                {dirtyCount
                  ? "Salvar inclui todos os dias alterados, mesmo fora do período."
                  : "Salvar rascunhos continua separado do envio ao Redmine."}
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
          <span>Worklog for Redmine · v{import.meta.env.VITE_APP_VERSION}</span>
          <a href={repositoryUrl} target="_blank" rel="noopener noreferrer">Código e documentação</a>
          <span>
            <WifiOff size={13} aria-hidden="true" />
              {data.mode === "demo" ? "Demonstração · sem envios reais" : "Organização local · sem envio automático"}
          </span>
        </footer>
      </main>
    </div>
  );
}
