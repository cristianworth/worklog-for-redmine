import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BatchProgress } from "./BatchProgress";
import { createDemoDataAccess } from "./demo-data-access";
import type { SubmissionBatch } from "../shared/batches";

async function fixture() {
  const data = createDemoDataAccess({ today: "2026-10-26" });
  const days = await data.readDays("2026-10-21", "2026-10-22");
  return data.prepareBatch(days.flatMap((day) => day.entries.map((entry) => ({ date: day.date, entryId: entry.id, revision: day.revision }))));
}
const render = (batch: SubmissionBatch, confirming = false, simulated = false) =>
  renderToStaticMarkup(<BatchProgress batch={batch} confirming={confirming} simulated={simulated} />);

describe("batch execution feedback", () => {
  it("shows immediate confirmation feedback before the server accepts execution, without claiming success", async () => {
    const batch = await fixture();
    expect(render(batch)).toBe("");
    const html = render(batch, true);
    expect(html).toContain("Iniciando envio…");
    expect(html).toContain("Validando a seleção");
    expect(html).toContain('role="status"');
    expect(html).toContain('value="0"');
    expect(html).not.toContain("com sucesso");
  });
  it("reports counts and the current date/task from received receipts while waiting rows do not count as processed", async () => {
    const batch = await fixture();
    batch.state = "running";
    batch.items[0].record!.state = "confirmed";
    batch.items[1].record!.state = "sending";
    const html = render(batch);
    expect(html).toContain(`1 de ${batch.items.length} linhas processadas · 1 confirmada.`);
    expect(html).toContain("Processando 21/10/2026 · tarefa #");
    expect(html).toContain('value="1"');
    expect(html).not.toContain("com sucesso");
  });
  it("announces success only when every receipt is confirmed or existing and keeps demo results explicit", async () => {
    const batch = await fixture();
    batch.state = "finished";
    batch.items.forEach((item, index) => { item.record!.state = index ? "confirmed" : "existing"; });
    expect(render(batch)).toContain("Envio concluído com sucesso");
    const html = render(batch, false, true);
    expect(html).toContain("Simulação concluída com sucesso");
    expect(html).toContain("Nenhuma hora foi enviada ao Redmine");
    expect(html).not.toContain("linhas processadas · 0");
  });
  it("preserves partial progress and warns instead of showing success after uncertainty or preflight failure", async () => {
    const batch = await fixture();
    batch.state = "interrupted";
    batch.items[0].record!.state = "confirmed";
    batch.items[1].record!.state = "uncertain";
    const html = render(batch);
    expect(html).toContain(`2 de ${batch.items.length} linhas processadas · 1 confirmada.`);
    expect(html).toContain("Execução encerrada com pendências");
    expect(html).not.toContain("com sucesso");
    const blocked = await fixture();
    blocked.state = "interrupted";
    blocked.items[0].error = "Revisão obsoleta";
    blocked.items[0].record = null;
    expect(render(blocked)).toContain("Nenhum envio será repetido automaticamente");
    expect(render(blocked)).not.toContain("com sucesso");
  });
  it("does not claim success for a finished batch whose confirmation no longer matches", async () => {
    const batch = await fixture();
    batch.state = "finished";
    batch.items.forEach((item) => { item.record!.state = "confirmed"; });
    batch.items[0].record!.verification = "missing";
    expect(render(batch)).toContain("Execução encerrada com pendências");
    expect(render(batch)).not.toContain("com sucesso");
  });
});
