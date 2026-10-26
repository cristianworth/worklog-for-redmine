import { spawn, execFile } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, statSync, renameSync, rmSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { launchWorklog, findNpmCli } from "./launcher-core.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const controller = new AbortController();
const emit = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
let session, stopping = false;
const logPath = join(root, "local/launcher.log");
const log = (message) => { if (!existsSync(logPath) || statSync(logPath).size < 2 * 1024 * 1024) appendFileSync(logPath, message); };

async function terminateTree(child) {
  if (child.exitCode !== null) return;
  if (process.platform === "win32") {
    await new Promise((resolve) => execFile("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, () => resolve()));
  } else child.kill("SIGTERM");
}

async function stop() {
  if (stopping) return;
  stopping = true;
  if (!session) { controller.abort(); return; }
  try {
    await session.stop();
    emit({ type: "stopped", message: session.reused ? "O serviço existente foi preservado." : "Serviço encerrado com segurança." });
    process.exit(0);
  } catch (error) {
    stopping = false;
    emit({ type: "stop-refused", message: error.message });
  }
}

const input = createInterface({ input: process.stdin });
input.on("line", (line) => {
  if (line === "stop") void stop();
  if (line === "go") void start();
});
input.on("close", () => { void stop(); });

let started = false;
async function start() {
  if (started) return;
  started = true;
  try {
    mkdirSync(join(root, "local"), { recursive: true });
    if (existsSync(logPath) && statSync(logPath).size > 1024 * 1024) {
      const previous = `${logPath}.previous`;
      rmSync(previous, { force: true }); renameSync(logPath, previous);
    }
    log(`\n[${new Date().toISOString()}] Preparando Worklog\n`);
    const envPath = join(root, ".env");
    // Only the backend needs Redmine credentials; install/build hooks do not receive .env.
    const port = process.env.PORT ?? (existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")).PORT : undefined);
    const npm = findNpmCli();
    const runNpm = (args, options) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [npm, ...args], {
        cwd: root, env: { ...process.env, ...options.env }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout.on("data", (value) => log(value));
      child.stderr.on("data", (value) => log(value));
      child.terminate = () => terminateTree(child);
      let timedOut = false;
      const timer = options.background ? null : setTimeout(() => {
        timedOut = true; void terminateTree(child);
      }, args[0] === "ci" ? 600000 : 180000);
      const abort = () => { void terminateTree(child); };
      options.signal?.addEventListener("abort", abort, { once: true });
      if (options.signal?.aborted) abort();
      child.once("error", (error) => { clearTimeout(timer); reject(error); });
      child.once("exit", (code) => {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
        if (!options.background) code === 0 ? resolve() : reject(new Error(
          options.signal?.aborted ? "Inicialização cancelada." : timedOut ? "A preparação excedeu o tempo esperado. Confira sua conexão e local/launcher.log antes de tentar novamente." : `npm ${args.join(" ")} falhou. Feche outros terminais deste projeto se houver arquivo em uso e confira local/launcher.log.`,
        ));
        else if (session && !stopping) {
          emit({ type: "error", message: "O serviço encerrou inesperadamente. Confira local/launcher.log antes de tentar novamente." });
          process.exit(1);
        }
      });
      if (options.background) resolve(child);
    });
    session = await launchWorklog(root, { port, signal: controller.signal, runNpm,
      report: (message) => emit({ type: "status", message }) });
    emit({ type: "ready", url: session.url, managed: !session.reused,
      message: session.reused ? "Serviço existente reutilizado. Ele não será encerrado por este lançador." : "Worklog pronto. Você pode minimizar esta janela; ela mantém o serviço aberto." });
    if (stopping) { stopping = false; await stop(); }
  } catch (error) {
    emit({ type: "error", message: error.message });
    process.exit(1);
  }
}
