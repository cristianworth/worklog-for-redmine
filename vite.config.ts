import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

const demoIsolation: Plugin = {
  name: "verify-demo-isolation",
  apply: "build",
  transformIndexHtml() {
    return [{
        tag: "meta",
        attrs: {
          "http-equiv": "Content-Security-Policy",
          content: "connect-src 'none'; form-action 'none'",
        },
        injectTo: "head-prepend",
    }];
  },
  generateBundle(_options, bundle) {
    for (const output of Object.values(bundle)) {
      if (output.type !== "chunk") continue;
      for (const id of Object.keys(output.modules)) {
        const path = id.replaceAll("\\", "/");
        if (/\/(?:src\/server|private|data)\//.test(path) ||
          path.endsWith("/http-data-access.ts"))
          this.error("O build da demo contém uma dependência local não permitida.");
      }
      if (output.code.includes("/api/"))
        this.error("O build da demo contém um caminho para a API local.");
    }
  },
};

export default defineConfig(({ mode }) => ({
  envDir: mode === "demo" ? false : undefined,
  envPrefix: mode === "demo" ? [] : "VITE_",
  build: { outDir: mode === "demo" ? "dist-demo" : "dist" },
  plugins: [react(), ...(mode === "demo" ? [demoIsolation] : [])],
  define: { "import.meta.env.VITE_APP_VERSION": JSON.stringify(version) },
}));
