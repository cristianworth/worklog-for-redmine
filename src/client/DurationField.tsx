import { useEffect, useId, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { formatDuration, parseDurationInput } from "../shared/worklogs";
import { addDurationInput } from "./editor";

export function DurationField({ value, label, disabled, locked, onChange }: {
  value: string;
  label: string;
  disabled: boolean;
  locked: boolean;
  onChange(value: string): void;
}) {
  const hintId = useId();
  const additionId = useId();
  const input = useRef<HTMLInputElement>(null);
  const additionInput = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef(false);
  const [addition, setAddition] = useState<string | null>(null);
  const [lastTotal, setLastTotal] = useState<string | null>(null);
  const adding = addition !== null;
  const invalid = value !== "" && parseDurationInput(value) === null;
  let preview = "", additionError = "";
  if (adding && addition !== "") {
    try { preview = addDurationInput(value, addition); }
    catch (error) { additionError = (error as Error).message; }
  }
  useEffect(() => {
    if (adding) additionInput.current?.focus();
    else if (restoreFocus.current) {
      input.current?.focus();
      restoreFocus.current = false;
    }
  }, [adding]);
  function close() {
    restoreFocus.current = true;
    setAddition(null);
  }
  function apply() {
    if (disabled || locked || !preview) return;
    if (preview !== value) onChange(preview);
    setLastTotal(preview);
    close();
  }
  return (
    <>
      <div className="duration-field">
        <button type="button" className="icon-button duration-add"
          aria-label={`Somar tempo ${label}`} title="Somar tempo à duração atual"
          aria-expanded={adding} aria-controls={adding ? additionId : undefined}
          disabled={disabled || locked || invalid}
          onClick={() => { if (adding) close(); else { setLastTotal(null); setAddition(""); } }}>
          <Plus size={17} aria-hidden="true" />
        </button>
        <input ref={input} className="duration-input" aria-label={`Duração ${label}`}
          aria-invalid={invalid} aria-describedby={invalid || (!locked && !adding) ? hintId : undefined}
          placeholder="30 ou 1:30" inputMode="numeric" value={value}
          disabled={disabled || locked || adding}
          onChange={(event) => { setLastTotal(null); onChange(event.target.value); }}
          onBlur={() => {
            const minutes = parseDurationInput(value);
            if (minutes !== null && value !== formatDuration(minutes)) onChange(formatDuration(minutes));
          }} />
      </div>
      {adding && (
        <div id={additionId} className="duration-addition" role="group" aria-label={`Somar tempo ${label}`}>
          <label htmlFor={`${additionId}-input`}>Tempo a somar</label>
          <input ref={additionInput} id={`${additionId}-input`} aria-label={`Tempo a somar ${label}`}
            aria-invalid={!!additionError} aria-describedby={`${additionId}-hint`}
            inputMode="numeric" placeholder="30 ou 1:30" value={addition} disabled={disabled || locked}
            onChange={(event) => setAddition(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") { event.preventDefault(); apply(); }
              if (event.key === "Escape") { event.preventDefault(); close(); }
            }} />
          <small id={`${additionId}-hint`} className={additionError ? "field-error" : "duration-hint"} aria-live="polite">
            {additionError || (preview ? `Novo total: ${preview}` : "Enter para somar · Esc para cancelar")}
          </small>
          <div className="duration-addition-actions">
            <button type="button" className="text-button" disabled={disabled || locked || !preview} onClick={apply}>Somar</button>
            <button type="button" className="icon-button" aria-label={`Cancelar soma ${label}`} title="Cancelar soma" onClick={close}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      {invalid && <small className="field-error" id={hintId}>Use 30, 130 ou HH:MM; minutos de 00 a 59.</small>}
      {!locked && !invalid && !adding && <small id={hintId} className="duration-hint" role={lastTotal === value ? "status" : undefined}>
        {lastTotal === value ? `Total atualizado: ${value}` : "30 → 00:30 · 130 → 01:30"}
      </small>}
    </>
  );
}
