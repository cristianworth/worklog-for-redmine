import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("client data boundary", () => {
  it("keeps operational HTTP and API paths inside the HTTP adapter", () => {
    const root = fileURLToPath(new URL("./", import.meta.url));
    const files = readdirSync(root).filter((file) => /\.tsx?$/.test(file) && !file.includes(".test.") && file !== "http-data-access.ts");
    for (const file of files) {
      const source = readFileSync(root + file, "utf8");
      expect(source, file).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|\/api\//);
      expect(source, file).not.toMatch(/from\s+["'][^"']*(?:server\/|node:)/);
    }
  });
});
