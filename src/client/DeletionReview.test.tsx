import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeletionReview } from "./DeletionReview";
import { WorklogDataProvider } from "./WorklogDataProvider";
import { createDemoDataAccess } from "./demo-data-access";
import { createHttpDataAccess } from "./http-data-access";
import { nextDeletion } from "../shared/submissions";

describe("deletion review presentation", () => {
  it("identifies the time entry and both consequences, with cancel as the initial focus", async () => {
    const data = createDemoDataAccess({ today: "2026-11-24", simulation: { wait: async () => {} } });
    const day = (await data.readDays("2026-11-19", "2026-11-19"))[0];
    const prepared = await data.prepareSubmission({ date: day.date, entryId: day.entries[0].id, revision: day.revision });
    const record = await data.actOnSubmission(prepared.id, "confirm");
    const render = (demo: boolean, initial = record) => renderToStaticMarkup(
      <WorklogDataProvider value={demo ? data : createHttpDataAccess()}>
        <DeletionReview initial={initial} revision={day.revision} onRecord={() => {}} onDeleted={() => {}} onClose={() => {}} />
      </WorklogDataProvider>);
    const local = render(false);
    expect(local).toContain("Excluir do Redmine e do Worklog");
    expect(local).toContain("Tarefa #9001");
    expect(local).toContain("19/11/2026");
    expect(local).toContain("01:30");
    expect(local).toContain("tarefa/card será preservada");
    expect(local).toMatch(/<button autofocus=""[^>]*>Cancelar<\/button>/);
    expect(render(true)).toContain("Confirmar exclusão simulada");
    expect(render(true)).toContain("Nenhum acesso ao Redmine será realizado");
    const interrupted = { ...record, deletion: nextDeletion(record, "uncertain", "Synthetic lost response", new Date().toISOString()) };
    const recovery = render(false, interrupted);
    expect(recovery).toContain("Conferir exclusão");
    expect(recovery).not.toContain("Excluir do Redmine e do Worklog");
    expect(recovery).toContain("Histórico da exclusão");
  });
});
