import { useEffect, useRef, useState } from "react";
import {
  formatDuration,
  parseDuration,
  totalMinutes,
  validateDay,
  type Draft,
  type DraftDay,
} from "../shared/worklogs";

type EditorEntry = Omit<Draft, "minutes"> & { duration: string };
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const toEditor = ({ minutes, ...entry }: Draft): EditorEntry => ({
  ...entry,
  duration: minutes === null ? "" : formatDuration(minutes),
});
const newEntry = (): EditorEntry => ({
  id: crypto.randomUUID(),
  issue: "",
  duration: "",
  activity: "",
  comment: "",
});

async function readResponse(response: Response): Promise<DraftDay> {
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Não foi possível acessar os rascunhos.");
  return validateDay(data);
}

export function App() {
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState<EditorEntry[]>([]);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const pendingFocus = useRef<string | null>(null);
  const table = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);
    setError("");
    setMessage("");
    fetch(`/api/days/${date}`, { signal: controller.signal })
      .then(readResponse)
      .then((day) => {
        if (controller.signal.aborted) return;
        setEntries(day.entries.map(toEditor));
        setRevision(day.revision);
        setDirty(false);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(error.message);
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [date, retry]);

  useEffect(() => {
    if (pendingFocus.current) {
      table.current
        ?.querySelector<HTMLInputElement>(
          `[data-entry="${pendingFocus.current}"]`,
        )
        ?.focus();
      pendingFocus.current = null;
    }
  }, [entries]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function changed(next: EditorEntry[]) {
    setEntries(next);
    setDirty(true);
    setMessage("");
    setError("");
  }
  function update(id: string, field: keyof EditorEntry, value: string) {
    changed(
      entries.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry,
      ),
    );
  }
  function add() {
    const entry = newEntry();
    pendingFocus.current = entry.id;
    changed([...entries, entry]);
  }
  function changeDate(value: string) {
    if (!value || value === date) return;
    if (
      dirty &&
      !window.confirm("Há alterações não salvas. Descartar e abrir outro dia?")
    )
      return;
    setLoading(true);
    setEntries([]);
    setDirty(false);
    setDate(value);
  }
  function demo() {
    changed([
      {
        ...newEntry(),
        issue: "1001",
        duration: "01:30",
        activity: "Desenvolvimento",
        comment: "Exemplo fictício: preparar uma tela.",
      },
      {
        ...newEntry(),
        issue: "1002",
        duration: "00:45",
        activity: "Revisão",
        comment: "Exemplo fictício: revisar uma alteração.",
      },
    ]);
  }

  const invalid = entries.some(
    (entry) => entry.duration !== "" && parseDuration(entry.duration) === null,
  );
  let total = "00:00";
  let totalError = false;
  try {
    total = formatDuration(
      totalMinutes(
        entries.map((entry) => ({ minutes: parseDuration(entry.duration) })),
      ),
    );
  } catch {
    totalError = true;
  }
  const blocked = loading || saving || loadFailed;

  async function save() {
    if (invalid || totalError) {
      setError(
        "Revise as durações antes de salvar. Use horas:minutos, por exemplo 01:30.",
      );
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const day = await readResponse(
        await fetch(`/api/days/${date}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            revision,
            entries: entries.map(({ duration, ...entry }) => ({
              ...entry,
              minutes: duration === "" ? null : parseDuration(duration),
            })),
          }),
        }),
      );
      setEntries(day.entries.map(toEditor));
      setRevision(day.revision);
      setDirty(false);
      setMessage("Rascunhos salvos neste computador.");
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            if (dirty) event.preventDefault();
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            w.
          </span>
          <span>
            Worklog <small>for Redmine</small>
          </span>
        </a>
        <span className="local-badge">
          <span /> Uso local
        </span>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <p className="eyebrow">SEU DIA, EM ORDEM</p>
            <h1>Apontamentos do dia</h1>
            <p className="intro">
              Organize as horas, revise os detalhes e salve seus rascunhos.
            </p>
          </div>
          <div className="date-field">
            <label htmlFor="work-date">Data de trabalho</label>
            <input
              id="work-date"
              type="date"
              value={date}
              disabled={loading || saving}
              onChange={(event) => changeDate(event.target.value)}
            />
          </div>
        </div>
        <section className="summary" aria-label="Resumo do dia">
          <div>
            <span className="summary-label">TOTAL DO DIA</span>
            <strong>
              {totalError ? "—" : total}
              <small>h</small>
            </strong>
            <span>
              {totalError
                ? "Total fora do formato suportado"
                : invalid
                  ? "Total parcial · revise as durações"
                  : "Soma das durações preenchidas"}
            </span>
          </div>
          <div className="summary-count">
            <strong>{entries.length.toString().padStart(2, "0")}</strong>
            <span>{entries.length === 1 ? "rascunho" : "rascunhos"}</span>
          </div>
          <div className="draft-note">
            <span className="draft-dot" />
            <div>
              <strong>Tudo começa como rascunho</strong>
              <p>
                Salvar mantém os dados neste computador.
                <br />O envio ao Redmine será incluído em uma próxima etapa.
              </p>
            </div>
          </div>
        </section>
        <section className="workbench" aria-labelledby="entries-title">
          <div className="workbench-heading">
            <div>
              <h2 id="entries-title">
                Lançamentos <span>{entries.length}</span>
              </h2>
              <p>Uma linha para cada atividade do seu dia.</p>
            </div>
            <button
              className="button secondary"
              onClick={add}
              disabled={blocked}
            >
              + Adicionar linha
            </button>
          </div>
          {loading ? (
            <div className="empty-state" role="status">
              Carregando rascunhos…
            </div>
          ) : loadFailed ? (
            <div className="empty-state">
              <p>Não foi possível abrir este dia.</p>
              <button
                className="button secondary"
                onClick={() => setRetry((value) => value + 1)}
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              <div className="table-scroll" ref={table}>
                <table>
                  <thead>
                    <tr>
                      <th className="row-number">#</th>
                      <th>Tarefa</th>
                      <th>Duração</th>
                      <th>Atividade</th>
                      <th>Observação</th>
                      <th>
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, index) => {
                      const durationInvalid =
                        entry.duration !== "" &&
                        parseDuration(entry.duration) === null;
                      return (
                        <tr key={entry.id}>
                          <td className="row-number">
                            {String(index + 1).padStart(2, "0")}
                          </td>
                          <td>
                            <input
                              data-entry={entry.id}
                              aria-label={`Tarefa da linha ${index + 1}`}
                              placeholder="Nº da tarefa"
                              inputMode="numeric"
                              value={entry.issue}
                              disabled={saving}
                              onChange={(event) =>
                                update(entry.id, "issue", event.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="duration-input"
                              aria-label={`Duração da linha ${index + 1}`}
                              aria-invalid={durationInvalid}
                              aria-describedby={
                                durationInvalid
                                  ? `duration-error-${entry.id}`
                                  : undefined
                              }
                              placeholder="00:00"
                              value={entry.duration}
                              disabled={saving}
                              onChange={(event) =>
                                update(entry.id, "duration", event.target.value)
                              }
                              onBlur={() => {
                                const minutes = parseDuration(entry.duration);
                                if (
                                  minutes !== null &&
                                  entry.duration !== formatDuration(minutes)
                                )
                                  update(
                                    entry.id,
                                    "duration",
                                    formatDuration(minutes),
                                  );
                              }}
                            />
                            {durationInvalid && (
                              <small
                                className="field-error"
                                id={`duration-error-${entry.id}`}
                              >
                                Use HH:MM (minutos de 00 a 59).
                              </small>
                            )}
                          </td>
                          <td>
                            <input
                              aria-label={`Atividade da linha ${index + 1}`}
                              placeholder="Tipo de atividade"
                              list="activity-suggestions"
                              value={entry.activity}
                              disabled={saving}
                              onChange={(event) =>
                                update(entry.id, "activity", event.target.value)
                              }
                            />
                          </td>
                          <td>
                            <textarea
                              aria-label={`Observação da linha ${index + 1}`}
                              placeholder="O que foi feito?"
                              rows={2}
                              value={entry.comment}
                              disabled={saving}
                              onChange={(event) =>
                                update(entry.id, "comment", event.target.value)
                              }
                            />
                          </td>
                          <td>
                            <button
                              className="remove-button"
                              aria-label={`Remover linha ${index + 1}`}
                              title="Remover linha"
                              disabled={saving}
                              onClick={() =>
                                changed(
                                  entries.filter(
                                    (item) => item.id !== entry.id,
                                  ),
                                )
                              }
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {entries.length === 0 && (
                <div className="empty-state">
                  <span className="empty-icon" aria-hidden="true">
                    ＋
                  </span>
                  <h3>Um novo dia para organizar</h3>
                  <p>
                    Adicione a primeira linha ou experimente com dados
                    fictícios.
                  </p>
                  <div>
                    <button
                      className="button secondary"
                      onClick={add}
                      disabled={saving}
                    >
                      Adicionar primeira linha
                    </button>
                    <button
                      className="text-button"
                      onClick={demo}
                      disabled={saving}
                    >
                      Carregar exemplo
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          <datalist id="activity-suggestions">
            <option value="Desenvolvimento" />
            <option value="Revisão" />
            <option value="Reunião" />
          </datalist>
          <div className="workbench-footer">
            <span>Preencha com Tab · Duração em horas:minutos</span>
            <span className="status-pill">Rascunhos locais</span>
          </div>
        </section>
        <div className="save-bar">
          <div aria-live="polite">
            <strong>
              {saving
                ? "Salvando…"
                : dirty
                  ? "Alterações não salvas"
                  : message || "Nenhuma alteração pendente"}
            </strong>
            <p>
              {dirty
                ? "Salve antes de fechar ou mudar de dia."
                : "Você pode continuar editando quando quiser."}
            </p>
          </div>
          <button
            className="button primary"
            disabled={blocked || !dirty || invalid || totalError}
            onClick={save}
          >
            {saving ? "Salvando…" : "Salvar rascunhos"}
          </button>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <footer className="page-footer">
          <span>Worklog for Redmine</span>
          <span>Primeiro recorte · organização local</span>
        </footer>
      </main>
    </div>
  );
}
