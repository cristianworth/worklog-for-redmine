import {
  activitiesForProject,
  resolveActivity,
  type Activity,
} from "../shared/activities";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Plus, Trash2, CalendarDays } from "lucide-react";
import { formatDuration, parseDuration } from "../shared/worklogs";
import { IssueLookup } from "./IssueLookup";
import { dayLabel, shortDate } from "./period";
import { daySummary, type EditorDay, type EditorEntry } from "./editor";

interface Props {
  day: EditorDay;
  activities: Activity[];
  dirty: boolean;
  disabled: boolean;
  today: string;
  copied: string | null;
  onChange(entries: EditorEntry[]): void;
  onCopy(id: string, issue: string): void;
}

export function DaySection({
  day,
  activities,
  dirty,
  disabled,
  today,
  copied,
  onChange,
  onCopy,
}: Props) {
  const [projects, setProjects] = useState<
    Record<string, { issue: string; projectId: number }>
  >({});
  const focusId = useRef<string | null>(null);
  const section = useRef<HTMLElement>(null);
  const summary = daySummary(day);
  const description = `${shortDate(day.date)}`;
  useEffect(() => {
    if (focusId.current) {
      const target = [
        ...(section.current?.querySelectorAll<HTMLInputElement>(
          "input[data-entry]",
        ) ?? []),
      ].find((input) => input.dataset.entry === focusId.current);
      target?.focus();
      focusId.current = null;
    }
  }, [day.entries]);
  function add() {
    const id = crypto.randomUUID();
    focusId.current = id;
    onChange([
      ...day.entries,
      { id, issue: "", duration: "", activity: "", comment: "" },
    ]);
  }
  function update(id: string, field: keyof EditorEntry, value: string) {
    if (field === "issue")
      setProjects((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    onChange(
      day.entries.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry,
      ),
    );
  }
  return (
    <section
      ref={section}
      className={`day-card ${day.date === today ? "is-today" : ""}`}
      aria-label={`Apontamentos de ${description}`}
    >
      <header className="day-heading">
        <span className="day-icon">
          <CalendarDays size={18} aria-hidden="true" />
        </span>
        <div className="day-name">
          <h2>
            {dayLabel(day.date)} <span>{description}</span>
          </h2>
          <span className="day-status">
            {dirty
              ? "Alterações não salvas"
              : day.entries.length
                ? "Rascunhos salvos"
                : "Nenhum lançamento"}
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
      </header>
      {day.entries.length > 0 ? (
        <div className="table-scroll">
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
                  #
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
                  parseDuration(entry.duration) === null;
                const label = `da linha ${index + 1} em ${description}`;
                const key = `${day.date}:${entry.id}`;
                const project = projects[entry.id];
                const projectId =
                  project?.issue === entry.issue.trim()
                    ? project.projectId
                    : undefined;
                const available = activitiesForProject(activities, projectId);
                const resolved = resolveActivity(
                  activities,
                  projectId,
                  entry.activity,
                );
                const suggestions = `activities-${day.date}-${entry.id}`;
                return (
                  <tr key={entry.id}>
                    <td className="row-number">
                      {String(index + 1).padStart(2, "0")}
                    </td>
                    <td>
                      <div className="issue-field">
                        <input
                          data-entry={entry.id}
                          aria-label={`Tarefa ${label}`}
                          placeholder="Nº da tarefa"
                          inputMode="numeric"
                          value={entry.issue}
                          disabled={disabled}
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
                      <IssueLookup
                        issue={entry.issue}
                        onProject={(projectId) =>
                          setProjects((current) => ({
                            ...current,
                            [entry.id]: {
                              issue: entry.issue.trim(),
                              projectId,
                            },
                          }))
                        }
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
                          invalid ? `duration-${day.date}-${index}` : undefined
                        }
                        placeholder="00:00"
                        value={entry.duration}
                        disabled={disabled}
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
                      {invalid && (
                        <small
                          className="field-error"
                          id={`duration-${day.date}-${index}`}
                        >
                          Use HH:MM; minutos de 00 a 59.
                        </small>
                      )}
                    </td>
                    <td>
                      <input
                        aria-label={`Atividade ${label}`}
                        placeholder="Tipo de atividade"
                        list={suggestions}
                        value={entry.activity}
                        disabled={disabled}
                        onChange={(event) =>
                          update(entry.id, "activity", event.target.value)
                        }
                      />
                      <datalist id={suggestions}>
                        {available.map((activity) => (
                          <option
                            key={activity.activityId}
                            value={activity.name}
                          />
                        ))}
                      </datalist>
                      <small
                        className={`activity-hint ${projectId && entry.activity && !resolved ? "is-unmapped" : ""}`}
                      >
                        {!projectId
                          ? "Consulte a tarefa para identificar o projeto."
                          : resolved
                            ? `Atividade configurada · código ${resolved.activityId}`
                            : !available.length
                              ? "Cadastre as atividades deste projeto em Configurações. O rascunho pode ser salvo."
                              : entry.activity
                                ? "Atividade sem vínculo neste projeto. O rascunho pode ser salvo."
                                : "Escolha uma atividade deste projeto."}
                      </small>
                    </td>
                    <td>
                      <textarea
                        aria-label={`Observação ${label}`}
                        placeholder="O que foi feito?"
                        rows={2}
                        value={entry.comment}
                        disabled={disabled}
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
                        disabled={disabled}
                        onClick={() =>
                          onChange(
                            day.entries.filter((item) => item.id !== entry.id),
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
          <button className="text-button" disabled={disabled} onClick={add}>
            <Plus size={14} aria-hidden="true" />
            Adicionar primeira linha
          </button>
        </div>
      )}
    </section>
  );
}
