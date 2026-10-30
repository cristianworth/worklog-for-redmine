import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DaySection } from "./DaySection";
import { WorklogDataProvider } from "./WorklogDataProvider";
import { createDemoDataAccess } from "./demo-data-access";
import { toEditor } from "./editor";
import type { SubmissionRecord } from "../shared/submissions";

async function fixture() {
  const data = createDemoDataAccess({ today: "2026-10-26", simulation: { wait: async () => {} } });
  const day = (await data.readDays("2026-10-21", "2026-10-21"))[0];
  const receipts: Record<string, SubmissionRecord> = {};
  for (const entry of day.entries) {
    const review = await data.prepareSubmission({ date: day.date, entryId: entry.id, revision: day.revision });
    receipts[`${day.date}:${entry.id}`] = await data.actOnSubmission(review.id, "confirm");
  }
  const props: Parameters<typeof DaySection>[0] = {
    day: toEditor(day), activities: (await data.readActivities()).activities,
    dirty: false, disabled: false, today: "2026-10-26", submissions: receipts,
    selectedEntryIds: [], copied: null, hasTemplate: false,
    onChange() {}, onCopy() {}, onSelect() {}, onSelectDay() {}, onSendDay() {},
    onResult() {}, onCollapsedChange() {}, onUseTemplate() {},
  };
  const render = (changes: Partial<typeof props> = {}) => renderToStaticMarkup(
    <WorklogDataProvider value={data}><DaySection {...props} {...changes} /></WorklogDataProvider>,
  );
  return { props, render };
}

describe("default day disclosure", () => {
  it("marks untouched required blanks without showing validation errors or marking protected receipts", async () => {
    const { props, render } = await fixture();
    const day = { ...props.day, entries: [{ ...props.day.entries[0], issue: "", duration: "", activity: "", comment: "" }] };
    const html = render({ day, submissions: {} });
    expect(html.match(/data-missing-required="true"/g)).toHaveLength(4);
    expect(html).not.toContain('aria-invalid="true"');
    expect(html).not.toContain("Informe a observação.");
    expect(render({ day })).not.toContain('data-missing-required="true"');
  });
  it("keeps the send action next to pending tasks and disables it for unsaved edits", async () => {
    const { render } = await fixture();
    const html = render({ submissions: {} });
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    expect(header).not.toContain("Enviar dia");
    expect(html).toMatch(/<footer class="day-actions">[\s\S]*aria-label="Enviar dia 21\/10\/2026"/);
    expect(render()).not.toContain('class="day-actions"');
    expect(render({ submissions: {}, dirty: true })).toMatch(/<footer[\s\S]*disabled="" aria-label="Enviar dia/);
  });
  it("collapses a fully appropriated day while keeping rows mounted", async () => {
    const { render } = await fixture();
    const html = render();
    expect(html).toContain('aria-label="Expandir tarefas de 21/10/2026"');
    expect(html).toContain('id="day-content-2026-10-21" hidden=""');
    expect(html).toContain('value="9001"');
  });
  it("keeps partial, pending, uncertain and empty days expanded", async () => {
    const { props, render } = await fixture();
    const records = Object.entries(props.submissions);
    const uncertain = { ...props.submissions, [records[1][0]]: { ...records[1][1], state: "uncertain" as const } };
    for (const changes of [
      { submissions: {} },
      { submissions: Object.fromEntries(records.slice(0, 1)) },
      { submissions: uncertain },
      { day: { ...props.day, entries: [] } },
    ]) expect(render(changes)).toContain('aria-label="Recolher tarefas de 21/10/2026"');
  });
  it("honors an explicit expansion or collapse instead of applying the default again", async () => {
    const { render } = await fixture();
    expect(render({ collapsed: false })).toContain('aria-label="Recolher tarefas de 21/10/2026"');
    expect(render({ collapsed: true, submissions: {} })).toContain('aria-label="Expandir tarefas de 21/10/2026"');
  });
});
