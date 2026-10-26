import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

if (process.platform !== "win32") throw new Error("O lançador .exe deve ser compilado no Windows.");
const root = fileURLToPath(new URL("../", import.meta.url));
const framework = join(process.env.SystemRoot ?? "C:\\Windows", "Microsoft.NET");
const compiler = ["Framework64", "Framework"].map((folder) => join(framework, folder, "v4.0.30319/csc.exe")).find(existsSync);
if (!compiler) throw new Error(".NET Framework 4.x não encontrado. Habilite-o no Windows para compilar o lançador.");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Versão inválida para o lançador.");
const generated = join(root, "local/launcher-build");
mkdirSync(generated, { recursive: true });
const info = join(generated, "Version.cs");
writeFileSync(info, `using System.Reflection; [assembly:AssemblyTitle("Worklog for Redmine")] [assembly:AssemblyVersion("${version}.0")] [assembly:AssemblyFileVersion("${version}.0")]`);
const output = join(root, "Worklog.exe");
const result = spawnSync(compiler, ["/nologo", "/target:winexe", "/platform:anycpu", "/optimize+", "/codepage:65001", "/utf8output",
  `/out:${output}`, `/win32manifest:${join(root, "launcher/app.manifest")}`,
  "/reference:System.Windows.Forms.dll", "/reference:System.Drawing.dll", "/reference:System.Web.Extensions.dll",
  join(root, "launcher/WorklogLauncher.cs"), info], { cwd: root, windowsHide: true, encoding: "utf8" });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`${result.stdout}${result.stderr}\nFeche o lançador anterior antes de substituir Worklog.exe.`);
console.log(`Lançador ${version} gerado: ${output}`);
