import { validateActivityCatalog } from "../shared/activities";
import { validateDays } from "../shared/worklogs";
import { DataAccessError, type WorklogDataAccess } from "./data-access";
import { validateDayTemplate } from "../shared/day-template";
import type { SubmissionBatch } from "../shared/batches";

async function readJson(response: Response, fallback: string) {
  const data = await response.json();
  if (!response.ok)
    throw new DataAccessError(data.error || fallback, response.status);
  return data;
}

export function createHttpDataAccess(
  request: typeof fetch = fetch,
): WorklogDataAccess {
  const json = async (url: string, fallback: string, options?: RequestInit) =>
    readJson(await request(url, options), fallback);
  const post = (body: unknown): RequestInit => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const readBatch = async (
    url: string,
    options?: RequestInit,
  ): Promise<SubmissionBatch> => {
    const data = await json(url, "Não foi possível consultar o lote.", options);
    if (
      !data.id || !Array.isArray(data.items) ||
      !["prepared", "running", "finished", "interrupted"].includes(data.state)
    )
      throw new Error("O resultado do lote é inválido.");
    return data;
  };
  return {
    mode: "local",
    async readActivities(signal) {
      const response = await request("/api/activities", { signal });
      return validateActivityCatalog(
        await readJson(response, "Não foi possível carregar o catálogo."),
      );
    },
    async saveActivities(catalog) {
      const response = await request("/api/activities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catalog),
      });
      const saved = validateActivityCatalog(
        await readJson(response, "Não foi possível salvar o catálogo."),
      );
      if (
        saved.revision !== catalog.revision + 1 ||
        JSON.stringify(saved.activities) !== JSON.stringify(catalog.activities)
      )
        throw new Error(
          "Não foi possível confirmar o salvamento do catálogo. Preserve suas edições e recarregue o catálogo antes de tentar novamente.",
        );
      return saved;
    },
    async readDays(from, to, signal) {
      const query = new URLSearchParams({ from, to });
      const response = await request(`/api/days?${query}`, { signal });
      const data = await readJson(
        response,
        "Não foi possível acessar os rascunhos.",
      );
      return validateDays(data.days);
    },
    async saveDays(days) {
      const response = await request("/api/days", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const data = await readJson(
        response,
        "Não foi possível acessar os rascunhos.",
      );
      const saved = validateDays(data.days);
      const expected = new Map(days.map((day) => [day.date, day.revision + 1]));
      if (
        saved.length !== days.length ||
        saved.some((day) => expected.get(day.date) !== day.revision)
      )
        throw new Error(
          "Não foi possível confirmar o salvamento de todos os dias. Suas edições continuam na tela.",
        );
      return saved;
    },
    async readDayTemplate(signal) {
      return validateDayTemplate(await json(
        "/api/day-template", "Não foi possível carregar o modelo.", { signal },
      ));
    },
    async saveDayTemplate(template) {
      const saved = validateDayTemplate(await json(
        "/api/day-template", "Não foi possível salvar o modelo.",
        { ...post(template), method: "PUT" },
      ));
      if (
        saved.revision !== template.revision + 1 ||
        JSON.stringify(saved.entries) !== JSON.stringify(template.entries)
      )
        throw new Error(
          "Não foi possível confirmar o salvamento. Preserve suas edições e recarregue o modelo antes de tentar novamente.",
        );
      return saved;
    },
    async readIssue(code, refresh, signal) {
      const data = await json(
        `/api/redmine/issues/${encodeURIComponent(code)}${refresh ? "?refresh=1" : ""}`,
        "Não foi possível consultar a tarefa.", { signal },
      );
      if (
        data.id !== Number(code) || typeof data.subject !== "string" ||
        typeof data.status?.name !== "string" || typeof data.project?.name !== "string" ||
        !Number.isSafeInteger(data.project.id) || data.project.id <= 0
      )
        throw new Error("Resposta inválida para a tarefa consultada.");
      return data;
    },
    async readConnectionStatus(signal) {
      return json(
        "/api/redmine/status", "Não foi possível consultar a configuração local.",
        { signal },
      );
    },
    async checkConnection() {
      const data = await json(
        "/api/redmine/check", "Não foi possível testar o acesso.", { method: "POST" },
      );
      if (data.authenticated !== true)
        throw new Error("O teste não confirmou a autenticação.");
    },
    async listSubmissions(from, to, signal) {
      const data = await json(
        `/api/submissions?${new URLSearchParams({ from, to })}`,
        "Não foi possível carregar os resultados de envio.", { signal },
      );
      if (!Array.isArray(data.submissions))
        throw new Error("Lista de recibos inválida.");
      return data.submissions;
    },
    async listBatches(from, to, signal) {
      const data = await json(
        `/api/submission-batches?${new URLSearchParams({ from, to })}`,
        "Não foi possível carregar os resultados de envio.", { signal },
      );
      if (!Array.isArray(data.batches)) throw new Error("Lista de lotes inválida.");
      return data.batches;
    },
    async prepareSubmission(selection, signal) {
      return json(
        "/api/submissions/prepare", "Não foi possível preparar a revisão.",
        { ...post(selection), signal },
      );
    },
    async actOnSubmission(id, action) {
      return json(
        `/api/submissions/${encodeURIComponent(id)}/${action}`,
        "Não foi possível concluir esta operação.",
        post(action === "confirm" ? { confirmed: true } : {}),
      );
    },
    async prepareBatch(entries) {
      return readBatch("/api/submission-batches/prepare", post({ entries }));
    },
    async readBatch(id) {
      return readBatch(`/api/submission-batches/${encodeURIComponent(id)}`);
    },
    async confirmBatch(id) {
      return readBatch(
        `/api/submission-batches/${encodeURIComponent(id)}/confirm`,
        post({ confirmed: true }),
      );
    },
  };
}
