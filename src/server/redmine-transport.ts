import https from "node:https";

// This transport is opt-in and deliberately supports only GET on one configured origin.
export function certificateExceptionRequest(baseUrl: string): typeof fetch {
  const origin = new URL(baseUrl).origin;
  return async (input, options) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (
      url.protocol !== "https:" ||
      url.origin !== origin ||
      url.username ||
      url.password ||
      options?.method !== "GET" ||
      options.body
    ) {
      throw new Error(
        "A exceção de certificado permite somente consultas HTTPS ao Redmine configurado.",
      );
    }
    return new Promise<Response>((resolve, reject) => {
      const request = https.request(
        url,
        {
          method: "GET",
          headers: Object.fromEntries(new Headers(options.headers)),
          signal: options.signal ?? undefined,
          // No global agent or process-wide TLS settings are changed; redirects are never followed.
          agent: false,
          rejectUnauthorized: false,
        },
        (incoming) => {
          try {
            const headers = new Headers();
            for (let i = 0; i < incoming.rawHeaders.length; i += 2) {
              headers.append(
                incoming.rawHeaders[i],
                incoming.rawHeaders[i + 1],
              );
            }
            const status = incoming.statusCode ?? 502;
            const empty = [204, 205, 304].includes(status);
            if (empty) incoming.resume();
            let closed = false;
            const body = empty
              ? null
              : new ReadableStream<Uint8Array>({
                  start(controller) {
                    incoming.pause();
                    incoming.on("data", (chunk: Buffer) => {
                      if (closed) return;
                      controller.enqueue(chunk);
                      if ((controller.desiredSize ?? 0) <= 0) incoming.pause();
                    });
                    incoming.on("end", () => {
                      if (!closed) {
                        closed = true;
                        controller.close();
                      }
                    });
                    incoming.on("error", (error) => {
                      if (!closed) {
                        closed = true;
                        controller.error(error);
                      }
                    });
                  },
                  pull() {
                    incoming.resume();
                  },
                  cancel() {
                    closed = true;
                    incoming.destroy();
                  },
                });
            resolve(new Response(body, { status, headers }));
          } catch (error) {
            incoming.destroy();
            reject(error);
          }
        },
      );
      request.on("error", reject);
      request.end();
    });
  };
}
