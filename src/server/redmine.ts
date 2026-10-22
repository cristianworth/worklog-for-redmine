import { createHash } from "node:crypto";
import { formatDuration } from "../shared/worklogs";
import {
  matchesTimeEntry,
  type SubmissionSnapshot,
} from "../shared/submissions";
import { certificateExceptionRequest } from "./redmine-transport";

export class RedmineError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 502,
  ) {
    super(message);
  }
}

export interface RedmineConfig {
  baseUrl: string;
  apiKey: string;
  allowInvalidCertificate?: boolean;
}

export function readRedmineConfig(
  env: NodeJS.ProcessEnv,
): RedmineConfig | null {
  const baseUrl = env.REDMINE_URL?.trim() ?? "";
  const apiKey = env.REDMINE_API_KEY?.trim() ?? "";
  if (!baseUrl && !apiKey) return null;
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new RedmineError(
      "configuration",
      "Configure REDMINE_URL com o endereço HTTPS do Redmine.",
      503,
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new RedmineError(
      "configuration",
      "Use um endereço HTTPS sem credenciais, parâmetros ou fragmento em REDMINE_URL.",
      503,
    );
  }
  if (apiKey && (!/^[\x21-\x7e]+$/.test(apiKey) || apiKey.length > 512)) {
    throw new RedmineError(
      "configuration",
      "A chave de API configurada é inválida.",
      503,
    );
  }
  const exception = env.REDMINE_ALLOW_INVALID_CERTIFICATE?.trim() ?? "false";
  if (!["true", "false"].includes(exception))
    throw new RedmineError(
      "configuration",
      "REDMINE_ALLOW_INVALID_CERTIFICATE deve ser true ou false.",
      503,
    );
  return {
    baseUrl: url.href.replace(/\/+$/, "") + "/",
    apiKey,
    ...(exception === "true" ? { allowInvalidCertificate: true } : {}),
  };
}

export function networkError(error: unknown): RedmineError {
  const value = error as {
    name?: string;
    code?: string;
    cause?: { code?: string };
  };
  const code = value?.cause?.code ?? value?.code;
  if (code === "CERT_HAS_EXPIRED")
    return new RedmineError(
      "certificate_expired",
      "O certificado do Redmine está vencido. É necessário um certificado válido para conectar.",
    );
  if (code === "ERR_TLS_CERT_ALTNAME_INVALID")
    return new RedmineError(
      "certificate_hostname",
      "O certificado não corresponde ao endereço configurado. Confira o endereço HTTPS correto.",
    );
  if (
    [
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
      "SELF_SIGNED_CERT_IN_CHAIN",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
    ].includes(code ?? "")
  )
    return new RedmineError(
      "certificate_trust",
      "O certificado não é confiável neste computador. Confira a cadeia de certificados com a equipe responsável.",
    );
  if (code === "ENOTFOUND" || code === "EAI_AGAIN")
    return new RedmineError(
      "dns",
      "Não foi possível localizar o Redmine. Confira o endereço e a conexão com a VPN.",
    );
  if (value?.name === "TimeoutError" || value?.name === "AbortError")
    return new RedmineError(
      "timeout",
      "O Redmine demorou para responder. Tente novamente.",
    );
  return new RedmineError(
    "network",
    "Não foi possível conectar ao Redmine. Confira a rede e a VPN.",
  );
}

function positiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function namedReference(value: any): value is { id: number; name: string } {
  return (
    value &&
    positiveId(value.id) &&
    typeof value.name === "string" &&
    !!value.name
  );
}

export function createRedmineClient(
  config: RedmineConfig | null,
  injectedRequest?: typeof fetch,
) {
  const request =
    injectedRequest ??
    (config?.allowInvalidCertificate
      ? certificateExceptionRequest(config.baseUrl)
      : fetch);
  async function readJson(response: Response): Promise<any> {
    const type =
      response.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() ?? "";
    if (type !== "application/json" && !type.endsWith("+json")) {
      await response.body?.cancel();
      throw new RedmineError(
        "invalid_response",
        "O servidor não devolveu JSON. Confira o endereço e se a API está habilitada.",
      );
    }
    // Limit the response before parsing; raw server content must never reach an error or log.
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      if (!reader) throw new Error();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 1_000_000) {
          await reader.cancel();
          throw new RedmineError(
            "invalid_response",
            "A resposta do Redmine excedeu o limite desta consulta.",
          );
        }
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch (error) {
      if (error instanceof RedmineError) throw error;
      if (
        (error as Error)?.name === "TimeoutError" ||
        (error as Error)?.name === "AbortError"
      )
        throw networkError(error);
      throw new RedmineError(
        "invalid_response",
        "O Redmine devolveu uma resposta inválida para esta consulta.",
      );
    } finally {
      reader?.releaseLock();
    }
  }
  async function get(path: string): Promise<any> {
    if (!config)
      throw new RedmineError(
        "not_configured",
        "Configure o acesso em .env e reinicie a aplicação. Seus rascunhos continuam disponíveis.",
        503,
      );
    let response: Response;
    try {
      response = await request(new URL(path, config.baseUrl), {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
        headers: {
          Accept: "application/json",
          ...(config.apiKey ? { "X-Redmine-API-Key": config.apiKey } : {}),
        },
        cache: "no-store",
      });
    } catch (error) {
      throw networkError(error);
    }
    const fail = async (error: RedmineError): Promise<never> => {
      await response.body?.cancel();
      throw error;
    };
    if (response.status === 401)
      return fail(
        new RedmineError(
          "authentication",
          "O Redmine exige autenticação ou recusou a chave. Confira REDMINE_API_KEY.",
          401,
        ),
      );
    if (response.status === 403)
      return fail(
        new RedmineError(
          "permission",
          "O Redmine recusou esta consulta. Confira as permissões da conta e a disponibilidade da API.",
          403,
        ),
      );
    if (response.status === 404)
      return fail(
        new RedmineError(
          "not_found",
          "Recurso não encontrado ou indisponível para esta conta. Confira o código e o endereço configurado.",
          404,
        ),
      );
    if (response.status >= 300 && response.status < 400)
      return fail(
        new RedmineError(
          "redirect",
          "O servidor redirecionou a consulta. Confira o endereço base e o acesso à API; o login do navegador é separado.",
        ),
      );
    if (response.status !== 200)
      return fail(
        new RedmineError(
          "remote_response",
          "O Redmine não concluiu a consulta. Tente novamente mais tarde.",
        ),
      );
    return readJson(response);
  }

  return {
    status() {
      return {
        configured: !!config,
        hasApiKey: !!config?.apiKey,
        certificateException: !!config?.allowInvalidCertificate,
      };
    },
    async check() {
      const data = await get("users/current.json");
      if (!positiveId(data?.user?.id))
        throw new RedmineError(
          "invalid_response",
          "A resposta não confirmou uma conta autenticada na API.",
        );
      return { authenticated: true };
    },

    async account() {
      const data = await get("users/current.json");
      if (!positiveId(data?.user?.id))
        throw new RedmineError(
          "invalid_response",
          "A API não confirmou a conta atual.",
        );
      return {
        id: data.user.id as number,
        scope: createHash("sha256")
          .update(JSON.stringify([config?.baseUrl, data.user.id]))
          .digest("hex"),
      };
    },
    async projectActivities(projectId: number) {
      const data = await get(
        `projects/${projectId}.json?include=time_entry_activities`,
      );
      if (data?.project?.id !== projectId)
        throw new RedmineError(
          "invalid_response",
          "A resposta não confirmou o projeto da tarefa.",
        );
      const activities = data.project.time_entry_activities;
      if (activities === undefined) return null;
      if (
        !Array.isArray(activities) ||
        activities.some((a) => !namedReference(a))
      )
        throw new RedmineError(
          "invalid_response",
          "O catálogo remoto do projeto é inválido.",
        );
      return activities
        .filter((a) => a.active !== false)
        .map((a) => ({ id: a.id as number, name: a.name as string }));
    },
    async existingTimeEntries(snapshot: SubmissionSnapshot) {
      const ids: number[] = [];
      for (let offset = 0; offset < 10000; offset += 100) {
        const query = new URLSearchParams({
          issue_id: String(snapshot.issueId),
          user_id: String(snapshot.userId),
          from: snapshot.date,
          to: snapshot.date,
          limit: "100",
          offset: String(offset),
        });
        const data = await get(`time_entries.json?${query}`);
        if (
          !Array.isArray(data?.time_entries) ||
          !Number.isSafeInteger(data.total_count) ||
          data.total_count < 0
        )
          throw new RedmineError(
            "invalid_response",
            "Não foi possível conferir todos os lançamentos existentes.",
          );
        for (const entry of data.time_entries)
          if (matchesTimeEntry(entry, snapshot) && !ids.includes(entry.id))
            ids.push(entry.id);
        if (offset + data.time_entries.length >= data.total_count) return ids;
        if (!data.time_entries.length || data.time_entries.length < 100)
          throw new RedmineError(
            "invalid_response",
            "A consulta de lançamentos foi incompleta. Nenhum envio será iniciado.",
          );
      }
      throw new RedmineError(
        "invalid_response",
        "O volume de lançamentos excedeu a conferência automática. Nenhum envio será iniciado.",
      );
    },
    async timeEntryMatches(id: number, snapshot: SubmissionSnapshot) {
      const data = await get(`time_entries/${id}.json`);
      return (
        data?.time_entry?.id === id &&
        matchesTimeEntry(data.time_entry, snapshot)
      );
    },
    async createTimeEntry(
      snapshot: SubmissionSnapshot,
    ): Promise<{
      state: "confirmed" | "rejected" | "uncertain";
      remoteId: number | null;
      message: string;
    }> {
      if (!config)
        throw new RedmineError(
          "not_configured",
          "Configure o acesso antes de enviar.",
          503,
        );
      let remoteId: number | null = null;
      try {
        const response = await request(
          new URL("time_entries.json", config.baseUrl),
          {
            method: "POST",
            redirect: "manual",
            signal: AbortSignal.timeout(15000),
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              ...(config.apiKey ? { "X-Redmine-API-Key": config.apiKey } : {}),
            },
            body: JSON.stringify({
              time_entry: {
                issue_id: snapshot.issueId,
                spent_on: snapshot.date,
                hours: formatDuration(snapshot.minutes),
                comments: snapshot.comment,
                activity_id: snapshot.activityId,
              },
            }),
          },
        );
        if ([400, 401, 403, 404, 409, 422, 429].includes(response.status)) {
          await response.body?.cancel();
          return {
            state: "rejected",
            remoteId: null,
            message: `O Redmine recusou o envio (HTTP ${response.status}). Confira os campos, limites de data/duração e as permissões. Nenhuma confirmação de criação foi recebida.`,
          };
        }
        if (response.status !== 201) {
          await response.body?.cancel();
          return {
            state: "uncertain",
            remoteId: null,
            message:
              "A resposta não confirmou a criação. Não reenvie; confira o resultado no Redmine.",
          };
        }
        const location = response.headers.get("location");
        try {
          const data = await readJson(response);
          if (positiveId(data?.time_entry?.id)) remoteId = data.time_entry.id;
          if (remoteId && matchesTimeEntry(data.time_entry, snapshot))
            return {
              state: "confirmed",
              remoteId,
              message:
                "Horas confirmadas no Redmine. O status da tarefa foi mantido.",
            };
        } catch {
          /* An accepted creation with an unreadable response must never be retried automatically. */
        }
        if (!remoteId && location) {
          try {
            const url = new URL(location, config.baseUrl);
            const match = url.pathname.match(
              /\/time_entries\/(\d+)(?:\.json)?$/,
            );
            if (
              match &&
              url.origin === new URL(config.baseUrl).origin &&
              [
                new URL(`time_entries/${match[1]}`, config.baseUrl).pathname,
                new URL(`time_entries/${match[1]}.json`, config.baseUrl)
                  .pathname,
              ].includes(url.pathname) &&
              positiveId(Number(match[1]))
            )
              remoteId = Number(match[1]);
          } catch {}
        }
        if (remoteId) {
          const data = await get(`time_entries/${remoteId}.json`);
          if (
            data?.time_entry?.id === remoteId &&
            matchesTimeEntry(data.time_entry, snapshot)
          )
            return {
              state: "confirmed",
              remoteId,
              message:
                "Horas confirmadas no Redmine. O status da tarefa foi mantido.",
            };
        }
      } catch {
        /* Transport errors after dispatch are uncertain, even when a retry might succeed. */
      }
      return {
        state: "uncertain",
        remoteId,
        message:
          "O envio foi iniciado, mas não foi possível confirmar o resultado. Não reenvie; use Conferir resultado ou consulte o Redmine.",
      };
    },
    async issue(id: string) {
      if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
        throw new RedmineError(
          "invalid_issue",
          "Informe um código de tarefa inteiro e positivo.",
          400,
        );
      const data = await get(`issues/${id}.json`);
      const issue = data?.issue;
      if (
        !issue ||
        issue.id !== Number(id) ||
        typeof issue.subject !== "string" ||
        !namedReference(issue.status) ||
        !namedReference(issue.project)
      )
        throw new RedmineError(
          "invalid_response",
          "A resposta não contém os dados esperados da tarefa consultada.",
        );
      return {
        id: issue.id as number,
        subject: issue.subject as string,
        status: {
          id: issue.status.id as number,
          name: issue.status.name as string,
        },
        project: {
          id: issue.project.id as number,
          name: issue.project.name as string,
        },
      };
    },
  };
}

export type RedmineClient = ReturnType<typeof createRedmineClient>;
