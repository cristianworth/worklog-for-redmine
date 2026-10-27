import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkDemoBuild } from "./check-demo-build.mjs";

const folders: string[] = [];
function fixture(base = "/", code = "export default 'fictional demo';") {
  const root = mkdtempSync(join(tmpdir(), "worklog-demo-audit-"));
  folders.push(root);
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "index.html"), `<meta http-equiv="Content-Security-Policy" content="connect-src &#39;none&#39;; form-action &#39;none&#39;"><script src="${base}assets/demo.js"></script>`);
  writeFileSync(join(root, "assets/demo.js"), code);
  return root;
}
afterEach(() => { for (const root of folders.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("static demo delivery audit", () => {
  it("accepts root previews and the Pages subdirectory", () => {
    expect(checkDemoBuild(fixture())).toBe(2);
    expect(checkDemoBuild(fixture("/worklog-for-redmine/"), "/worklog-for-redmine/")).toBe(2);
  });
  it("rejects assets pointing at the domain root instead of the repository", () => {
    expect(() => checkDemoBuild(fixture(), "/worklog-for-redmine/")).toThrow("incorrect base path");
  });
  it("rejects missing files even when their URL has the correct prefix", () => {
    const root = fixture();
    rmSync(join(root, "assets/demo.js"));
    expect(() => checkDemoBuild(root)).toThrow("Missing demo asset");
  });
  it("rejects operational API paths and private files", () => {
    expect(() => checkDemoBuild(fixture("/", "fetch('/api/days')"))).toThrow("Forbidden local reference");
    const root = fixture();
    writeFileSync(join(root, "worklog.sqlite"), "synthetic private data");
    expect(() => checkDemoBuild(root)).toThrow("Unexpected demo file");
  });
  it("includes the passive brand and favicon under both deployment paths", () => {
    const mark = readFileSync(new URL("../src/client/assets/worklog-mark.svg", import.meta.url), "utf8");
    for (const base of ["/", "/worklog-for-redmine/"]) {
      const root = fixture(base);
      writeFileSync(join(root, "assets/mark.svg"), mark);
      const html = readFileSync(join(root, "index.html"), "utf8");
      writeFileSync(join(root, "index.html"), `${html}<link rel="icon" href="${base}assets/mark.svg">`);
      expect(checkDemoBuild(root, base)).toBe(3);
      rmSync(join(root, "assets/mark.svg"));
      expect(() => checkDemoBuild(root, base)).toThrow("Missing demo asset");
    }
  });
  it("rejects SVG scripts, events and external resources", () => {
    for (const content of [
      '<svg><script>alert(1)</script></svg>',
      '<svg onload="alert(1)"><path/></svg>',
      '<svg><image href="https://example.invalid/test.png"/></svg>',
      '<svg><path style="fill: url(https://example.invalid/test.svg)"/></svg>',
    ]) {
      const root = fixture();
      writeFileSync(join(root, "assets/mark.svg"), content);
      expect(() => checkDemoBuild(root)).toThrow("Unexpected active SVG content");
    }
  });
});
