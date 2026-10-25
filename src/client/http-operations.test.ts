import { describe, expect, it, vi } from "vitest";
import type { WorklogDataAccess } from "./data-access";
import { createHttpDataAccess } from "./http-data-access";

const selection = { date: "2026-10-26", entryId: "synthetic-row", revision: 1 };
const template = { revision: 1, entries: [] };
const receipt = { id: "synthetic-receipt", state: "prepared", snapshot: selection };
const batch = { id: "synthetic-batch", state: "prepared", items: [] };
const issue = { id: 9001, subject: "Synthetic issue", status: { name: "Open" }, project: { id: 9002, name: "Synthetic project" } };
interface Operation {
  name: string;
  url: string;
  method?: string;
  body?: unknown;
  response: unknown;
  expected: unknown;
  signal?: boolean;
  run(data: WorklogDataAccess, signal: AbortSignal): Promise<unknown>;
}
const operations: Operation[] = [
  { name: "read template", url: "/api/day-template", response: template, expected: template, signal: true,
    run: (data, signal) => data.readDayTemplate(signal) },
  { name: "save template", url: "/api/day-template", method: "PUT", body: template,
    response: { ...template, revision: 2 }, expected: { ...template, revision: 2 },
    run: (data) => data.saveDayTemplate(template) },
  { name: "lookup task", url: "/api/redmine/issues/9001", response: issue, expected: issue, signal: true,
    run: (data, signal) => data.readIssue("9001", false, signal) },
  { name: "refresh task", url: "/api/redmine/issues/9001?refresh=1", response: issue, expected: issue, signal: true,
    run: (data, signal) => data.readIssue("9001", true, signal) },
  { name: "read connection", url: "/api/redmine/status", response: { configured: false, hasApiKey: false, certificateException: false },
    expected: { configured: false, hasApiKey: false, certificateException: false }, signal: true,
    run: (data, signal) => data.readConnectionStatus(signal) },
  { name: "check connection", url: "/api/redmine/check", method: "POST", response: { authenticated: true }, expected: undefined,
    run: (data) => data.checkConnection() },
  { name: "list receipts", url: "/api/submissions?from=2026-10-26&to=2026-10-27", response: { submissions: [receipt] }, expected: [receipt], signal: true,
    run: (data, signal) => data.listSubmissions("2026-10-26", "2026-10-27", signal) },
  { name: "list batches", url: "/api/submission-batches?from=2026-10-26&to=2026-10-27", response: { batches: [batch] }, expected: [batch], signal: true,
    run: (data, signal) => data.listBatches("2026-10-26", "2026-10-27", signal) },
  { name: "prepare receipt", url: "/api/submissions/prepare", method: "POST", body: selection, response: receipt, expected: receipt, signal: true,
    run: (data, signal) => data.prepareSubmission(selection, signal) },
  ...(["confirm", "verify", "reconcile"] as const).map((action): Operation => ({
    name: `${action} receipt`, url: `/api/submissions/receipt%20%2F%3F/${action}`, method: "POST",
    body: action === "confirm" ? { confirmed: true } : {}, response: receipt, expected: receipt,
    run: (data) => data.actOnSubmission("receipt /?", action),
  })),
  { name: "prepare batch", url: "/api/submission-batches/prepare", method: "POST", body: { entries: [selection] }, response: batch, expected: batch,
    run: (data) => data.prepareBatch([selection]) },
  { name: "read batch", url: "/api/submission-batches/batch%20%2F%3F", response: batch, expected: batch,
    run: (data) => data.readBatch("batch /?") },
  { name: "confirm batch", url: "/api/submission-batches/batch%20%2F%3F/confirm", method: "POST", body: { confirmed: true }, response: batch, expected: batch,
    run: (data) => data.confirmBatch("batch /?") },
];

describe("remaining local HTTP contracts", () => {
  it.each(operations)("preserves URL, payload and response for $name", async (operation) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(operation.response,
      { status: operation.name === "confirm batch" ? 202 : 200 }));
    const controller = new AbortController();
    expect(await operation.run(createHttpDataAccess(request), controller.signal)).toEqual(operation.expected);
    expect(request).toHaveBeenCalledTimes(1);
    const [url, options] = request.mock.calls[0];
    expect(url).toBe(operation.url);
    expect(options?.method).toBe(operation.method);
    expect(options?.body).toBe(operation.body === undefined ? undefined : JSON.stringify(operation.body));
    if (operation.body !== undefined) expect(options?.headers).toEqual({ "Content-Type": "application/json" });
    expect(options?.signal).toBe(operation.signal ? controller.signal : undefined);
  });

  it.each(operations)("keeps server errors and never retries $name", async (operation) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: "Synthetic conflict" }, { status: 409 }));
    await expect(operation.run(createHttpDataAccess(request), new AbortController().signal))
      .rejects.toMatchObject({ status: 409, message: "Synthetic conflict" });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(operations.filter((operation) => operation.signal))("propagates cancellation of $name", async (operation) => {
    const aborted = new DOMException("Synthetic abort", "AbortError");
    const request = vi.fn<typeof fetch>().mockRejectedValue(aborted);
    await expect(operation.run(createHttpDataAccess(request), new AbortController().signal)).rejects.toBe(aborted);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rejects incomplete template acknowledgements, wrong tasks and malformed lists/batches", async () => {
    const data = (body: unknown) => createHttpDataAccess(vi.fn<typeof fetch>().mockResolvedValue(Response.json(body)));
    await expect(data(template).saveDayTemplate(template)).rejects.toThrow("confirmar o salvamento");
    await expect(data({ ...template, revision: 2, entries: [{ issue: "", minutes: null, activity: "", comment: "" }] }).saveDayTemplate(template)).rejects.toThrow("confirmar o salvamento");
    await expect(data({ ...issue, id: 9009 }).readIssue("9001", false)).rejects.toThrow("Resposta inválida");
    await expect(data({ authenticated: false }).checkConnection()).rejects.toThrow("não confirmou");
    await expect(data({ submissions: null }).listSubmissions(selection.date, selection.date)).rejects.toThrow("Lista de recibos inválida");
    await expect(data({ batches: null }).listBatches(selection.date, selection.date)).rejects.toThrow("Lista de lotes inválida");
    await expect(data({ ...batch, state: "unknown" }).readBatch(batch.id)).rejects.toThrow("resultado do lote é inválido");
  });
});
