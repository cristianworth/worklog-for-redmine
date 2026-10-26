import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReceiptBadge } from "./ReceiptBadge";
import { createDemoDataAccess } from "./demo-data-access";

describe("simulated receipt presentation", () => {
  it("distinguishes a fictitious receipt from the unchanged local receipt labels", async () => {
    const data = createDemoDataAccess({ today: "2026-10-25", simulation: { wait: async () => {} } });
    const day = (await data.readDays("2026-10-21", "2026-10-21"))[0];
    const review = await data.prepareSubmission({ date: day.date, entryId: day.entries[0].id, revision: day.revision });
    const record = await data.actOnSubmission(review.id, "confirm");
    const simulated = renderToStaticMarkup(<ReceiptBadge record={record} />);
    expect(simulated).toContain("Simulado");
    expect(simulated).not.toContain("Apropriado em");
    const local = renderToStaticMarkup(<ReceiptBadge record={{ ...record, simulated: undefined }} />);
    expect(local).toContain("Apropriado");
    expect(local).not.toContain("Simulado");
  });
});
