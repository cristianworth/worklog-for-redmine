import {
  isSubmissionLocked,
  isAppropriated,
  appropriationSummary,
  type SubmissionRecord,
} from "../shared/submissions";
import { ActivitySelect } from "./ActivitySelect";
import { ReceiptBadge } from "./ReceiptBadge";
import type { Activity } from "../shared/activities";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Plus,
  Trash2,
  Upload,
  FilePlus2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { formatDuration, parseDurationInput } from "../shared/worklogs";
import { IssueLookup } from "./IssueLookup";
import { dayLabel, shortDate } from "./period";
import { daySummary, type EditorDay, type EditorEntry } from "./editor";

interface Props {
  simulated?: boolean;
  day: EditorDay;
  activities: Activity[];
  dirty: boolean;
  disabled: boolean;
  today: string;
  submissions: Record<string, SubmissionRecord>;
  selectedEntryIds: string[];
  onSelectDay(): void;
  onSendDay(): void;
  onSelect(entryId: string): void;
  onResult(entryId: string): void;
  copied: string | null;
  onChange(entries: EditorEntry[]): void;
  onCopy(id: string, issue: string): void;
  collapsed?: boolean;
  onCollapsedChange(collapsed: boolean): void;
  hasTemplate: boolean;
  onUseTemplate(): void;
}

export function DaySection({
  simulated = false,
  day,
  activities,
  dirty,
  disabled,
  today,
  submissions,
  selectedEntryIds,
  onSelectDay,
  onSendDay,
  onSelect,
  onResult,
  copied,
  onChange,
  onCopy,
  hasTemplate,
  onUseTemplate,
  collapsed: collapsedOverride,
  onCollapsedChange,
}: Props) {
  const [lookupRequests, setLookupRequests] = useState<
    Record<string, { code: string }>
  >({});
  const focusId = useRef<string | null>(null);
  const section = useRef<HTMLElement>(null);
  const summary = daySummary(day);
  const description = `${shortDate(day.date)}`;
  const dayReceipts = day.entries.map(
    (entry) => submissions[`${day.date}:${entry.id}`],
  );
  const pending = day.entries.filter((entry) => {
    const record = submissions[`${day.date}:${entry.id}`];
    return !record || !isSubmissionLocked(record.state);
  });
  const appropriation = appropriationSummary(
    day.entries.map((entry) => entry.id),
    dayReceipts,
  );
  const collapsed = collapsedOverride ?? appropriation.complete;
  const statusLabel = simulated ? appropriation.label.replaceAll("apropriadas", "simuladas") : appropriation.label;
  useEffect(() => {
    if (focusId.current && !collapsed) {
      const target = [
        ...(section.current?.querySelectorAll<HTMLInputElement>(
          "input[data-entry]",
        ) ?? []),
      ].find((input) => input.dataset.entry === focusId.current);
      target?.focus();
      focusId.current = null;
    }
  }, [day.entries, collapsed]);
  function add() {
    onCollapsedChange(false);
    const id = crypto.randomUUID();
    focusId.current = id;
    onChange([
      ...day.entries,
      { id, issue: "", duration: "", activity: "", comment: "" },
    ]);
  }
  function update(id: string, field: keyof EditorEntry, value: string) {
    if (field === "issue") {
      setLookupRequests((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
    onChange(
      day.entries.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry,
      ),
    );
  }
  return (
    <section
      ref={section}
      className={`day-card ${day.date === today ? "is-today" : ""} ${appropriation.complete ? "is-appropriated-day" : ""} ${collapsed ? "is-collapsed" : ""}`}
      data-weekday={new Date(`${day.date}T12:00:00Z`).getUTCDay()}
      aria-label={`Apontamentos de ${description}`}
    >
      <header className="day-heading">
        <span className="day-date-stamp" aria-hidden="true">{day.date.slice(-2)}</span>
        <div className="day-name">
          <h2>
            {dayLabel(day.date)} <span>{description}</span>
          </h2>
          <span className="day-status">
            {dirty
              ? `Alterações não salvas · ${statusLabel}`
              : statusLabel}
            {day.date === today && <span className="today-label">Hoje</span>}
          </span>
        </div>
        <div className={`day-total ${summary.invalid ? "is-partial" : ""}`}>
          <span>{summary.invalid ? "Total parcial" : "Total do dia"}</span>
          <strong>
            {summary.total}
            <small>h</small>
          </strong>
        </div>
        <button
          className="button secondary add-line"
          onClick={add}
          disabled={disabled}
          aria-label={`Adicionar linha em ${description}`}
        >
          <Plus size={16} aria-hidden="true" />
          Adicionar linha
        </button>
        <button
          className="icon-button day-toggle"
          aria-expanded={!collapsed}
          aria-controls={`day-content-${day.date}`}
          aria-label={`${collapsed ? "Expandir" : "Recolher"} tarefas de ${description}`}
          title={
            collapsed ? "Expandir tarefas do dia" : "Recolher tarefas do dia"
          }
          onClick={() => onCollapsedChange(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight size={20} aria-hidden="true" />
          ) : (
            <ChevronDown size={20} aria-hidden="true" />
          )}
        </button>
      </header>
      <div id={`day-content-${day.date}`} hidden={collapsed}>
        {day.entries.length > 0 ? (
          <div className="table-scroll" role="region" aria-label={`Tarefas de ${description}`} tabIndex={0}>
            <table>
              <colgroup>
                <col className="number-col" />
                <col className="issue-col" />
                <col className="duration-col" />
                <col className="activity-col" />
                <col />
                <col className="action-col" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="row-number">
                    <input
                      type="checkbox"
                      className="day-selector"
                      aria-label={`Selecionar pendentes do dia ${description}`}
                      disabled={disabled || dirty || !pending.length}
                      checked={
                        !!pending.length &&
                        pending.every((entry) =>
                          selectedEntryIds.includes(entry.id),
                        )
                      }
                      onChange={onSelectDay}
                    />
                  </th>
                  <th scope="col">Tarefa</th>
                  <th scope="col">Duração</th>
                  <th scope="col">Atividade</th>
                  <th scope="col">Observação</th>
                  <th scope="col">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {day.entries.map((entry, index) => {
                  const invalid =
                    entry.duration !== "" &&
                    parseDurationInput(entry.duration) === null;
                  const label = `da linha ${index + 1} em ${description}`;
                  const key = `${day.date}:${entry.id}`;
                  const receipt = submissions[key];
                  const rowLocked =
                    !!receipt && isSubmissionLocked(receipt.state);
                  const rowDisabled = disabled || rowLocked;
                  return (
                    <tr
                      key={entry.id}
                      className={
                        isAppropriated(receipt)
                          ? "is-appropriated"
                          : rowLocked
                            ? "needs-check"
                            : receipt?.state === "rejected"
                              ? "is-rejected"
                              : ""
                      }
                    >
                      <td className="row-number">
                        <label className="entry-selector">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar linha ${index + 1} em ${description} para envio`}
                            checked={selectedEntryIds.includes(entry.id)}
                            disabled={disabled || dirty || rowLocked}
                            onChange={() => onSelect(entry.id)}
                          />
                          <span>{String(index + 1).padStart(2, "0")}</span>
                        </label>
                      </td>
                      <td>
                        <div className="issue-field">
                          <input
                            data-entry={entry.id}
                            aria-label={`Tarefa ${label}`}
                            placeholder="Nº da tarefa"
                            inputMode="numeric"
                            value={entry.issue}
                            disabled={rowDisabled}
                            onBlur={() =>
                              setLookupRequests((current) => ({
                                ...current,
                                [entry.id]: { code: entry.issue.trim() },
                              }))
                            }
                            onChange={(event) =>
                              update(entry.id, "issue", event.target.value)
                            }
                          />
                          <button
                            className={`icon-button copy-button ${copied === key ? "copied" : ""}`}
                            disabled={disabled || !entry.issue}
                            aria-label={`Copiar código da tarefa ${label}`}
                            title={
                              copied === key
                                ? "Código copiado"
                                : "Copiar código da tarefa"
                            }
                            onClick={() => onCopy(key, entry.issue)}
                          >
                            {copied === key ? (
                              <Check size={15} aria-hidden="true" />
                            ) : (
                              <Copy size={15} aria-hidden="true" />
                            )}
                          </button>
                        </div>
                        <div className="row-receipt">
                          <ReceiptBadge record={receipt} />
                          {receipt && receipt.state !== "prepared" && (
                            <button
                              className="text-button"
                              disabled={disabled}
                              onClick={() => onResult(entry.id)}
                            >
                              Ver resultado
                            </button>
                          )}
                        </div>
                        <IssueLookup
                          automaticRequest={lookupRequests[entry.id]}
                          issue={entry.issue}
                          label={label}
                          disabled={disabled}
                        />
                      </td>
                      <td>
                        <input
                          className="duration-input"
                          aria-label={`Duração ${label}`}
                          aria-invalid={invalid}
                          aria-describedby={
                            invalid
                              ? `duration-${day.date}-${index}`
                              : rowLocked
                                ? undefined
                                : `duration-hint-${day.date}-${index}`
                          }
                          placeholder="30 ou 1:30"
                          inputMode="numeric"
                          value={entry.duration}
                          disabled={rowDisabled}
                          onChange={(event) =>
                            update(entry.id, "duration", event.target.value)
                          }
                          onBlur={() => {
                            const minutes = parseDurationInput(entry.duration);
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
                        {invalid && (
                          <small
                            className="field-error"
                            id={`duration-${day.date}-${index}`}
                          >
                            Use 30, 130 ou HH:MM; minutos de 00 a 59.
                          </small>
                        )}
                        {!rowLocked && !invalid && (
                          <small
                            className="duration-hint"
                            id={`duration-hint-${day.date}-${index}`}
                          >
                            30 → 00:30 · 130 → 01:30
                          </small>
                        )}
                      </td>
                      <td>
                        <ActivitySelect
                          activities={activities}
                          value={entry.activity}
                          label={`Atividade ${label}`}
                          disabled={rowDisabled}
                          reviewedId={
                            rowLocked ? receipt.snapshot.activityId : undefined
                          }
                          onChange={(value) =>
                            update(entry.id, "activity", value)
                          }
                        />
                      </td>
                      <td>
                        <textarea
                          aria-label={`Observação ${label}`}
                          placeholder="O que foi feito?"
                          rows={2}
                          value={entry.comment}
                          disabled={rowDisabled}
                          onChange={(event) =>
                            update(entry.id, "comment", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="icon-button remove-button"
                          aria-label={`Remover linha ${index + 1} em ${description}`}
                          title="Remover linha"
                          disabled={rowDisabled}
                          onClick={() =>
                            onChange(
                              day.entries.filter(
                                (item) => item.id !== entry.id,
                              ),
                            )
                          }
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="day-empty">
            <span>Seu dia começa com o primeiro rascunho.</span>
            {hasTemplate && day.revision === 0 && !dirty && (
              <button
                className="button secondary"
                disabled={disabled}
                onClick={onUseTemplate}
                aria-label={`Criar dia ${description} com modelo`}
              >
                <FilePlus2 size={16} aria-hidden="true" />
                Criar dia com modelo
              </button>
            )}
            <button className="text-button" disabled={disabled} onClick={add}>
              <Plus size={14} aria-hidden="true" />
              Adicionar primeira linha
            </button>
          </div>
        )}
      </div>
      {pending.length > 0 && (
        <footer className="day-actions">
          <span>{dirty ? "Salve as alterações antes de enviar."
            : pending.length > 100 ? "O limite é de 100 linhas por lote. Selecione menos linhas."
              : `${pending.length} ${pending.length === 1 ? "linha pendente" : "linhas pendentes"} · revisão antes do envio`}</span>
          <button
            className="button day-send"
            onClick={onSendDay}
            disabled={disabled || dirty || day.revision < 1 || pending.length > 100}
            aria-label={`${simulated ? "Simular dia" : "Enviar dia"} ${description}`}
            title={pending.length > 100 ? "O limite é de 100 linhas por lote. Selecione menos linhas." : "Revisar as linhas pendentes deste dia"}
          >
            <Upload size={16} aria-hidden="true" /> {simulated ? "Simular dia" : "Enviar dia"}
          </button>
        </footer>
      )}
    </section>
  );
}
