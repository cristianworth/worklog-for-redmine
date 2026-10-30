import { useId } from "react";
import { resolveActivity, type Activity } from "../shared/activities";
import { alphabeticalActivities } from "./activity-order";

export function ActivitySelect({
  activities,
  value,
  label,
  disabled,
  reviewedId,
  onChange,
  required = false,
  error,
  onBlur,
}: {
  activities: Activity[];
  value: string;
  label: string;
  disabled: boolean;
  reviewedId?: number;
  onChange(value: string): void;
  required?: boolean;
  error?: string;
  onBlur?(): void;
}) {
  const hintId = useId();
  const selected = resolveActivity(activities, value);
  const unmatched = !!value && !selected && !reviewedId;
  const hint = reviewedId
    ? "Atividade revisada."
    : !activities.length
      ? "Cadastre atividades em Configurações."
      : selected
        ? "Atividade configurada."
        : value
          ? "Atividade anterior fora do catálogo. Escolha uma opção para corrigir; o envio fica bloqueado sem cadastro."
          : "Escolha uma atividade. O rascunho pode ficar incompleto.";
  return (
    <>
      <select
        aria-label={label}
        aria-describedby={hintId}
        aria-invalid={unmatched || !!error}
        aria-required={required || undefined}
        onBlur={onBlur}
        value={reviewedId ? value : (selected?.name ?? value)}
        disabled={disabled || !!reviewedId || !activities.length}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {!activities.length ? "Catálogo vazio" : "Selecione uma atividade"}
        </option>
        {reviewedId ? (
          <option value={value}>
            {value}
          </option>
        ) : (
          <>
            {unmatched && (
              <option value={value} disabled>
                {value} · fora do catálogo
              </option>
            )}
            {alphabeticalActivities(activities).map((activity) => (
              <option key={activity.activityId} value={activity.name}>
                {activity.name}
              </option>
            ))}
          </>
        )}
      </select>
      <small
        id={hintId}
        className={error ? "field-error" : `activity-hint ${unmatched ? "is-unmapped" : ""}`}
        aria-live={error ? "polite" : undefined}
      >
        {error || hint}
      </small>
    </>
  );
}
