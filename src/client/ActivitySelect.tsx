import { useId } from "react";
import { resolveActivity, type Activity } from "../shared/activities";

export function ActivitySelect({
  activities,
  value,
  label,
  disabled,
  reviewedId,
  onChange,
}: {
  activities: Activity[];
  value: string;
  label: string;
  disabled: boolean;
  reviewedId?: number;
  onChange(value: string): void;
}) {
  const hintId = useId();
  const selected = resolveActivity(activities, value);
  const unmatched = !!value && !selected && !reviewedId;
  const hint = reviewedId
    ? `Atividade revisada · código ${reviewedId}`
    : !activities.length
      ? "Cadastre atividades em Configurações. Nenhum código foi escolhido automaticamente."
      : selected
        ? `Atividade configurada · código ${selected.activityId}`
        : value
          ? "Atividade anterior fora do catálogo. Escolha uma opção para corrigir; o envio fica bloqueado sem cadastro."
          : "Escolha uma atividade. O rascunho pode ficar incompleto.";
  return (
    <>
      <select
        aria-label={label}
        aria-describedby={hintId}
        aria-invalid={unmatched}
        value={reviewedId ? value : (selected?.name ?? value)}
        disabled={disabled || !!reviewedId || !activities.length}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {!activities.length ? "Catálogo vazio" : "Selecione uma atividade"}
        </option>
        {reviewedId ? (
          <option value={value}>
            {value} · código {reviewedId}
          </option>
        ) : (
          <>
            {unmatched && (
              <option value={value} disabled>
                {value} · fora do catálogo
              </option>
            )}
            {activities.map((activity) => (
              <option key={activity.activityId} value={activity.name}>
                {activity.name} · código {activity.activityId}
              </option>
            ))}
          </>
        )}
      </select>
      <small
        id={hintId}
        className={`activity-hint ${unmatched ? "is-unmapped" : ""}`}
      >
        {hint}
      </small>
    </>
  );
}
