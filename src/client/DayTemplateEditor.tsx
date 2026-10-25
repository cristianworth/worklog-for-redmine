import { ActivitySelect } from "./ActivitySelect";
import { IssueLookup } from "./IssueLookup";
import type { Activity } from "../shared/activities";
import { useEffect, useState } from "react";
import { LoaderCircle, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { validateDayTemplate, type DayTemplate } from "../shared/day-template";
import { formatDuration, parseDurationInput } from "../shared/worklogs";
import type { EditorEntry } from "./editor";
import { useWorklogData } from "./WorklogDataProvider";

const rowsFrom = (template: DayTemplate, ids: string[] = []): EditorEntry[] =>
  template.entries.map(({ minutes, ...entry }, index) => ({
    ...entry,
    id: ids[index] ?? crypto.randomUUID(),
    duration: minutes === null ? "" : formatDuration(minutes),
  }));

export function DayTemplateEditor({
  onTemplate,
  activities,
  onDirtyChange,
  onClose,
}: {
  onTemplate(template: DayTemplate | null): void;
  activities: Activity[];
  onDirtyChange(dirty: boolean): void;
  onClose(): void;
}) {
  const data = useWorklogData();
  const [template, setTemplate] = useState<DayTemplate | null>(null);
  const [rows, setRows] = useState<EditorEntry[]>([]);
  const [lookupRequests, setLookupRequests] = useState<
    Record<string, { code: string }>
  >({});
  function resetRows(loaded: DayTemplate) {
    setRows(rowsFrom(loaded));
    setLookupRequests({});
  }
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    data.readDayTemplate(controller.signal)
      .then((loaded) => {
        if (!controller.signal.aborted) {
          setTemplate(loaded);
          resetRows(loaded);
          onTemplate(loaded);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar o modelo.",
          );
          onTemplate(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [data, retry, onTemplate]);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  const blocked = busy || loading || !template;
  function changed() {
    setDirty(true);
    setError("");
    setMessage("");
  }
  function update(id: string, field: keyof EditorEntry, value: string) {
    if (field === "issue") {
      setLookupRequests((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
    changed();
  }
  function discard() {
    if (template) resetRows(template);
    setDirty(false);
    setError("");
    setMessage("");
  }
  async function save() {
    if (blocked || !dirty || !template) return;
    let payload: DayTemplate;
    try {
      payload = validateDayTemplate({
        revision: template.revision,
        entries: rows.map((row) => {
          const minutes =
            row.duration === "" ? null : parseDurationInput(row.duration);
          if (row.duration !== "" && minutes === null)
            throw new Error(
              "Corrija as durações do modelo: use 30, 130 ou HH:MM; minutos de 00 a 59.",
            );
          return {
            issue: row.issue,
            minutes,
            activity: row.activity,
            comment: row.comment,
          };
        }),
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Modelo inválido.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await data.saveDayTemplate(payload);
      setTemplate(saved);
      setRows(
        rowsFrom(
          saved,
          rows.map((row) => row.id),
        ),
      );
      setDirty(false);
      onTemplate(saved);
      setMessage(
        data.mode === "demo"
          ? "Modelo salvo nesta sessão de demonstração. Seus dias existentes não mudaram."
          : "Modelo salvo neste computador. Seus dias existentes não mudaram.",
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Falha ao salvar o modelo.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="settings-panel template-panel"
      aria-labelledby="day-template-title"
    >
      <div className="settings-heading">
        <h2 id="day-template-title">Modelo do dia</h2>
        <span className="catalog-state">
          {dirty
            ? "Alterações não salvas"
            : loading
              ? "Carregando modelo…"
              : template
                ? `${template.entries.length} ${template.entries.length === 1 ? "linha salva" : "linhas salvas"}`
                : "Modelo indisponível"}
        </span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Fechar modelo do dia"
        >
          <X size={18} />
        </button>
      </div>
      <p>
        Configure as linhas recorrentes, como a reunião diária. Em um dia ainda
        não iniciado, use <strong>Criar dia com modelo</strong>. Depois, ajuste
        as linhas e salve os rascunhos.
      </p>
      <p className="settings-note">
        Você pode deixar tarefa, duração ou outros campos vazios para completar
        no dia. Escolha a atividade na lista, mesmo sem informar uma tarefa. O
        envio confere a tarefa e a atividade novamente. Nenhum dado da planilha
        é importado automaticamente.
      </p>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {template && (
        <div className="table-scroll">
          <table className="template-table">
            <thead>
              <tr>
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
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td>
                    <input
                      aria-label={`Tarefa do modelo ${index + 1}`}
                      inputMode="numeric"
                      placeholder="Nº ou vazio"
                      value={row.issue}
                      disabled={blocked}
                      onBlur={() =>
                        setLookupRequests((current) => ({
                          ...current,
                          [row.id]: { code: row.issue.trim() },
                        }))
                      }
                      onChange={(event) =>
                        update(row.id, "issue", event.target.value)
                      }
                    />
                    <IssueLookup
                      issue={row.issue}
                      label={`do modelo ${index + 1}`}
                      disabled={blocked}
                      automaticRequest={lookupRequests[row.id]}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Duração do modelo ${index + 1}`}
                      placeholder="30 ou 1:30"
                      inputMode="numeric"
                      value={row.duration}
                      disabled={blocked}
                      aria-invalid={
                        !!row.duration &&
                        parseDurationInput(row.duration) === null
                      }
                      onChange={(event) =>
                        update(row.id, "duration", event.target.value)
                      }
                      onBlur={() => {
                        const minutes = parseDurationInput(row.duration);
                        if (
                          minutes !== null &&
                          row.duration !== formatDuration(minutes)
                        )
                          update(row.id, "duration", formatDuration(minutes));
                      }}
                    />
                    <small
                      className={
                        row.duration &&
                        parseDurationInput(row.duration) === null
                          ? "field-error"
                          : "duration-hint"
                      }
                    >
                      {row.duration && parseDurationInput(row.duration) === null
                        ? "Minutos de 00 a 59; sem segundos."
                        : "30 → 00:30 · 130 → 01:30"}
                    </small>
                  </td>
                  <td>
                    <ActivitySelect
                      activities={activities}
                      value={row.activity}
                      label={`Atividade do modelo ${index + 1}`}
                      disabled={blocked}
                      onChange={(value) => update(row.id, "activity", value)}
                    />
                  </td>
                  <td>
                    <textarea
                      aria-label={`Observação do modelo ${index + 1}`}
                      placeholder="Observação recorrente"
                      value={row.comment}
                      disabled={blocked}
                      onChange={(event) =>
                        update(row.id, "comment", event.target.value)
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="icon-button remove-button"
                      aria-label={`Remover linha ${index + 1} do modelo`}
                      disabled={blocked}
                      onClick={() => {
                        setRows((current) =>
                          current.filter((entry) => entry.id !== row.id),
                        );
                        changed();
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="catalog-empty">
              Seu modelo está vazio. Adicione as linhas que costuma repetir.
              Salvar o modelo vazio desativa seu uso nos próximos dias.
            </p>
          )}
        </div>
      )}
      <div className="catalog-actions">
        <button
          className="button secondary"
          disabled={blocked || rows.length >= 100}
          onClick={() => {
            setRows((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                issue: "",
                duration: "",
                activity: "",
                comment: "",
              },
            ]);
            changed();
          }}
        >
          <Plus size={16} />
          Adicionar linha ao modelo
        </button>
        <button
          className="button"
          disabled={blocked || !dirty}
          onClick={() => void save()}
        >
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Save size={16} />
          )}
          Salvar modelo
        </button>
        <button
          className="button quiet"
          disabled={busy || loading || !dirty}
          onClick={discard}
        >
          Descartar alterações do modelo
        </button>
        <button
          className="button quiet"
          disabled={busy || loading || dirty}
          onClick={() => {
            setMessage("");
            setRetry((value) => value + 1);
          }}
        >
          <RotateCcw size={16} />
          Recarregar modelo
        </button>
      </div>
      {message && (
        <p className="connection-success" role="status">
          {message}
        </p>
      )}
      <p className="settings-note">
        Salvar modelo é separado de salvar rascunhos e enviar ao Redmine. Não
        altera dias existentes nem preenche todo o período. Fechar este painel
        preserva suas edições enquanto a página estiver aberta.
      </p>
    </section>
  );
}
