import type { SubmissionRecord } from "../shared/submissions";

export const submissionLabel: Record<SubmissionRecord["state"], string> = {
  prepared: "Revisão pronta",
  sending: "Envio iniciado",
  confirmed: "Apropriado",
  rejected: "Recusado",
  uncertain: "Resultado incerto",
  existing: "Já existente no Redmine",
};

export const demoSubmissionLabel: typeof submissionLabel = {
  prepared: "Aguardando simulação",
  sending: "Simulação iniciada",
  confirmed: "Simulado",
  rejected: "Simulação recusada",
  uncertain: "Resultado simulado incerto",
  existing: "Simulação já existente",
};
