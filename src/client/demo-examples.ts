import type { IssueDetails } from "./data-access";
import type { DemoState } from "./demo-store";
import { isWeekday } from "./period";

export const demoIssues: IssueDetails[] = [
  { id: 9001, subject: "Melhorar a busca do catálogo fictício",
    status: { id: 1, name: "Em andamento" }, project: { id: 9101, name: "Portal Aurora — fictício" } },
  { id: 9004, subject: "Revisar validações do formulário fictício",
    status: { id: 2, name: "Em revisão" }, project: { id: 9101, name: "Portal Aurora — fictício" } },
  { id: 9007, subject: "Planejar melhorias do painel fictício",
    status: { id: 1, name: "Em andamento" }, project: { id: 9102, name: "Painel Horizonte — fictício" } },
];

function workdaysBefore(date: string, offset: number): string {
  const day = new Date(`${date}T12:00:00Z`);
  while (offset > 0) {
    day.setUTCDate(day.getUTCDate() - 1);
    if (isWeekday(day.toISOString().slice(0, 10))) offset--;
  }
  return day.toISOString().slice(0, 10);
}

export const demoStartDate = (anchorDate: string) => workdaysBefore(anchorDate, 3);

export function createDemoExamples(today: string): DemoState {
  return {
    schemaVersion: 2,
    submissions: [],
    batches: [],
    creations: [],
    anchorDate: today,
    catalog: { revision: 1, activities: [
      { activityId: 9901, name: "Desenvolvimento" },
      { activityId: 9902, name: "Revisão" },
      { activityId: 9903, name: "Reunião" },
    ] },
    days: [
      { date: demoStartDate(today), revision: 1, entries: [
        { id: "demo-search", issue: "9001", minutes: 90, activity: "Desenvolvimento", comment: "Exemplo fictício: ajustar os filtros da busca." },
        { id: "demo-search-review", issue: "9004", minutes: 30, activity: "Revisão", comment: "Exemplo fictício: revisar mensagens de validação." },
      ] },
      { date: workdaysBefore(today, 2), revision: 1, entries: [
        { id: "demo-validation", issue: "9004", minutes: 60, activity: "Revisão", comment: "Exemplo fictício: conferir campos obrigatórios." },
      ] },
      { date: workdaysBefore(today, 1), revision: 1, entries: [
        { id: "demo-planning", issue: "9007", minutes: 30, activity: "Reunião", comment: "Exemplo fictício: planejar a próxima melhoria do painel." },
      ] },
    ],
    template: { revision: 1, entries: [
      { issue: "9007", minutes: 30, activity: "Reunião", comment: "Exemplo fictício: alinhamento diário do painel." },
      { issue: "", minutes: null, activity: "Desenvolvimento", comment: "" },
    ] },
  };
}
