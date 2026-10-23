import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ActivitySelect } from "./ActivitySelect";

const activities = [
  { projectId: 10, activityId: 101, name: "Revisão" },
  { projectId: 20, activityId: 202, name: "Revisão" },
  { projectId: 10, activityId: 103, name: "Reunião" },
];
const render = (props: Partial<Parameters<typeof ActivitySelect>[0]> = {}) =>
  renderToStaticMarkup(
    <ActivitySelect
      activities={activities}
      projectId={10}
      value=""
      label="Atividade"
      disabled={false}
      onChange={() => {}}
      {...props}
    />,
  );

describe("closed activity selection", () => {
  it("offers a native selector with only the current project's names and codes", () => {
    const html = render();
    expect(html).toContain("<select");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<datalist");
    expect(html).toContain("código 101");
    expect(html).toContain("código 103");
    expect(html).not.toContain("código 202");
    expect(html).toMatch(/value="" selected=""/);
  });
  it("resolves the same historical label to the code in the identified project", () => {
    const html = render({ projectId: 20, value: " revisão " });
    expect(html).toMatch(/value="Revisão" selected=""/);
    expect(html).toContain("código 202");
    expect(html).not.toContain("código 101");
  });
  it("keeps an unmapped historical value visible without making it a selectable activity", () => {
    const onChange = vi.fn();
    const html = render({ value: "Historical activity", onChange });
    expect(html).toMatch(/value="Historical activity" disabled="" selected=""/);
    expect(html).toContain("sem vínculo");
    expect(html).toContain('aria-invalid="true"');
    expect(onChange).not.toHaveBeenCalled();
  });
  it("does not offer global activities before the task project is known", () => {
    const html = render({ projectId: undefined, value: "Historical activity" });
    expect(html).toContain('disabled=""');
    expect(html).toContain("aguardando consulta");
    expect(html).not.toContain("código 101");
    expect(html).not.toContain("código 202");
  });
  it("explains an empty project catalog instead of selecting an invented default", () => {
    const html = render({ projectId: 30 });
    expect(html).toContain("Catálogo do projeto vazio");
    expect(html).toContain("Cadastre atividades do projeto #30");
    expect(html).not.toContain("código 101");
  });
  it("displays and locks the receipt code independently of later catalog changes", () => {
    const html = render({
      activities: [],
      projectId: undefined,
      value: "Original activity",
      reviewedId: 909,
    });
    expect(html).toContain('disabled=""');
    expect(html).toContain("Original activity · código 909");
    expect(html).toContain("Atividade revisada · código 909");
    expect(html).not.toContain('aria-invalid="true"');
  });
});
