import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DurationField } from "./DurationField";

const render = (changes: Partial<Parameters<typeof DurationField>[0]> = {}) => renderToStaticMarkup(
  <DurationField value="01:00" label="da linha 1 em 21/10/2026" disabled={false} locked={false} onChange={() => {}} {...changes} />,
);

describe("quick duration addition controls", () => {
  it("places the duration before its addition button in visual and keyboard order", () => {
    const html = render();
    expect(html.indexOf('<input')).toBeLessThan(html.indexOf('<button'));
  });
  it("connects a missing-duration error to the field while still allowing addition from zero", () => {
    const html = render({ value: "", required: true, error: "Informe a duração." });
    expect(html).toContain('aria-required="true"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Informe a duração.");
    expect(html).not.toContain('disabled=""');
    expect(html).not.toMatch(/<input[^>]*\srequired=/);
  });
  it("offers an explicitly labeled addition action without changing the initial duration", () => {
    const html = render();
    expect(html).toContain('aria-label="Somar tempo da linha 1 em 21/10/2026"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('value="01:00"');
    expect(html).not.toContain('disabled=""');
  });
  it("blocks both editing and addition on a protected receipt", () => {
    const html = render({ locked: true });
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).not.toContain("130 →");
  });
  it("does not offer an addition that would replace an invalid base", () => {
    const html = render({ value: "01:60" });
    expect(html.match(/disabled=""/g)).toHaveLength(1);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('value="01:60"');
  });
});
