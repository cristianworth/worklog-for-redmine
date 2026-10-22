import { createServer as createHttpServer } from "node:http";
import type { ViteDevServer } from "vite";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import express from "express";
import { createApp, handleErrors } from "./app";
import { openDraftStore } from "./storage";

const root = fileURLToPath(new URL("../../", import.meta.url));
mkdirSync(join(root, "data"), { recursive: true });
const store = openDraftStore(join(root, "data", "worklog.sqlite"));
const app = createApp(store);
const server = createHttpServer(app);
let vite: ViteDevServer | undefined;
if (process.argv.includes("--dev")) {
  const { createServer } = await import("vite");
  vite = await createServer({
    server: { middlewareMode: true, ws: { server } },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(join(root, "dist")));
  app.get("/", (_req, res) => res.sendFile(join(root, "dist", "index.html")));
}
app.use(handleErrors);
server.listen(3000, "127.0.0.1", () => {
  console.log("Worklog for Redmine: http://127.0.0.1:3000");
});
async function shutdown() {
  await vite?.close();
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
