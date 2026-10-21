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
if (process.argv.includes("--dev")) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(join(root, "dist")));
  app.get("/", (_req, res) => res.sendFile(join(root, "dist", "index.html")));
}
app.use(handleErrors);
const server = app.listen(3000, "127.0.0.1", () => {
  console.log("Worklog for Redmine: http://127.0.0.1:3000");
});
function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
