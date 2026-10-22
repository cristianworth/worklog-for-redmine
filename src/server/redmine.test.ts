import { afterEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import {
  createRedmineClient,
  readRedmineConfig,
  networkError,
} from "./redmine";
import { createApp, handleErrors } from "./app";
import { openDraftStore } from "./storage";

const config = {
  baseUrl: "https://example.invalid/redmine/",
  apiKey: "synthetic-key",
};
const issue = {
  id: 1001,
  subject: 'Revisar "exemplo" — ação',
  status: { id: 2, name: "Em andamento" },
  project: { id: 10, name: "Projeto fictício" },
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

describe("private connection settings", () => {
  it("keeps the local application usable with no Redmine settings", async () => {
    expect(readRedmineConfig({})).toBeNull();
    const client = createRedmineClient(null);
    expect(client.status()).toEqual({
      configured: false,
      hasApiKey: false,
      certificateException: false,
    });
    await expect(client.check()).rejects.toMatchObject({
      code: "not_configured",
      status: 503,
    });
  });
  it("normalizes the base URL and preserves an installation subpath", () => {
    expect(
      readRedmineConfig({
        REDMINE_URL: " https://example.invalid/redmine ",
        REDMINE_API_KEY: " synthetic-key ",
      }),
    ).toEqual(config);
    expect(
      readRedmineConfig({ REDMINE_URL: "https://example.invalid" })?.apiKey,
    ).toBe("");
  });
  it.each([
    "http://example.invalid",
    "https://user:password@example.invalid",
    "https://example.invalid/?key=secret",
    "https://example.invalid/#secret",
    "not-a-url",
    "",
  ])(
    "rejects unsafe or incomplete settings without echoing them: %s",
    (url) => {
      expect(() =>
        readRedmineConfig({
          REDMINE_URL: url,
          REDMINE_API_KEY: "synthetic-key",
        }),
      ).toThrow(/Configure REDMINE_URL|Use um endereço HTTPS/);
    },
  );
  it("rejects header injection without exposing the configured key", () => {
    expect(() =>
      readRedmineConfig({
        REDMINE_URL: config.baseUrl,
        REDMINE_API_KEY: "synthetic\r\nsecret",
      }),
    ).toThrow("A chave de API configurada é inválida.");
  });
});

describe("read-only Redmine transport", () => {
  it("checks the current account without forwarding identity or secrets", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        user: {
          id: 7,
          login: "synthetic-login",
          mail: "private@example.invalid",
          api_key: "do-not-forward",
        },
      }),
    );
    const client = createRedmineClient(config, request);
    expect(await client.check()).toEqual({ authenticated: true });
    const [url, options] = request.mock.calls[0];
    expect(String(url)).toBe(
      "https://example.invalid/redmine/users/current.json",
    );
    expect(options).toMatchObject({
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: { "X-Redmine-API-Key": "synthetic-key" },
    });
    expect(client.status()).toEqual({
      configured: true,
      hasApiKey: true,
      certificateException: false,
    });
    expect(JSON.stringify(client.status())).not.toContain("synthetic-key");
  });
  it("returns only issue subject, status and project, preserving JSON escapes and Unicode", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        issue: {
          ...issue,
          description: "private details",
          custom_fields: [{ value: "private" }],
          author: { name: "private" },
        },
      }),
    );
    const client = createRedmineClient(config, request);
    expect(await client.issue("1001")).toEqual(issue);
    expect(String(request.mock.calls[0][0])).toBe(
      "https://example.invalid/redmine/issues/1001.json",
    );
    expect(request.mock.calls[0][1]?.method).toBe("GET");
  });
  it.each([
    "0",
    "-1",
    "1/../../users",
    "01",
    "1?key=secret",
    "abc",
    "9007199254740992",
  ])(
    "rejects invalid issue code %s without contacting a server",
    async (id) => {
      const request = vi.fn<typeof fetch>();
      await expect(
        createRedmineClient(config, request).issue(id),
      ).rejects.toMatchObject({ code: "invalid_issue", status: 400 });
      expect(request).not.toHaveBeenCalled();
    },
  );
  it.each([
    [401, "authentication"],
    [403, "permission"],
    [404, "not_found"],
    [302, "redirect"],
    [500, "remote_response"],
  ])(
    "classifies HTTP %s without forwarding the raw response or following redirects",
    async (status, code) => {
      const request = vi.fn<typeof fetch>().mockResolvedValue(
        new Response("private-body synthetic-key", {
          status: status as number,
          headers: { location: "https://elsewhere.invalid" },
        }),
      );
      const client = createRedmineClient(config, request);
      await expect(client.check()).rejects.toMatchObject({ code });
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it("can probe without a key, without borrowing browser cookies", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ user: { id: 7 } }));
    await createRedmineClient({ ...config, apiKey: "" }, request).check();
    expect(request.mock.calls[0][1]?.headers).toEqual({
      Accept: "application/json",
    });
  });
  it.each([
    json({ issue: { ...issue, id: 1002 } }),
    json({ issue: { ...issue, project: null } }),
    json({ issue: { ...issue, status: { id: "2", name: "Example" } } }),
    json({ issue: { ...issue, subject: null } }),
    json({ login: "not-an-issue" }),
    new Response("<html>private login content</html>", {
      headers: { "content-type": "text/html" },
    }),
    new Response("not JSON synthetic-key", {
      headers: { "content-type": "application/json" },
    }),
  ])("rejects malformed, mismatched and login responses", async (response) => {
    await expect(
      createRedmineClient(
        config,
        vi.fn<typeof fetch>().mockResolvedValue(response),
      ).issue("1001"),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("does not accept HTTP 200 without a validated authenticated account", async () => {
    await expect(
      createRedmineClient(
        config,
        vi.fn<typeof fetch>().mockResolvedValue(json({ user: { id: 0 } })),
      ).check(),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("rejects oversized response bodies before parsing them", async () => {
    const response = new Response("x".repeat(1_000_001), {
      headers: { "content-type": "application/json" },
    });
    await expect(
      createRedmineClient(
        config,
        vi.fn<typeof fetch>().mockResolvedValue(response),
      ).check(),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it.each([
    ["CERT_HAS_EXPIRED", "certificate_expired"],
    ["ERR_TLS_CERT_ALTNAME_INVALID", "certificate_hostname"],
    ["UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "certificate_trust"],
    ["ENOTFOUND", "dns"],
    ["ECONNREFUSED", "network"],
  ])(
    "reports %s without revealing the URL or original error",
    async (code, expected) => {
      const cause = Object.assign(new Error("private-host synthetic-key"), {
        code,
      });
      const request = vi
        .fn<typeof fetch>()
        .mockRejectedValue(
          new TypeError("private-host synthetic-key", { cause }),
        );
      try {
        await createRedmineClient(config, request).check();
        expect.fail("Expected error");
      } catch (error) {
        expect(error).toMatchObject({ code: expected });
        expect((error as Error).message).not.toMatch(
          /private-host|synthetic-key/,
        );
      }
    },
  );
  it("distinguishes a timeout from authentication errors", () => {
    expect(
      networkError(new DOMException("private", "TimeoutError")),
    ).toMatchObject({ code: "timeout" });
  });
});

let server: Server | undefined;
let store: ReturnType<typeof openDraftStore> | undefined;
afterEach(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server!.close((error) => (error ? reject(error) : resolve())),
    );
  server = undefined;
  store?.close();
  store = undefined;
});

describe("local Redmine API boundary", () => {
  async function start(request: typeof fetch) {
    store = openDraftStore(":memory:");
    const app = createApp(store, createRedmineClient(config, request));
    app.use(handleErrors);
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }
  it("checks access and reads an issue without saving drafts or leaking credentials", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        String(url).endsWith("users/current.json")
          ? json({ user: { id: 7 } })
          : json({ issue }),
      );
    const base = await start(request);
    const status = await fetch(base + "/api/redmine/status");
    expect(status.headers.get("cache-control")).toBe("no-store");
    expect(await status.json()).toEqual({
      configured: true,
      hasApiKey: true,
      certificateException: false,
    });
    expect(
      await (
        await fetch(base + "/api/redmine/check", {
          method: "POST",
          headers: { Origin: base },
        })
      ).json(),
    ).toEqual({ authenticated: true });
    expect(
      await (await fetch(base + "/api/redmine/issues/1001")).json(),
    ).toEqual(issue);
    expect(store!.read("2026-10-22")).toEqual({
      date: "2026-10-22",
      revision: 0,
      entries: [],
    });
    expect(
      request.mock.calls.every(([, options]) => options?.method === "GET"),
    ).toBe(true);
  });
  it("rejects foreign-origin connection checks before calling Redmine", async () => {
    const request = vi.fn<typeof fetch>();
    const base = await start(request);
    expect(
      (
        await fetch(base + "/api/redmine/check", {
          method: "POST",
          headers: { Origin: "https://elsewhere.invalid" },
        })
      ).status,
    ).toBe(403);
    expect(request).not.toHaveBeenCalled();
  });
  it("converts remote authentication failures into safe structured local errors", async () => {
    const base = await start(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response("private-host synthetic-key", { status: 401 }),
        ),
    );
    const response = await fetch(base + "/api/redmine/check", {
      method: "POST",
    });
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("authentication");
    expect(JSON.stringify(body)).not.toMatch(/private-host|synthetic-key/);
  });
});
