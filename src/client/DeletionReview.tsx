import { useEffect, useRef, useState } from "react";
import { canDeleteSubmission, type SubmissionRecord } from "../shared/submissions";
import { formatDuration } from "../shared/worklogs";
import { shortDate } from "./period";
import { useWorklogData } from "./WorklogDataProvider";
import { formatReceiptDate } from "./ReceiptBadge";

export function DeletionReview({ initial, revision, onRecord, onDeleted, onClose }: {
  initial: SubmissionRecord;
  revision: number;
  onRecord(record: SubmissionRecord): void;
  onDeleted(): void;
  onClose(): void;
}) {
  const access = useWorklogData();
  const dialog = useRef<HTMLDialogElement>(null);
  const [record, setRecord] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsCheck, setNeedsCheck] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  async function act(remove: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const next = remove ? await access.deleteSubmission(record.id, revision)
        : await access.actOnSubmission(record.id, "recover-deletion");
      if (next.id !== record.id || next.snapshot.date !== record.snapshot.date ||
        next.snapshot.entryId !== record.snapshot.entryId || !next.deletion)
        throw new Error("A resposta não confirmou a operação. Feche e recarregue os resultados para conferir.");
      setRecord(next);
      onRecord(next);
      setNeedsCheck(false);
      if (next.state === "deleted") onDeleted();
    } catch (error) {
      setNeedsCheck(true);
      setError(error instanceof Error ? error.message : "Não foi possível confirmar a exclusão. Confira o resultado.");
    } finally { setBusy(false); }
  }
  const s = record.snapshot;
  const simulated = access.mode === "demo";
  return <dialog ref={dialog} className="submission-dialog" aria-labelledby="deletion-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="submission-heading"><h2 id="deletion-title">{simulated ? "Simular exclusão da linha?" : "Remover linha apropriada?"}</h2></div>
    <p>{simulated
      ? "Esta ação simula a exclusão do lançamento e remove a linha do Worklog neste navegador. Nenhum acesso ao Redmine será realizado."
      : "Esta ação excluirá o lançamento de horas do Redmine e removerá a linha do Worklog."}</p>
    <div className="submission-issue"><strong>Tarefa #{s.issueId} · {s.subject}</strong></div>
    <dl className="submission-details">
      <div><dt>Data</dt><dd>{shortDate(s.date)}</dd></div>
      <div><dt>Duração</dt><dd>{formatDuration(s.minutes)}</dd></div>
      <div><dt>{simulated ? "ID fictício" : "Lançamento no Redmine"}</dt><dd>#{record.remoteId}</dd></div>
      <div><dt>Atividade</dt><dd>{s.activityName}</dd></div>
    </dl>
    <div className="submission-comment"><span>Observação</span><p>{s.comment}</p></div>
    <p>A tarefa/card será preservada. A remoção não pode ser desfeita por este aplicativo; o recibo ficará no histórico.</p>
    {record.deletion && <div className="submission-result result-uncertain" role="status"><strong>Resultado da exclusão{simulated ? " simulada" : ""}</strong><span>{record.message}</span></div>}
    {record.deletion && <details><summary>Histórico da exclusão{simulated ? " simulada" : ""}</summary><ul>{record.deletion.events.map((event, index) =>
      <li key={index}>{formatReceiptDate(event.at)} · {event.message}</li>)}</ul></details>}
    {error && <p className="field-error" role="alert">{error}</p>}
    {busy && <p role="status">{simulated ? "Simulando exclusão…" : "Conferindo e processando a exclusão…"}</p>}
    <div className="submission-actions">
      <button autoFocus className="button quiet" disabled={busy} onClick={onClose}>{record.deletion ? "Fechar" : "Cancelar"}</button>
      {(record.deletion || needsCheck) && record.state !== "deleted" && <button className="button secondary" disabled={busy} onClick={() => act(false)}>Conferir exclusão</button>}
      {canDeleteSubmission(record) && !needsCheck && <button className="button primary" disabled={busy} onClick={() => act(true)}>
        {simulated ? "Confirmar exclusão simulada" : "Excluir do Redmine e do Worklog"}
      </button>}
    </div>
  </dialog>;
}
