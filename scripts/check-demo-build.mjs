import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve("dist-demo");
function files(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(folder, entry.name)) : [join(folder, entry.name)]);
}
const artifact = files(root);
const html = readFileSync(join(root, "index.html"), "utf8");
if (!html.includes("Content-Security-Policy") || !html.includes("connect-src &#39;none&#39;"))
  throw new Error("The demo must block operational network connections.");
for (const file of artifact) {
  if (!/\.(?:html|js|css)$/.test(file)) throw new Error(`Unexpected demo file: ${relative(root, file)}`);
  const source = readFileSync(file, "utf8");
  if (/\/api\/|node:sqlite|http-data-access|REDMINE_API_KEY=|REDMINE_URL=|BEGIN (?:RSA |EC )?PRIVATE KEY/.test(source))
    throw new Error(`Forbidden local reference in demo artifact: ${relative(root, file)}`);
}
console.log(`Demo artifact verified: ${artifact.length} static files; no local API or backend transport.`);
