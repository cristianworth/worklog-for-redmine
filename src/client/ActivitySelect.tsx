import { useId } from "react";
import {
  activitiesForProject,
  resolveActivity,
  type Activity,
} from "../shared/activities";

export function ActivitySelect({
  activities,
  projectId,
  value,
  label,
  disabled,
  reviewedId,
  onChange,
}: {
  activities: Activity[];
  projectId?: number;
  value: string;
  label: string;
  disabled: boolean;
  reviewedId?: number;
  onChange(value: string): void;
}) {
  const hintId = useId();
  const available = activitiesForProject(activities, projectId);
  const selected = resolveActivity(activities, projectId, value);
  const unmatched = !!value && !selected && !reviewedId;
  const hint = reviewedId
    ? `Atividade revisada · código ${reviewedId}`
    : !projectId
      ? "Consulte a tarefa para carregar as opções do projeto. O valor anterior, se houver, está preservado."
      : !available.length
        ? `Cadastre atividades do projeto #${projectId} em Configurações. Nenhum código foi escolhido automaticamente.`
        : selected
          ? `Atividade configurada · código ${selected.activityId}`
          : value
            ? "Atividade anterior sem vínculo neste projeto. Escolha uma opção para corrigir; o envio fica bloqueado sem vínculo."
            : "Escolha uma atividade deste projeto. O rascunho pode ficar incompleto.";
  return (
    <>
      <select
        aria-label={label}
        aria-describedby={hintId}
        aria-invalid={!!projectId && unmatched}
        value={reviewedId ? value : (selected?.name ?? value)}
        disabled={disabled || !!reviewedId || !projectId || !available.length}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {!projectId
            ? "Consulte a tarefa primeiro"
            : !available.length
              ? "Catálogo do projeto vazio"
              : "Selecione uma atividade"}
        </option>
        {reviewedId ? (
          <option value={value}>
            {value} · código {reviewedId}
          </option>
        ) : (
          <>
            {unmatched && (
              <option value={value} disabled>
                {value} · {projectId ? "sem vínculo" : "aguardando consulta"}
              </option>
            )}
            {available.map((activity) => (
              <option key={activity.activityId} value={activity.name}>
                {activity.name} · código {activity.activityId}
              </option>
            ))}
          </>
        )}
      </select>
      <small
        id={hintId}
        className={`activity-hint ${projectId && unmatched ? "is-unmapped" : ""}`}
      >
        {hint}
      </small>
    </>
  );
}
