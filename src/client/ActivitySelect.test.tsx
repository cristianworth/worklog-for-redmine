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
  it("offers the full catalog before any task lookup, without selecting a default", () => {
    const html = render();
    expect(html).toContain("<select");
    expect(html).not.toContain("<input");
    expect(html).toContain("código 101");
    expect(html).toContain("código 103");
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
  it("preserves the original receipt code independently of catalog changes", () => {
    const html = render({ activities: [], value: "Original", reviewedId: 909 });
    expect(html).toContain("Original · código 909");
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('aria-invalid="true"');
  });
});
