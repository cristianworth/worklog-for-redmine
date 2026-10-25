import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
});
