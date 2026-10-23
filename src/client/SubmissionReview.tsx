import { ReceiptBadge, formatReceiptDate } from "./ReceiptBadge";
import { hasVerificationProblem, isAppropriated } from "../shared/submissions";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, Upload, X, RefreshCw } from "lucide-react";
import { formatDuration } from "../shared/worklogs";
import { type SubmissionRecord } from "../shared/submissions";
import { shortDate } from "./period";
export const submissionLabel = {
  prepared: "Revisão pronta",
  sending: "Envio iniciado",
  confirmed: "Apropriado",
  rejected: "Recusado",
  uncertain: "Resultado incerto",
  existing: "Já existente no Redmine",
};
export function SubmissionReview({
  date,
  entryId,
  revision,
  onClose,
  onRecord,
}: {
  date: string;
  entryId: string;
  revision: number;
  onClose(): void;
  onRecord(record: SubmissionRecord): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [record, setRecord] = useState<SubmissionRecord | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    fetch("/api/submissions/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, entryId, revision }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Não foi possível preparar a revisão.");
        if (
          !data.snapshot ||
          data.snapshot.date !== date ||
          data.snapshot.entryId !== entryId ||
          !submissionLabel[data.state as keyof typeof submissionLabel]
        )
          throw new Error("A revisão recebida é inválida.");
        if (!controller.signal.aborted) {
          setRecord(data);
          onRecord(data);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Falha ao preparar revisão.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [date, entryId, revision, retry, onRecord]);
  async function act(kind: "confirm" | "reconcile" | "verify") {
    if (!record || busy) return;
    setBusy(true);
    setError("");
    if (kind === "confirm") {
      const pending = {
        ...record,
        state: "sending" as const,
        message: "Envio iniciado. Aguarde a confirmação.",
        updatedAt: new Date().toISOString(),
      };
      setRecord(pending);
      onRecord(pending);
    }
    try {
      const response = await fetch(
        `/api/submissions/${encodeURIComponent(record.id)}/${kind}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(kind === "confirm" ? { confirmed: true } : {}),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "Não foi possível concluir esta operação.",
        );
      if (
        data.id !== record.id ||
        !submissionLabel[data.state as keyof typeof submissionLabel]
      )
        throw new Error(
          "Não foi possível confirmar a resposta local. Feche e consulte o resultado antes de reenviar.",
        );
      setRecord(data);
      onRecord(data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "A resposta do envio não chegou. Confira o resultado antes de qualquer novo envio.",
      );
    } finally {
      setBusy(false);
    }
  }
  const s = record?.snapshot;
  return (
    <dialog
      ref={dialog}
      className="submission-dialog"
      aria-labelledby="submission-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="submission-heading">
        <div>
          <p className="eyebrow">ENVIO INDIVIDUAL</p>
          <h2 id="submission-title">
            {record?.state === "prepared"
              ? "Revise antes de enviar"
              : "Resultado do lançamento"}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label="Fechar revisão"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {busy && !record && (
        <p className="notice" role="status">
          <LoaderCircle size={17} className="spin" />
          Consultando a tarefa, a conta e os lançamentos existentes…
        </p>
      )}
      {s && (
        <>
          <div className="submission-issue">
            <strong>
              #{s.issueId} · {s.subject}
            </strong>
            <small>
              {s.projectName} · projeto #{s.projectId}
            </small>
          </div>
          <dl className="submission-details">
            <div>
              <dt>Dia</dt>
              <dd>{shortDate(s.date)}</dd>
            </div>
            <div>
              <dt>Duração</dt>
              <dd>{formatDuration(s.minutes)}</dd>
            </div>
            <div>
              <dt>Atividade</dt>
              <dd>
                {s.activityName}
                <small>Código {s.activityId}</small>
              </dd>
            </div>
            <div>
              <dt>Status do card</dt>
              <dd>
                Manter<small>{s.statusName}</small>
              </dd>
            </div>
          </dl>
          <div className="submission-comment">
            <span>Observação</span>
            <p>{s.comment}</p>
          </div>
          {record && ["confirmed", "existing"].includes(record.state) && (
            <div className="receipt-details">
              <ReceiptBadge record={record} />
              <dl>
                <div>
                  <dt>Última conferência</dt>
                  <dd>{formatReceiptDate(record.lastCheckedAt)}</dd>
                </div>
                <div>
                  <dt>Origem</dt>
                  <dd>
                    {record.origin === "imported"
                      ? "Histórico confirmado incorporado"
                      : record.state === "existing"
                        ? "Lançamento encontrado no Redmine"
                        : "Enviado por esta aplicação"}
                  </dd>
                </div>
              </dl>
            </div>
          )}
          {!s.activityVerified && record?.state === "prepared" && (
            <p className="certificate-warning">
              Esta API não disponibiliza o catálogo do projeto. Confira o código
              configurado para a atividade; o Redmine validará sua aceitação na
              criação.
            </p>
          )}
          <p
            className={`submission-result result-${record && hasVerificationProblem(record) ? "uncertain" : record?.state}`}
            role="status"
          >
            <strong>
              {hasVerificationProblem(record!)
                ? "Apropriação a conferir"
                : submissionLabel[record!.state]}
              {record?.remoteId ? ` · #${record.remoteId}` : ""}
            </strong>
            <span>{record?.message}</span>
          </p>
          {record?.state === "sending" && (
            <p className="settings-note">
              Se a aplicação foi interrompida, aguarde um minuto e use Conferir
              resultado. Essa ação consulta o Redmine e não cria outro
              lançamento.
            </p>
          )}
        </>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="submission-actions">
        <button className="button quiet" disabled={busy} onClick={onClose}>
          {record?.state === "prepared" ? "Cancelar" : "Fechar"}
        </button>
        {(!record ||
          record.state === "rejected" ||
          (!!error && record.state === "prepared")) &&
          !busy && (
            <button
              className="button secondary"
              onClick={() => setRetry((current) => current + 1)}
            >
              <RefreshCw size={16} />
              Preparar nova revisão
            </button>
          )}
        {(record?.state === "uncertain" || record?.state === "sending") && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => act("reconcile")}
          >
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <RefreshCw size={16} />
            )}
            Conferir resultado
          </button>
        )}
        {record?.state === "prepared" && (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => act("confirm")}
          >
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Upload size={16} />
            )}
            Confirmar envio ao Redmine
          </button>
        )}
        {(record?.state === "confirmed" || record?.state === "existing") && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => act("verify")}
          >
            <RefreshCw size={16} /> Conferir no Redmine
          </button>
        )}
        {isAppropriated(record ?? undefined) && (
          <CheckCircle2 size={22} className="receipt-check" />
        )}
      </div>
    </dialog>
  );
}
