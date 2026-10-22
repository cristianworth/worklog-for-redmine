import { createServer as createHttpServer } from "node:http";
import type { ViteDevServer } from "vite";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import express from "express";
import { createApp, handleErrors } from "./app";
import { openDraftStore } from "./storage";

import {
  createRedmineClient,
  readRedmineConfig,
  RedmineError,
} from "./redmine";

const root = fileURLToPath(new URL("../../", import.meta.url));
const envPath = join(root, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
let redmine;
try {
  redmine = createRedmineClient(readRedmineConfig(process.env));
} catch (error) {
  if (!(error instanceof RedmineError)) throw error;
  console.error(error.message);
  // Invalid connection settings must not prevent access to local drafts.
  const configurationError = error;
  redmine = {
    status: () => ({
      configured: false,
      hasApiKey: false,
      certificateException: false,
    }),
    check: async () => {
      throw configurationError;
    },
    issue: async (_id: string): Promise<never> => {
      throw configurationError;
    },
  };
}
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT deve ser uma porta válida.");
mkdirSync(join(root, "data"), { recursive: true });
const store = openDraftStore(join(root, "data", "worklog.sqlite"));
const app = createApp(store, redmine);
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
server.listen(port, "127.0.0.1", () => {
  console.log(`Worklog for Redmine: http://127.0.0.1:${port}`);
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
