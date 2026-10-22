import https from "node:https";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ClientRequest, IncomingMessage } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { certificateExceptionRequest } from "./redmine-transport";
import { createRedmineClient, readRedmineConfig } from "./redmine";

afterEach(() => vi.restoreAllMocks());

function mockHttps(
  status = 200,
  body: unknown = { user: { id: 7 } },
  rawHeaders = ["content-type", "application/json"],
) {
  const end = vi.fn();
  const outgoing = Object.assign(new EventEmitter(), {
    end,
  }) as unknown as ClientRequest;
  const request = vi
    .spyOn(https, "request")
    .mockImplementation((...args: unknown[]) => {
      const callback = args[2] as (response: IncomingMessage) => void;
      end.mockImplementation(() => {
        const incoming = Object.assign(new PassThrough(), {
          statusCode: status,
          rawHeaders,
        });
        callback(incoming as unknown as IncomingMessage);
        incoming.end(JSON.stringify(body));
      });
      return outgoing;
    });
  return { request, outgoing, end };
}

describe("explicit private-server certificate exception", () => {
  const env = {
    REDMINE_URL: "https://example.invalid/redmine",
    REDMINE_API_KEY: "synthetic-key",
  };
  it("keeps strict verification as the default and accepts only an explicit boolean setting", () => {
    expect(readRedmineConfig(env)?.allowInvalidCertificate).not.toBe(true);
    expect(
      readRedmineConfig({ ...env, REDMINE_ALLOW_INVALID_CERTIFICATE: "false" })
        ?.allowInvalidCertificate,
    ).not.toBe(true);
    expect(
      readRedmineConfig({ ...env, REDMINE_ALLOW_INVALID_CERTIFICATE: "true" })
        ?.allowInvalidCertificate,
    ).toBe(true);
    expect(() =>
      readRedmineConfig({ ...env, REDMINE_ALLOW_INVALID_CERTIFICATE: "yes" }),
    ).toThrow("REDMINE_ALLOW_INVALID_CERTIFICATE deve ser true ou false.");
  });
  it("does not change global TLS state and reports the exception without exposing settings", async () => {
    const globalAgent = https.globalAgent;
    const globalOptions = { ...https.globalAgent.options };
    const globalEnvironment = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    const { request } = mockHttps();
    const client = createRedmineClient(
      readRedmineConfig({ ...env, REDMINE_ALLOW_INVALID_CERTIFICATE: "true" }),
    );
    expect(await client.check()).toEqual({ authenticated: true });
    expect(request).toHaveBeenCalledTimes(1);
    expect(String(request.mock.calls[0][0])).toBe(
      "https://example.invalid/redmine/users/current.json",
    );
    expect(request.mock.calls[0][1]).toMatchObject({
      agent: false,
      rejectUnauthorized: false,
      method: "GET",
      headers: { "x-redmine-api-key": "synthetic-key" },
    });
    expect(client.status()).toEqual({
      configured: true,
      hasApiKey: true,
      certificateException: true,
    });
    expect(https.globalAgent).toBe(globalAgent);
    expect(https.globalAgent.options).toEqual(globalOptions);
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe(globalEnvironment);
  });
  it("uses the ordinary strict fetch path when the exception is disabled", async () => {
    const strict = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"user":{"id":7}}', {
        headers: { "content-type": "application/json" },
      }),
    );
    const httpsRequest = vi.spyOn(https, "request");
    expect(await createRedmineClient(readRedmineConfig(env)).check()).toEqual({
      authenticated: true,
    });
    expect(strict).toHaveBeenCalledTimes(1);
    expect(httpsRequest).not.toHaveBeenCalled();
  });
  it.each([
    ["https://other.invalid/redmine/users/current.json", "GET"],
    ["https://example.invalid:444/redmine/users/current.json", "GET"],
    ["http://example.invalid/redmine/users/current.json", "GET"],
    ["https://user:secret@example.invalid/redmine/users/current.json", "GET"],
    ["https://example.invalid/redmine/users/current.json", "POST"],
  ])(
    "refuses an unauthorized target or operation before connecting: %s %s",
    async (url, method) => {
      const { request } = mockHttps();
      await expect(
        certificateExceptionRequest(env.REDMINE_URL)(url, { method }),
      ).rejects.toThrow(
        "A exceção de certificado permite somente consultas HTTPS ao Redmine configurado.",
      );
      expect(request).not.toHaveBeenCalled();
    },
  );
  it("does not follow a redirect with a key even to the same origin", async () => {
    const { request } = mockHttps(302, {}, [
      "location",
      "https://example.invalid/another-path",
      "content-type",
      "application/json",
    ]);
    const client = createRedmineClient({
      ...readRedmineConfig(env)!,
      allowInvalidCertificate: true,
    });
    await expect(client.check()).rejects.toMatchObject({ code: "redirect" });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("still interprets authentication failures and enforces the JSON contract", async () => {
    mockHttps(401, { errors: ["private-server-details"] });
    await expect(
      createRedmineClient({
        ...readRedmineConfig(env)!,
        allowInvalidCertificate: true,
      }).check(),
    ).rejects.toMatchObject({ code: "authentication" });
  });
  it("passes the cancellation signal to the dedicated HTTPS request", async () => {
    const { request } = mockHttps();
    const controller = new AbortController();
    const response = await certificateExceptionRequest(env.REDMINE_URL)(
      "https://example.invalid/redmine/users/current.json",
      { method: "GET", signal: controller.signal },
    );
    expect(request.mock.calls[0][1]).toMatchObject({
      signal: controller.signal,
    });
    await response.body?.cancel();
  });
  it("enforces the response-size limit with the exception transport too", async () => {
    mockHttps(200, { user: { id: 7 }, extra: "x".repeat(1_000_001) });
    await expect(
      createRedmineClient({
        ...readRedmineConfig(env)!,
        allowInvalidCertificate: true,
      }).check(),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("propagates request failures without leaking server details", async () => {
    const { outgoing, request } = mockHttps();
    request.mockImplementation(() => {
      queueMicrotask(() =>
        outgoing.emit(
          "error",
          Object.assign(new Error("private-server-details"), {
            code: "ENOTFOUND",
          }),
        ),
      );
      return outgoing;
    });
    await expect(
      createRedmineClient({
        ...readRedmineConfig(env)!,
        allowInvalidCertificate: true,
      }).check(),
    ).rejects.toMatchObject({ code: "dns" });
  });
  it("returns a valid empty redirect response without reading or forwarding it", async () => {
    mockHttps(304);
    const response = await certificateExceptionRequest(env.REDMINE_URL)(
      "https://example.invalid/redmine/users/current.json",
      { method: "GET" },
    );
    expect(response.status).toBe(304);
    expect(response.body).toBeNull();
  });
});
