import { hasVerificationProblem } from "../shared/submissions";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, RefreshCw, Upload, X } from "lucide-react";
import {
  canConfirmBatch,
  type BatchSelection,
  type SubmissionBatch,
} from "../shared/batches";
import { formatDuration } from "../shared/worklogs";
import { shortDate } from "./period";
import { demoSubmissionLabel, submissionLabel } from "./submission-labels";
import { useWorklogData } from "./WorklogDataProvider";
import { BatchProgress } from "./BatchProgress";

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
  const data = useWorklogData();
  const dialog = useRef<HTMLDialogElement>(null);
  const preparation = useRef<Promise<SubmissionBatch> | null>(null);
  const [batch, setBatch] = useState<SubmissionBatch | null>(null);
  const [operation, setOperation] = useState<"preparing" | "confirming" | "refreshing" | null>("preparing");
  const busy = operation !== null;
  const [confirmBlocked, setConfirmBlocked] = useState(false);
  const [error, setError] = useState("");
  const pendingCount = batch?.items.filter((item) => item.record?.state === "prepared").length ?? 0;
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
    preparation.current ??= batchId
      ? data.readBatch(batchId)
      : data.prepareBatch(entries ?? []);
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
        if (alive) setOperation(null);
      });
    return () => {
      alive = false;
    };
  }, [data, entries, batchId, accept]);
  const currentId = batch?.id;
  const refresh = useCallback(async () => {
    if (!currentId) return;
    setOperation("refreshing");
    try {
      const next = await data.readBatch(currentId);
      accept(next);
      setError("");
    } finally {
      setOperation(null);
    }
  }, [data, currentId, accept]);
  useEffect(() => {
    if (!currentId || batch?.state !== "running") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await data.readBatch(currentId);
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
  }, [data, currentId, batch?.state, accept]);
  async function confirm() {
    if (!batch || busy || confirmBlocked || !canConfirmBatch(batch)) return;
    setOperation("confirming");
    setConfirmBlocked(true);
    setError("");
    try {
      accept(await data.confirmBatch(batch.id));
    } catch (err) {
      // A lost local response may hide an already running worker. Read before exposing confirmation again.
      setBatch((current) =>
        current ? { ...current, state: "running" } : current,
      );
      const reason =
        err instanceof Error ? err.message : "A confirmação não chegou.";
      try {
        accept(await data.readBatch(batch.id));
      } catch {
        /* Polling remains read-only. */
      }
      setError(
        `${reason} Confira os resultados. Se o lote não iniciou, feche e prepare uma nova revisão.`,
      );
    } finally {
      setOperation(null);
    }
  }
  const dates = [
    ...new Set(batch?.items.map((item) => item.selection.date) ?? []),
  ];
  const running = operation === "confirming" || batch?.state === "running";
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
          <p className="review-context">{data.mode === "demo" ? "Simulação por dia ou período" : "Envio por dia ou período"}</p>
          <h2 id="batch-title">
            {running
              ? data.mode === "demo" ? "Acompanhe a simulação" : "Acompanhe o envio"
              : !batch || batch.state === "prepared"
              ? data.mode === "demo" ? "Revise antes de simular" : "Revise o lote antes de enviar"
              : data.mode === "demo" ? "Resultados simulados" : "Resultados do lote"}
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
          <BatchProgress batch={batch} confirming={operation === "confirming"} simulated={data.mode === "demo"} />
          <p className="batch-summary" role="status">
            {batch.items.length} {batch.items.length === 1 ? "linha" : "linhas"} · {dates.length}{" "}
            {dates.length === 1 ? "dia" : "dias"}. {operation === "confirming" ? "Solicitando o início da execução. Aguarde a confirmação." : batch.message}
          </p>
          <p className="settings-note">
            {data.mode === "demo" ? <>
              Toda a seleção será validada antes de criar recibos fictícios. Um impedimento bloqueia o lote inteiro;
              uma falha posterior preserva os resultados anteriores. O status dos cards não muda.
              Fechar a revisão mantém a simulação nesta página; recarregar pode interrompê-la sem retomada automática.
            </> : <>
            Todas as tarefas selecionadas serão validadas antes do primeiro envio.
            Um impedimento bloqueia o lote inteiro. Depois de iniciar as criações,
            uma falha interrompe as próximas linhas e preserva as anteriores.
            Status dos cards: <strong>Manter</strong>. Fechar esta janela após
            confirmar não cancela a execução.
            </>}
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
                        ? hasVerificationProblem(record)
                          ? "Apropriação a conferir"
                          : (data.mode === "demo" ? demoSubmissionLabel : submissionLabel)[record.state]
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
                          className={`result-${record && hasVerificationProblem(record) ? "uncertain" : (record?.state ?? "rejected")}`}
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
            {operation === "refreshing" ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
            {operation === "refreshing" ? "Atualizando resultados…" : "Atualizar resultados"}
          </button>
        )}
        {batch && canConfirmBatch(batch) && !confirmBlocked && (
          <button className="button primary" disabled={busy} onClick={confirm}>
            <Upload size={16} /> {data.mode === "demo" ? "Confirmar simulação de" : "Confirmar envio de"}{" "}
            {pendingCount} {pendingCount === 1 ? "linha" : "linhas"}
          </button>
        )}
      </div>
    </dialog>
  );
}
