import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function files(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(folder, entry.name)) : [join(folder, entry.name)]);
}
export function checkDemoBuild(folder, base = "/") {
  if (!base.startsWith("/") || !base.endsWith("/") || base.includes(".."))
    throw new Error("Expected an absolute base path ending with a slash.");
  const root = resolve(folder);
  const artifact = files(root);
  const html = readFileSync(join(root, "index.html"), "utf8");
  if (!html.includes("Content-Security-Policy") || !html.includes("connect-src &#39;none&#39;"))
    throw new Error("The demo must block operational network connections.");
  for (const file of artifact) {
    if (!/\.(?:html|js|css|svg)$/.test(file)) throw new Error(`Unexpected demo file: ${relative(root, file)}`);
    const source = readFileSync(file, "utf8");
    // The brand is a passive vector asset, with no scripts, embedded content or external references.
    if (file.endsWith(".svg") && (!/^<svg\b/.test(source) ||
      /<(?!\/?(?:svg|rect|path)\b)|\b(?:href|src|style|on\w+)\s*=|url\s*\(/i.test(source)))
      throw new Error(`Unexpected active SVG content: ${relative(root, file)}`);
    if (/\/api\/|node:sqlite|http-data-access|REDMINE_API_KEY=|REDMINE_URL=|BEGIN (?:RSA |EC )?PRIVATE KEY/.test(source))
      throw new Error(`Forbidden local reference in demo artifact: ${relative(root, file)}`);
  }
  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  if (!references.length) throw new Error("The demo HTML contains no asset references.");
  for (const reference of references) {
    if (!reference.startsWith(base) || reference.includes("..") ||
      !existsSync(join(root, reference.slice(base.length))))
      throw new Error(`Missing demo asset or incorrect base path: ${reference}`);
  }
  return artifact.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const count = checkDemoBuild("dist-demo", process.argv[2] ?? "/");
  console.log(`Demo artifact verified: ${count} static files; correct asset paths and no local API or backend transport.`);
}
