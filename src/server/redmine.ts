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
  return { baseUrl: url.href.replace(/\/+$/, "") + "/", apiKey };
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
  request: typeof fetch = fetch,
) {
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
    const type =
      response.headers
        .get("content-type")
        ?.split(";")[0]
        .trim()
        .toLowerCase() ?? "";
    if (type !== "application/json" && !type.endsWith("+json"))
      return fail(
        new RedmineError(
          "invalid_response",
          "O servidor não devolveu JSON. Confira o endereço e se a API está habilitada.",
        ),
      );
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
  return {
    status() {
      return { configured: !!config, hasApiKey: !!config?.apiKey };
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
