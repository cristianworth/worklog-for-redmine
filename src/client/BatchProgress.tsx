import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import type { SubmissionBatch } from "../shared/batches";
import { isAppropriated } from "../shared/submissions";
import { shortDate } from "./period";

export function BatchProgress({ batch, confirming, simulated }: {
  batch: SubmissionBatch;
  confirming: boolean;
  simulated: boolean;
}) {
  if (batch.state === "prepared" && !confirming) return null;
  const active = confirming || batch.state === "running";
  const completed = batch.items.filter((item) => item.error ||
    (item.record && !["prepared", "sending"].includes(item.record.state))).length;
  const confirmed = batch.items.filter((item) => item.record && isAppropriated(item.record) && !item.error).length;
  const succeeded = batch.state === "finished" && confirmed === batch.items.length;
  const current = batch.items.find((item) => item.record?.state === "sending");
  const title = active
    ? confirming
      ? simulated ? "Iniciando simulação…" : "Iniciando envio…"
      : simulated ? "Simulação em andamento…" : "Envio em andamento…"
    : succeeded
      ? simulated ? "Simulação concluída com sucesso" : "Envio concluído com sucesso"
      : "Execução encerrada com pendências";
  return (
    <section className={`batch-progress ${active ? "is-running" : succeeded ? "is-success" : "has-pending"}`}
      aria-label="Progresso do envio">
      <div role="status" aria-live="polite" aria-atomic="true">
        <strong>
          {active ? <LoaderCircle className="spin" size={20} aria-hidden="true" />
            : succeeded ? <CheckCircle2 size={20} aria-hidden="true" />
              : <CircleAlert size={20} aria-hidden="true" />}
          {title}
        </strong>
        <p>{completed} de {batch.items.length} linhas processadas · {confirmed} {simulated
          ? confirmed === 1 ? "simulada" : "simuladas"
          : confirmed === 1 ? "confirmada" : "confirmadas"}.</p>
        <p>{active
          ? current?.record
            ? `Processando ${shortDate(current.selection.date)} · tarefa #${current.record.snapshot.issueId}. Aguarde o resultado.`
            : "Validando a seleção e aguardando resultados. Isso pode levar alguns instantes."
          : succeeded
            ? simulated ? "Recibos fictícios salvos. Nenhuma hora foi enviada ao Redmine." : "Resultados confirmados e recibos salvos."
            : "Confira os impedimentos e os recibos abaixo. Nenhum envio será repetido automaticamente."}</p>
      </div>
      <progress max={batch.items.length || 1} value={completed} aria-label="Linhas processadas" />
    </section>
  );
}
