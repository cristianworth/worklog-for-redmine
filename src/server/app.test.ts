import { type AddressInfo } from "node:net";
import { type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, handleErrors } from "./app";
import { openDraftStore } from "./storage";

let store: ReturnType<typeof openDraftStore>;
let server: Server;
let base: string;
beforeEach(async () => {
  store = openDraftStore(":memory:");
  const app = createApp(store);
  app.use(handleErrors);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  store.close();
});
const day = {
  date: "2026-10-21",
  revision: 0,
  entries: [
    {
      id: "sample",
      issue: "1001",
      minutes: 90,
      activity: "Revisão",
      comment: "Exemplo fictício.",
    },
  ],
};
const put = (body: unknown, origin = base) =>
  fetch(`${base}/api/days/2026-10-21`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });

describe("draft persistence through the local API", () => {
  it("saves and reads a draft through JSON with its revision", async () => {
    const saved = await put(day);
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ ...day, revision: 1 });
    const read = await fetch(`${base}/api/days/2026-10-21`);
    expect(await read.json()).toEqual({ ...day, revision: 1 });
  });
  it("rejects a stale save and preserves the newer content", async () => {
    await put(day);
    const conflict = await put({ ...day, entries: [] });
    expect(conflict.status).toBe(409);
    expect(store.read(day.date).entries).toEqual(day.entries);
  });
  it("rejects malformed input and another website origin without writing", async () => {
    expect((await put({ ...day, date: "2026-10-22" })).status).toBe(400);
    expect(
      (await put({ ...day, entries: [{ ...day.entries[0], minutes: "90" }] }))
        .status,
    ).toBe(400);
    expect((await put(day, "https://example.com")).status).toBe(403);
    const badJson = await fetch(`${base}/api/days/2026-10-21`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    expect(badJson.status).toBe(400);
    expect(store.read(day.date).entries).toEqual([]);
    expect((await fetch(`${base}/api/days/2026-02-30`)).status).toBe(400);
  });
});
