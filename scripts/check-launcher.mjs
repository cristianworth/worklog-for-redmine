import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, execFile } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdtempSync, cpSync, writeFileSync, existsSync, rmSync, realpathSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { applicationIdentity } from "../src/server/runtime-info.mjs";

// This smoke test deliberately uses a new folder, blank config and its own SQLite.
const project = fileURLToPath(new URL("../", import.meta.url));
const root = mkdtempSync(join(tmpdir(), "worklog launcher check-"));
const workers = [];
let success = false;
const foreign = createServer((_req, res) => { res.setHeader("content-type", "application/json"); res.end('{"application":"another-app"}'); });
await new Promise((resolve) => foreign.listen(0, "127.0.0.1", resolve));
const preferred = foreign.address().port;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:REDMINE_|WORKLOG_LAUNCHER_|PORT$)/i.test(key)));

async function openWorker() {
  const child = spawn(process.execPath, [join(root, "scripts/launch-worklog.mjs")], {
    cwd: root, env: { ...env, PORT: String(preferred), NPM_CONFIG_USERCONFIG: join(root, ".npmrc") },
    windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
  });
  workers.push(child);
  const events = [];
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => { try { events.push(JSON.parse(line)); } catch {} });
  let stderr = ""; child.stderr.on("data", (value) => { stderr += value; });
  const until = async (type, timeout = 180000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const failure = events.find((event) => event.type === "error");
      if (failure) throw new Error(`${failure.message}\n${readFileSync(join(root, "local/launcher.log"), "utf8").slice(-4000)}`);
      const event = events.find((event) => event.type === type);
      if (event) return event;
      if (child.exitCode !== null) throw new Error(`Worker exited (${child.exitCode}): ${stderr}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for ${type}`);
  };
  child.stdin.write("go\n");
  const ready = await until("ready");
  return { child, events, ready, stop: async () => {
    child.stdin.write("stop\n"); await until("stopped", 15000);
    if (child.exitCode === null) await new Promise((resolve) => child.once("exit", resolve));
  } };
}

try {
  for (const path of ["src", "scripts", "package.json", "package-lock.json", "index.html", "vite.config.ts", "tsconfig.json"])
    cpSync(join(project, path), join(root, path), { recursive: true });
  writeFileSync(join(root, ".npmrc"), "registry=https://registry.npmjs.org\n");
  if (process.platform === "win32") {
    assert.ok(existsSync(join(project, "Worklog.exe")), "Compile Worklog.exe first");
    cpSync(join(project, "Worklog.exe"), join(root, "Worklog.exe"));
    const check = spawn(join(root, "Worklog.exe"), ["--check"], { windowsHide: true });
    assert.equal(await new Promise((resolve) => check.once("exit", resolve)), 0, "Native bootstrap check");
  }
  const first = await openWorker();
  assert.equal(first.ready.managed, true);
  assert.notEqual(first.ready.url, `http://127.0.0.1:${preferred}`, "Do not reuse another program's port");
  assert.ok(first.events.some((event) => event.message?.includes("npm ci")), "Cold startup installs dependencies");
  assert.ok(first.events.some((event) => event.message?.includes("npm run build")), "Cold startup builds");
  const health = await (await fetch(`${first.ready.url}/api/health`)).json();
  assert.equal(health.instanceId, applicationIdentity(root));
  const days = [{ date: "2026-10-26", revision: 0, entries: [{ id: "launcher-fictional-row", issue: "9001", minutes: 10, activity: "Fictional review", comment: "Launcher smoke test — fictional" }] }];
  assert.equal((await fetch(`${first.ready.url}/api/days`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ days }) })).status, 200);
  const second = await openWorker();
  assert.equal(second.ready.managed, false); assert.equal(second.ready.url, first.ready.url);
  await second.stop();
  assert.equal((await fetch(`${first.ready.url}/api/health`)).status, 200, "Closing a reused launcher preserves the original service");
  await first.stop();
  const reopened = await openWorker();
  assert.ok(!reopened.events.some((event) => /npm ci|npm run build/.test(event.message ?? "")), "Warm startup skips unchanged preparation");
  const restored = await (await fetch(`${reopened.ready.url}/api/days?from=2026-10-26&to=2026-10-26`)).json();
  assert.equal(restored.days[0].entries[0].comment, days[0].entries[0].comment, "SQLite persists across starts");
  await reopened.stop();
  assert.equal(foreign.listening, true, "Never stop the program occupying the configured port");
  success = true;
  console.log("Launcher smoke passed: native bootstrap, cold install/build, occupied port, identity, reuse, graceful stop, warm restart and fictional SQLite persistence.");
} finally {
  for (const child of workers) {
    if (child.exitCode !== null) continue;
    child.stdin.end("stop\n");
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 5000))]);
    if (child.exitCode === null) {
      if (process.platform === "win32") await new Promise((resolve) => execFile("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, () => resolve()));
      else child.kill("SIGTERM");
    }
  }
  await new Promise((resolve) => foreign.close(resolve));
  if (success && dirname(realpathSync(root)) === realpathSync(tmpdir()) && basename(root).startsWith("worklog launcher check-"))
    rmSync(root, { recursive: true, force: true });
  else console.error(`Fictional test files preserved for diagnostics: ${root}`);
}
