import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw, Upload, X } from "lucide-react";
import {
  canConfirmBatch,
  type BatchSelection,
  type SubmissionBatch,
} from "../shared/batches";
import { formatDuration } from "../shared/worklogs";
import { shortDate } from "./period";
import { submissionLabel } from "./SubmissionReview";

async function readBatch(response: Response): Promise<SubmissionBatch> {
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Não foi possível consultar o lote.");
  if (
    !data.id ||
    !Array.isArray(data.items) ||
    !["prepared", "running", "finished", "interrupted"].includes(data.state)
  )
    throw new Error("O resultado do lote é inválido.");
  return data;
}
export function BatchReview({
  entries,
  batchId,
  onClose,
  onBatch,
}: {
  entries?: BatchSelection[];
  batchId?: string;
  onClose(): void;
  onBatch(batch: SubmissionBatch): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const preparation = useRef<Promise<SubmissionBatch> | null>(null);
  const [batch, setBatch] = useState<SubmissionBatch | null>(null);
  const [busy, setBusy] = useState(true);
  const [confirmBlocked, setConfirmBlocked] = useState(false);
  const [error, setError] = useState("");
  const accept = useCallback(
    (next: SubmissionBatch) => {
      setBatch(next);
      onBatch(next);
    },
    [onBatch],
  );
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    let alive = true;
    // StrictMode remounts effects; share preparation so it cannot replace its own row reviews.
    preparation.current ??= (
      batchId
        ? fetch(`/api/submission-batches/${encodeURIComponent(batchId)}`)
        : fetch("/api/submission-batches/prepare", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entries }),
          })
    ).then(readBatch);
    preparation.current
      .then((next) => {
        if (alive) accept(next);
      })
      .catch((err) => {
        if (alive)
          setError(
            err instanceof Error ? err.message : "Falha ao preparar lote.",
          );
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [entries, batchId, accept]);
  const currentId = batch?.id;
  const refresh = useCallback(async () => {
    if (!currentId) return;
    const next = await fetch(
      `/api/submission-batches/${encodeURIComponent(currentId)}`,
    ).then(readBatch);
    accept(next);
    setError("");
  }, [currentId, accept]);
  useEffect(() => {
    if (!currentId || batch?.state !== "running") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await fetch(
          `/api/submission-batches/${encodeURIComponent(currentId)}`,
        ).then(readBatch);
        if (!stopped) {
          accept(next);
          setError("");
        }
      } catch {
        if (!stopped)
          setError(
            "A atualização não chegou. O envio não será repetido; use Atualizar resultados.",
          );
      }
      if (!stopped) timer = setTimeout(poll, 1200);
    };
    timer = setTimeout(poll, 700);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [currentId, batch?.state, accept]);
  async function confirm() {
    if (!batch || busy || !canConfirmBatch(batch)) return;
    setBusy(true);
    setConfirmBlocked(true);
    setError("");
    try {
      accept(
        await fetch(
          `/api/submission-batches/${encodeURIComponent(batch.id)}/confirm`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirmed: true }),
          },
        ).then(readBatch),
      );
    } catch (err) {
      // A lost local response may hide an already running worker. Read before exposing confirmation again.
      setBatch((current) =>
        current ? { ...current, state: "running" } : current,
      );
      const reason =
        err instanceof Error ? err.message : "A confirmação não chegou.";
      try {
        accept(
          await fetch(
            `/api/submission-batches/${encodeURIComponent(batch.id)}`,
          ).then(readBatch),
        );
      } catch {
        /* Polling remains read-only. */
      }
      setError(
        `${reason} Confira os resultados. Se o lote não iniciou, feche e prepare uma nova revisão.`,
      );
    } finally {
      setBusy(false);
    }
  }
  const dates = [
    ...new Set(batch?.items.map((item) => item.selection.date) ?? []),
  ];
  return (
    <dialog
      ref={dialog}
      className="submission-dialog batch-dialog"
      aria-labelledby="batch-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="submission-heading">
        <div>
          <p className="eyebrow">ENVIO POR DIA OU PERÍODO</p>
          <h2 id="batch-title">
            {batch?.state === "prepared"
              ? "Revise o lote antes de enviar"
              : "Resultados do lote"}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label="Fechar lote"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {!batch && busy && (
        <p className="notice" role="status">
          <LoaderCircle className="spin" size={17} /> Preparando as linhas
          selecionadas…
        </p>
      )}
      {batch && (
        <>
          <p className="batch-summary" role="status">
            {batch.items.length} linhas · {dates.length}{" "}
            {dates.length === 1 ? "dia" : "dias"}. {batch.message}
          </p>
          <p className="settings-note">
            Status dos cards: <strong>Manter</strong>. O lote para na primeira
            falha. Fechar esta janela após confirmar não cancela a execução.
          </p>
          {dates.map((date) => (
            <section
              className="batch-day"
              key={date}
              aria-label={`Revisão de ${shortDate(date)}`}
            >
              <h3>{shortDate(date)}</h3>
              {batch.items
                .filter((item) => item.selection.date === date)
                .map((item, index) => {
                  const record = item.record,
                    s = record?.snapshot;
                  const label =
                    record?.state === "prepared" && batch.state !== "prepared"
                      ? batch.state === "running"
                        ? "Aguardando envio"
                        : "Não enviado"
                      : record
                        ? submissionLabel[record.state]
                        : "Impedimento";
                  return (
                    <article
                      className="batch-line"
                      key={item.selection.entryId}
                    >
                      <div className="batch-line-heading">
                        <strong>
                          {s
                            ? `#${s.issueId} · ${s.subject}`
                            : `Linha ${index + 1}`}
                        </strong>
                        <span
                          className={`result-${record?.state ?? "rejected"}`}
                        >
                          {label}
                          {record?.remoteId ? ` · #${record.remoteId}` : ""}
                        </span>
                      </div>
                      {s && (
                        <>
                          <small>
                            {s.projectName} · {formatDuration(s.minutes)} ·{" "}
                            {s.activityName} (código {s.activityId})
                          </small>
                          <p>{s.comment}</p>
                          {!s.activityVerified &&
                            record?.state === "prepared" &&
                            batch.state === "prepared" && (
                              <small className="result-uncertain">
                                A API não fornece o catálogo do projeto; confira
                                o código. O Redmine validará a atividade na
                                criação.
                              </small>
                            )}
                          {record &&
                            !["prepared", "confirmed", "existing"].includes(
                              record.state,
                            ) && (
                              <p className="settings-note">
                                {record.message} Use Ver resultado na linha para
                                conferir sem reenviar.
                              </p>
                            )}
                        </>
                      )}
                      {item.error && (
                        <p className="field-error" role="alert">
                          {item.error}
                        </p>
                      )}
                    </article>
                  );
                })}
            </section>
          ))}
        </>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="submission-actions">
        <button className="button quiet" disabled={busy} onClick={onClose}>
          {batch?.state === "prepared" ? "Voltar sem enviar" : "Fechar"}
        </button>
        {batch && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => {
              void refresh().catch(() =>
                setError(
                  "Não foi possível atualizar os resultados. Nenhum envio foi repetido.",
                ),
              );
            }}
          >
            <RefreshCw size={16} /> Atualizar resultados
          </button>
        )}
        {batch && canConfirmBatch(batch) && !confirmBlocked && (
          <button className="button primary" disabled={busy} onClick={confirm}>
            <Upload size={16} /> Confirmar envio de{" "}
            {batch.items.filter((i) => i.record?.state === "prepared").length}{" "}
            linhas
          </button>
        )}
      </div>
    </dialog>
  );
}
