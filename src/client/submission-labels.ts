import type { SubmissionRecord } from "../shared/submissions";

export const submissionLabel: Record<SubmissionRecord["state"], string> = {
  prepared: "Revisão pronta",
  sending: "Envio iniciado",
  confirmed: "Apropriado",
  rejected: "Recusado",
  uncertain: "Resultado incerto",
  existing: "Já existente no Redmine",
  deleted: "Excluído · recibo preservado",
};

export const demoSubmissionLabel: typeof submissionLabel = {
  prepared: "Aguardando simulação",
  sending: "Simulação iniciada",
  confirmed: "Simulado",
  rejected: "Simulação recusada",
  uncertain: "Resultado simulado incerto",
  existing: "Simulação já existente",
  deleted: "Exclusão simulada · recibo preservado",
};
