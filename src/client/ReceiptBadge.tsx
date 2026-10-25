import {
  CheckCircle2,
  Clock3,
  AlertTriangle,
  Circle,
  CircleX,
} from "lucide-react";
import {
  hasVerificationProblem,
  isAppropriated,
  normalizeReceipt,
  type SubmissionRecord,
} from "../shared/submissions";

const formatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
export function formatReceiptDate(value?: string | null): string {
  return value && Number.isFinite(Date.parse(value))
    ? formatter.format(new Date(value))
    : "Não disponível";
}
export function ReceiptBadge({ record }: { record?: SubmissionRecord }) {
  const receipt = record ? normalizeReceipt(record) : undefined;
  const problem = receipt && hasVerificationProblem(receipt);
  const complete = isAppropriated(receipt);
  const creation = receipt?.remoteCreatedAt ?? receipt?.confirmedAt;
  const checking =
    problem || receipt?.state === "sending" || receipt?.state === "uncertain";
  const rejected = receipt?.state === "rejected";
  const label = receipt?.simulated && complete
    ? receipt.state === "existing" ? "Simulação existente" : "Simulado"
    : problem
    ? "Apropriação a conferir"
    : receipt?.state === "existing"
      ? "Já apropriado no Redmine"
      : complete
        ? "Apropriado"
        : receipt?.state === "sending"
          ? "Aguardando confirmação"
          : receipt?.state === "uncertain"
            ? "Conferir resultado"
            : rejected
              ? "Recusado"
              : "Pendente";
  const Icon = complete
    ? CheckCircle2
    : problem
      ? AlertTriangle
      : checking
        ? Clock3
        : rejected
          ? CircleX
          : Circle;
  return (
    <div
      className={`receipt-badge receipt-${complete ? "complete" : checking ? "checking" : rejected ? "rejected" : "pending"}`}
    >
      <span className="receipt-state">
        <Icon size={14} aria-hidden="true" />
        <strong>{receipt?.simulated && !complete ? `${label} · simulado` : label}</strong>
        {receipt?.remoteId && (
          <span className="receipt-id">#{receipt.remoteId}</span>
        )}
      </span>
      {complete && creation && (
        <small>
          {receipt?.simulated ? "Simulado em" : receipt?.remoteCreatedAt ? "Apropriado em" : "Confirmado em"}{" "}
          {formatReceiptDate(creation)}
        </small>
      )}
      {complete && !creation && receipt?.lastCheckedAt && (
        <small>Conferido em {formatReceiptDate(receipt.lastCheckedAt)}</small>
      )}
      {problem && creation && (
        <small>Confirmação original: {formatReceiptDate(creation)}</small>
      )}
      {receipt?.origin === "imported" && (
        <small>Histórico confirmado incorporado</small>
      )}
    </div>
  );
}
