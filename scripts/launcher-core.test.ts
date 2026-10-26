import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applicationIdentity } from "../src/server/runtime-info.mjs";
import { assertNodeVersion, configuredPort, dependenciesReady, sourceFingerprint, readHealth, launchWorklog, freePort } from "./launcher-core.mjs";
import { createServer } from "node:net";

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "worklog-launcher-"));
  roots.push(root);
  const put = (path: string, value: string) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), value); };
  const packages = Object.fromEntries(["tsx", "vite", "typescript"].map((name) => [`node_modules/${name}`, { version: "1.0.0" }]));
  const dependencies = { tsx: "1.0.0", vite: "1.0.0", typescript: "1.0.0" };
  put("package.json", JSON.stringify({ name: "worklog-for-redmine", version: "0.7.0", dependencies }));
  put("package-lock.json", JSON.stringify({ packages: { "": { dependencies }, ...packages } }));
  for (const file of ["vite.config.ts", "tsconfig.json", "index.html", "src/entry.ts"]) put(file, "fictional source");
  const install = () => {
    for (const name of ["tsx", "vite", "typescript"]) put(`node_modules/${name}/package.json`, JSON.stringify({ version: "1.0.0" }));
    for (const path of ["tsx/dist/cli.mjs", "typescript/bin/tsc", "vite/dist/node/index.js"]) put(`node_modules/${path}`, "synthetic package");
  };
  install();
  let started = false;
  const child = { pid: 1234567, exitCode: null as number | null, terminate: vi.fn(async () => { child.exitCode = 1; }) };
  const runNpm = vi.fn(async (args: string[]) => {
    if (args[0] === "ci") install();
    if (args[0] === "run") put("dist/index.html", "synthetic local build");
    if (args[0] === "start") { started = true; child.exitCode = null; return child; }
  });
  const report = vi.fn();
  const options = { runNpm, report, choosePort: async () => 43123,
    health: async () => started ? { version: "0.7.0" } : null,
    fetcher: vi.fn(async () => { child.exitCode = 0; return new Response("", { status: 202 }); }),
  };
  return { root, put, child, options, runNpm, install, reset: () => { started = false; runNpm.mockClear(); } };
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("Windows launcher preparation and ownership", () => {
  it("checks Node and PORT before starting", () => {
    expect(() => assertNodeVersion("v24.20.0")).not.toThrow();
    for (const version of ["v22.0.0", "v24.19.9", "v25.0.0"]) expect(() => assertNodeVersion(version)).toThrow("24.20");
    expect(configuredPort(undefined)).toBe(3000);
    expect(configuredPort("43210")).toBe(43210);
    for (const value of ["", "abc", "0", "65536"]) expect(() => configuredPort(value)).toThrow("PORT");
  });
  it("detects incomplete dependencies and changed lock versions", () => {
    const t = fixture();
    expect(dependenciesReady(t.root)).toBe(true);
    rmSync(join(t.root, "node_modules/tsx/dist/cli.mjs"));
    expect(dependenciesReady(t.root)).toBe(false);
    t.install();
    t.put("node_modules/tsx/package.json", JSON.stringify({ version: "0.0.1" }));
    expect(dependenciesReady(t.root)).toBe(false);
  });
  it("installs only when needed, builds, waits for identity and preserves private data", async () => {
    const t = fixture();
    rmSync(join(t.root, "node_modules/tsx/dist/cli.mjs"));
    t.put("data/worklog.sqlite", "fictional database marker");
    t.put(".env", "REDMINE_API_KEY=synthetic-key");
    const session = await launchWorklog(t.root, t.options);
    expect(t.runNpm.mock.calls.map(([args]) => args.join(" "))).toEqual(["ci --no-audit --no-fund", "run build", "start"]);
    expect(session.url).toBe("http://127.0.0.1:43123");
    expect(session.reused).toBe(false);
    expect(readFileSync(join(t.root, "data/worklog.sqlite"), "utf8")).toBe("fictional database marker");
    expect(readFileSync(join(t.root, ".env"), "utf8")).toBe("REDMINE_API_KEY=synthetic-key");
    await session.stop();
    expect(existsSync(join(t.root, "local/launcher.lock"))).toBe(false);
    expect(t.child.terminate).not.toHaveBeenCalled();
  });
  it("reuses a matching existing service without install, build or ownership", async () => {
    const t = fixture();
    const session = await launchWorklog(t.root, { ...t.options, port: "45000", health: async () => ({ version: "0.6.1" }) });
    expect(session).toMatchObject({ reused: true, url: "http://127.0.0.1:45000" });
    await session.stop();
    expect(t.runNpm).not.toHaveBeenCalled();
    expect(t.child.terminate).not.toHaveBeenCalled();
    expect(t.options.fetcher).not.toHaveBeenCalled();
  });
  it("skips an unchanged build but rebuilds after source or artifact changes", async () => {
    const t = fixture();
    await (await launchWorklog(t.root, t.options)).stop();
    t.reset();
    await (await launchWorklog(t.root, t.options)).stop();
    expect(t.runNpm.mock.calls.map(([args]) => args)).toEqual([["start"]]);
    t.reset(); t.put("src/entry.ts", "changed source");
    await (await launchWorklog(t.root, t.options)).stop();
    expect(t.runNpm.mock.calls.map(([args]) => args)).toEqual([["run", "build"], ["start"]]);
    t.reset(); t.put("dist/index.html", "damaged artifact");
    await (await launchWorklog(t.root, t.options)).stop();
    expect(t.runNpm.mock.calls[0][0]).toEqual(["run", "build"]);
  });
  it("keeps .env and test changes out of the build fingerprint", () => {
    const t = fixture(), before = sourceFingerprint(t.root);
    t.put(".env", "PORT=43123"); t.put("src/example.test.ts", "changed test");
    expect(sourceFingerprint(t.root)).toBe(before);
  });
  it("rejects foreign/non-JSON/redirected health responses", async () => {
    const t = fixture(), id = applicationIdentity(t.root);
    const fetcher = vi.fn(async () => Response.json({ application: "worklog-for-redmine", instanceId: "another-project" }));
    expect(await readHealth(3000, id, fetcher)).toBeNull();
    fetcher.mockResolvedValueOnce(new Response("other application"));
    expect(await readHealth(3000, id, fetcher)).toBeNull();
    fetcher.mockResolvedValueOnce(Response.json({ application: "worklog-for-redmine", instanceId: id, version: "0.7.0" }));
    expect(await readHealth(3000, id, fetcher)).toMatchObject({ version: "0.7.0" });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "error" });
  });
  it("prevents concurrent preparation of the same folder", async () => {
    const t = fixture(), session = await launchWorklog(t.root, t.options);
    await expect(launchWorklog(t.root, { ...t.options, health: async () => null })).rejects.toThrow("Outro lançador");
    await session.stop();
  });
  it("releases a stale lock left by a process that no longer exists", async () => {
    const t = fixture(); t.put("local/launcher.lock", JSON.stringify({ pid: 2147483647 }));
    await (await launchWorklog(t.root, t.options)).stop();
    expect(existsSync(join(t.root, "local/launcher.lock"))).toBe(false);
  });
  it("releases preparation after install failure and does not start the server", async () => {
    const t = fixture(); rmSync(join(t.root, "node_modules/tsx/dist/cli.mjs"));
    const failing = vi.fn(async () => { throw new Error("synthetic offline failure"); });
    await expect(launchWorklog(t.root, { ...t.options, runNpm: failing })).rejects.toThrow("offline");
    expect(existsSync(join(t.root, "local/launcher.lock"))).toBe(false);
    expect(t.runNpm).not.toHaveBeenCalled();
  });
  it("times out readiness and terminates only the child it created", async () => {
    const t = fixture(); let time = 0;
    await expect(launchWorklog(t.root, { ...t.options, timeout: 10, now: () => time,
      sleep: async () => { time += 10; }, health: async () => null })).rejects.toThrow("prazo");
    expect(t.child.terminate).toHaveBeenCalledOnce();
    expect(existsSync(join(t.root, "local/launcher.lock"))).toBe(false);
  });
  it("keeps a busy service alive and permits a later graceful stop", async () => {
    const t = fixture();
    t.options.fetcher.mockImplementationOnce(async () => new Response("busy", { status: 409 }));
    const session = await launchWorklog(t.root, t.options);
    await expect(session.stop()).rejects.toThrow("andamento");
    expect(existsSync(join(t.root, "local/launcher.lock"))).toBe(true);
    expect(t.child.terminate).not.toHaveBeenCalled();
    await session.stop();
    expect(t.options.fetcher.mock.calls[1][1].headers.authorization).toMatch(/^Bearer [0-9a-f]{64}$/);
  });
  it("chooses a free port without stopping the program on the preferred port", async () => {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const occupied = (server.address() as { port: number }).port;
      expect(await freePort(occupied)).not.toBe(occupied);
      expect(server.listening).toBe(true);
    } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  });
});
