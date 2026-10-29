import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DurationField } from "./DurationField";

const render = (changes: Partial<Parameters<typeof DurationField>[0]> = {}) => renderToStaticMarkup(
  <DurationField value="01:00" label="da linha 1 em 21/10/2026" disabled={false} locked={false} onChange={() => {}} {...changes} />,
);

describe("quick duration addition controls", () => {
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
