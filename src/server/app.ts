import { validateActivityCatalog } from "../shared/activities";
import express from "express";
import {
  isWorkDate,
  validateDay,
  validateDays,
  validatePeriod,
} from "../shared/worklogs";
import { ConflictError, type openDraftStore } from "./storage";

import {
  createRedmineClient,
  RedmineError,
  type RedmineClient,
} from "./redmine";

export function createApp(
  store: ReturnType<typeof openDraftStore>,
  redmine: RedmineClient = createRedmineClient(null),
) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const hostname = req.hostname;
    if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
      res
        .status(403)
        .json({ error: "Acesso permitido somente por endereço local." });
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      const origin = req.get("origin");
      if (origin && origin !== `http://${req.get("host")}`) {
        res.status(403).json({ error: "Origem não permitida." });
        return;
      }
    }
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/redmine", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/redmine/status", (_req, res) => res.json(redmine.status()));
  app.post("/api/redmine/check", async (_req, res) => {
    res.json(await redmine.check());
  });
  app.get("/api/redmine/issues/:id", async (req, res) => {
    res.json(await redmine.issue(req.params.id));
  });
  app.get("/api/activities", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(store.readActivities());
  });
  app.put("/api/activities", (req, res) => {
    let catalog;
    try {
      catalog = validateActivityCatalog(req.body);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Catálogo inválido.",
      });
      return;
    }
    try {
      res.json(store.saveActivities(catalog));
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      res.status(409).json({ error: error.message });
    }
  });
  app.get("/api/days", (req, res) => {
    let period;
    try {
      period = validatePeriod(req.query.from, req.query.to);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Período inválido.",
      });
      return;
    }
    res.json({ days: store.readRange(period.from, period.to) });
  });
  app.put("/api/days", (req, res) => {
    let days;
    try {
      days = validateDays(req.body?.days);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Rascunhos inválidos.",
      });
      return;
    }
    try {
      res.json({ days: store.saveMany(days) });
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      res.status(409).json({ error: error.message });
    }
  });
  app.get("/api/days/:date", (req, res) => {
    if (!isWorkDate(req.params.date)) {
      res.status(400).json({ error: "Data inválida." });
      return;
    }
    res.json(store.read(req.params.date));
  });
  app.put("/api/days/:date", (req, res) => {
    let day;
    try {
      day = validateDay(req.body);
      if (day.date !== req.params.date)
        throw new Error("A data do rascunho não corresponde ao dia aberto.");
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Rascunho inválido.",
      });
      return;
    }
    try {
      res.json(store.save(day));
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      res.status(409).json({ error: error.message });
    }
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Recurso não encontrado." }),
  );
  return app;
}

export const handleErrors: express.ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  if (error instanceof RedmineError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  if (
    error?.type === "entity.parse.failed" ||
    error?.type === "entity.too.large"
  ) {
    res.status(400).json({ error: "Conteúdo inválido ou muito grande." });
    return;
  }
  console.error(
    "A operação local falhou. Verifique a disponibilidade do banco de dados.",
  );
  res.status(500).json({
    error:
      "Não foi possível acessar os dados locais. Tente novamente sem fechar a página.",
  });
};
