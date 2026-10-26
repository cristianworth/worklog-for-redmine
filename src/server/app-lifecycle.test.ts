import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app";
import { openDraftStore } from "./storage";

const cleanup: (() => Promise<void>)[] = [];
async function setup(managed = true) {
  const store = openDraftStore(":memory:");
  const shutdown = vi.fn();
  const app = createApp(store, undefined, { instanceId: "fictional-instance", version: "0.7.0",
    ...(managed ? { shutdownToken: "fictional-token", shutdown } : {}) });
  const server = await new Promise<Server>((resolve) => { const server = app.listen(0, "127.0.0.1", () => resolve(server)); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  cleanup.push(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); store.close(); });
  return { app, base, shutdown };
}
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });

describe("launcher readiness and controlled shutdown", () => {
  it("reports only public runtime identity, without caching or configuration", async () => {
    const t = await setup(), response = await fetch(`${t.base}/api/health`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ application: "worklog-for-redmine", instanceId: "fictional-instance", version: "0.7.0" });
  });
  it("disables shutdown for manually started services", async () => {
    const t = await setup(false);
    expect((await fetch(`${t.base}/api/launcher/shutdown`, { method: "POST" })).status).toBe(404);
    expect(t.shutdown).not.toHaveBeenCalled();
  });
  it("rejects missing/wrong tokens and cross-origin writes", async () => {
    const t = await setup();
    const cases: Record<string, string>[] = [{}, { authorization: "Bearer wrong" }, { authorization: "Bearer fictional-token", origin: "https://example.test" }];
    for (const headers of cases)
      expect((await fetch(`${t.base}/api/launcher/shutdown`, { method: "POST", headers })).status).toBe(403);
    expect(t.shutdown).not.toHaveBeenCalled();
  });
  it("acknowledges a valid stop before invoking shutdown", async () => {
    const t = await setup();
    const response = await fetch(`${t.base}/api/launcher/shutdown`, { method: "POST", headers: { authorization: "Bearer fictional-token" } });
    expect(response.status).toBe(202);
    await vi.waitFor(() => expect(t.shutdown).toHaveBeenCalledOnce());
  });
  it("refuses shutdown while a write is in progress", async () => {
    const t = await setup(); let release!: () => void, started!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const entering = new Promise<void>((resolve) => { started = resolve; });
    t.app.post("/fictional-write", async (_req, res) => { started(); await pending; res.sendStatus(204); });
    const write = fetch(`${t.base}/fictional-write`, { method: "POST" });
    await entering;
    try {
      const response = await fetch(`${t.base}/api/launcher/shutdown`, { method: "POST", headers: { authorization: "Bearer fictional-token" } });
      expect(response.status).toBe(409); expect(t.shutdown).not.toHaveBeenCalled();
    } finally { release(); await write; }
  });
});
