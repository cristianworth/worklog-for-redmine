import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ActivitySelect } from "./ActivitySelect";
const activities = [
  { activityId: 101, name: "Revisão" },
  { activityId: 103, name: "Reunião" },
];
const render = (props: Partial<Parameters<typeof ActivitySelect>[0]> = {}) =>
  renderToStaticMarkup(
    <ActivitySelect
      activities={activities}
      value=""
      label="Atividade"
      disabled={false}
      onChange={() => {}}
      {...props}
    />,
  );
describe("global activity selection", () => {
  it("sorts names alphabetically in Portuguese without reordering the catalog or changing the selected value", () => {
    const catalog = [
      { activityId: 4, name: "Zeladoria" },
      { activityId: 2, name: "reunião" },
      { activityId: 1, name: "Análise" },
      { activityId: 3, name: "Desenvolvimento" },
    ];
    const html = render({ activities: catalog, value: "reunião" });
    const labels = [...html.matchAll(/<option value="[^"]*"[^>]*>([^<]+)<\/option>/g)].map((match) => match[1]);
    expect(labels).toEqual(["Selecione uma atividade", "Análise", "Desenvolvimento", "reunião", "Zeladoria"]);
    expect(catalog.map((activity) => activity.activityId)).toEqual([4, 2, 1, 3]);
    expect(html).toContain('value="reunião" selected=""');
  });
  it("offers the full catalog before any task lookup, without selecting a default", () => {
    const html = render();
    expect(html).toContain("<select");
    expect(html).not.toContain("<input");
    expect(html).toContain('value="Revisão">Revisão</option>');
    expect(html).toContain('value="Reunião">Reunião</option>');
    expect(html).not.toContain("código");
    expect(html).not.toContain('disabled=""');
    expect(html).toMatch(/value="" selected=""/);
    expect(html).not.toContain("Consulte a tarefa");
  });
  it("resolves a saved label without consulting the issue", () => {
    expect(render({ value: " revisão " })).toMatch(
      /value="Revisão" selected=""/,
    );
  });
  it("preserves an unavailable old value without silently replacing it", () => {
    const onChange = vi.fn(),
      html = render({ value: "Historical", onChange });
    expect(html).toMatch(/value="Historical" disabled="" selected=""/);
    expect(html).toContain("fora do catálogo");
    expect(html).toContain('aria-invalid="true"');
    expect(onChange).not.toHaveBeenCalled();
  });
  it("explains empty catalogs and respects editing locks", () => {
    expect(render({ activities: [] })).toContain("Catálogo vazio");
    expect(render({ activities: [] })).toContain(
      "Cadastre atividades em Configurações",
    );
    expect(render({ disabled: true })).toContain('disabled=""');
  });
  it("shows only the original reviewed name independently of catalog changes", () => {
    const html = render({ activities: [], value: "Original", reviewedId: 909 });
    expect(html).toContain('value="Original" selected="">Original</option>');
    expect(html).not.toContain("código");
    expect(html).not.toContain("909");
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('aria-invalid="true"');
  });
});
