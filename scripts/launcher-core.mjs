import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, openSync, closeSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { createServer } from "node:net";
import { applicationIdentity } from "../src/server/runtime-info.mjs";

export function assertNodeVersion(version) {
  const [major, minor] = version.replace(/^v/, "").split(".").map(Number);
  if (major !== 24 || minor < 20)
    throw new Error("Instale o Node.js 24.20 ou mais recente da linha 24.x, com npm, em nodejs.org.");
}

export function configuredPort(value) {
  const port = value === undefined ? 3000 : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT deve ser uma porta válida entre 1 e 65535. Confira o ambiente e o arquivo .env.");
  return port;
}

function readJson(path) { return JSON.parse(readFileSync(path, "utf8")); }
function readOptional(path) { try { return readJson(path); } catch { return null; } }
const digest = (values) => createHash("sha256").update(values.join("\0")).digest("hex");

export function dependenciesReady(root, platform = process.platform, arch = process.arch) {
  try {
    const manifest = readJson(join(root, "package.json"));
    const lock = readJson(join(root, "package-lock.json"));
    const sortedEntries = (value) => JSON.stringify(Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b)));
    for (const kind of ["dependencies", "devDependencies"])
      if (sortedEntries(manifest[kind]) !== sortedEntries(lock.packages[""][kind])) return false;
    for (const [path, info] of Object.entries(lock.packages)) {
      if (!path) continue;
      const supports = (values, current) => !values || ((!values.some((value) => !value.startsWith("!")) || values.includes(current)) && !values.includes(`!${current}`));
      if (!supports(info.os, platform) || !supports(info.cpu, arch)) continue;
      if (readOptional(join(root, path, "package.json"))?.version !== info.version) return false;
    }
    return ["tsx/dist/cli.mjs", "typescript/bin/tsc", "vite/dist/node/index.js"]
      .every((file) => existsSync(join(root, "node_modules", file)));
  } catch { return false; }
}

function treeFiles(root, folder, include) {
  const base = join(root, folder);
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true }).flatMap((entry) => {
    const path = `${folder}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error("O build local não aceita links simbólicos nas fontes ou na saída.");
    return entry.isDirectory() ? treeFiles(root, path, include) : include(path) ? [path] : [];
  }).sort();
}

export function sourceFingerprint(root) {
  const files = ["package.json", "package-lock.json", "vite.config.ts", "tsconfig.json", "index.html",
    ...treeFiles(root, "src", (file) => !file.includes(".test.") && /\.(?:ts|tsx|css|mjs|mts)$/.test(file))];
  return digest(files.flatMap((file) => [file, readFileSync(join(root, file), "utf8")]));
}

export function artifactFingerprint(root) {
  if (!existsSync(join(root, "dist/index.html"))) return null;
  const files = treeFiles(root, "dist", () => true);
  return digest(files.flatMap((file) => [file, createHash("sha256").update(readFileSync(join(root, file))).digest("hex")]));
}

export async function readHealth(port, instanceId, fetcher = fetch) {
  try {
    const response = await fetcher(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(1200), redirect: "error", cache: "no-store",
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return null;
    const value = await response.json();
    return value.application === "worklog-for-redmine" && value.instanceId === instanceId ? value : null;
  } catch { return null; }
}

export function freePort(preferred) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      if (preferred && (error.code === "EADDRINUSE" || error.code === "EACCES")) freePort(0).then(resolve, reject);
      else reject(error);
    });
    server.listen(preferred, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function acquireLock(root) {
  const path = join(root, "local/launcher.lock");
  const value = JSON.stringify({ pid: process.pid, nonce: randomBytes(16).toString("hex") });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(path, "wx");
      try { writeFileSync(fd, value); } finally { closeSync(fd); }
      return () => { if (existsSync(path) && readFileSync(path, "utf8") === value) unlinkSync(path); };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const previous = readOptional(path);
      if (!Number.isInteger(previous?.pid) || previous.pid < 1)
        throw new Error("O bloqueio local está inválido. Feche os lançadores e remova somente local/launcher.lock antes de tentar novamente.");
      let alive = true;
      try { process.kill(previous.pid, 0); } catch (probe) { if (probe.code === "ESRCH") alive = false; }
      if (alive) throw new Error("Outro lançador desta pasta está preparando o Worklog. Aguarde sua janela.");
      unlinkSync(path);
    }
  }
  throw new Error("Não foi possível obter o bloqueio local. Tente novamente.");
}

export function findNpmCli() {
  const candidates = [
    join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
    process.env.APPDATA && join(process.env.APPDATA, "npm/node_modules/npm/bin/npm-cli.js"),
    process.env.npm_execpath,
  ].filter(Boolean);
  const cli = candidates.find((path) => path.endsWith("npm-cli.js") && existsSync(path));
  if (!cli) throw new Error("npm não foi encontrado. Reinstale o Node.js 24.x incluindo o npm.");
  return cli;
}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// IO dependencies are injectable so startup failures never need the usage database in tests.
export async function launchWorklog(root, options) {
  const { runNpm, report = () => {}, signal, health = readHealth, choosePort = freePort,
    sleep = pause, timeout = 45000, now = Date.now } = options;
  assertNodeVersion(process.version);
  if (readJson(join(root, "package.json")).name !== "worklog-for-redmine")
    throw new Error("Coloque Worklog.exe na pasta do projeto, junto de package.json.");
  const instanceId = applicationIdentity(root), preferred = configuredPort(options.port);
  const local = join(root, "local");
  const runtimePath = join(local, "launcher-runtime.json");
  const stored = readOptional(runtimePath);
  const candidates = [...new Set([preferred, ...(stored?.instanceId === instanceId ? [stored.port] : [])])];
  for (const port of candidates) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) continue;
    const existing = await health(port, instanceId);
    if (existing) {
      report("O Worklog desta pasta já está rodando. Reutilizando o serviço existente.");
      return { url: `http://127.0.0.1:${port}`, reused: true, version: existing.version, stop: async () => {} };
    }
  }
  signal?.throwIfAborted();
  mkdirSync(local, { recursive: true });
  const release = acquireLock(root);
  let child;
  const removeRuntime = () => {
    if (child && readOptional(runtimePath)?.pid === child.pid) unlinkSync(runtimePath);
  };
  try {
    if (!dependenciesReady(root)) {
      report("Preparando dependências com npm ci. A primeira execução pode precisar de Internet…");
      await runNpm(["ci", "--no-audit", "--no-fund"], { signal });
      if (!dependenciesReady(root)) throw new Error("A instalação ficou incompleta. Confira local/launcher.log e tente novamente.");
    }
    signal?.throwIfAborted();
    const fingerprint = sourceFingerprint(root), statePath = join(local, "launcher-state.json");
    const state = readOptional(statePath), artifact = artifactFingerprint(root);
    if (!artifact || state?.source !== fingerprint || state?.artifact !== artifact) {
      report("Compilando a interface local com npm run build…");
      await runNpm(["run", "build"], { signal });
      const built = artifactFingerprint(root);
      if (!built) throw new Error("A compilação não gerou dist/index.html.");
      writeFileSync(statePath, JSON.stringify({ source: fingerprint, artifact: built }));
    }
    signal?.throwIfAborted();
    const port = await choosePort(preferred), token = randomBytes(32).toString("hex");
    report(port === preferred ? `Iniciando npm start na porta ${port}…` : `Porta ${preferred} ocupada. Iniciando npm start na porta ${port}…`);
    child = await runNpm(["start"], { background: true, signal, env: { PORT: String(port), WORKLOG_LAUNCHER_TOKEN: token } });
    const url = `http://127.0.0.1:${port}`;
    const deadline = now() + timeout;
    let ready = false;
    while (now() < deadline) {
      signal?.throwIfAborted();
      if (child.exitCode !== null) throw new Error("npm start encerrou antes de o serviço ficar pronto. Confira local/launcher.log.");
      if (await health(port, instanceId)) { ready = true; break; }
      await sleep(250);
    }
    if (!ready) throw new Error("O serviço não respondeu no prazo esperado. Confira local/launcher.log e tente novamente.");
    writeFileSync(runtimePath, JSON.stringify({ instanceId, port, pid: child.pid }));
    let stopped = false;
    return { url, reused: false, child, async stop() {
      if (stopped) return;
      if (child.exitCode === null) {
        const response = await (options.fetcher ?? fetch)(`${url}/api/launcher/shutdown`, {
          method: "POST", headers: { authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(5000),
        });
        if (response.status === 409) throw new Error("Há uma gravação ou envio em andamento. Aguarde e tente encerrar novamente.");
        if (response.status !== 202) throw new Error("Não foi possível encerrar com segurança. O serviço foi mantido aberto.");
        const deadline = now() + 10000;
        while (child.exitCode === null && now() < deadline) await sleep(100);
        if (child.exitCode === null) throw new Error("O serviço ainda está encerrando. Aguarde e tente novamente.");
      }
      stopped = true;
      removeRuntime(); release();
    } };
  } catch (error) {
    if (child?.exitCode === null) await child.terminate();
    removeRuntime(); release();
    throw error;
  }
}
