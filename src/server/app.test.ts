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

describe("period API", () => {
  const putDays = (days: unknown, origin = base) =>
    fetch(`${base}/api/days`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ days }),
    });
  it("persists two days and returns only the requested inclusive range", async () => {
    const next = { ...day, date: "2026-10-22" };
    expect((await putDays([day, next])).status).toBe(200);
    const response = await fetch(
      `${base}/api/days?from=2026-10-21&to=2026-10-22`,
    );
    expect(await response.json()).toEqual({
      days: [
        { ...day, revision: 1 },
        { ...next, revision: 1 },
      ],
    });
    const single = await fetch(
      `${base}/api/days?from=2026-10-22&to=2026-10-22`,
    );
    expect(await single.json()).toEqual({ days: [{ ...next, revision: 1 }] });
  });
  it("rejects an entire stale operation and keeps the existing records", async () => {
    await put(day);
    expect((await putDays([{ ...day, date: "2026-10-22" }, day])).status).toBe(
      409,
    );
    expect(store.read("2026-10-22").revision).toBe(0);
    expect(store.read(day.date).entries).toEqual(day.entries);
  });
  it("rejects bad periods, duplicate dates, invalid payloads and foreign origins", async () => {
    for (const query of [
      "from=2026-10-22&to=2026-10-21",
      "from=2026-02-30&to=2026-10-21",
      "from=2026-10-21",
    ]) {
      expect((await fetch(`${base}/api/days?${query}`)).status).toBe(400);
    }
    expect((await putDays([day, day])).status).toBe(400);
    expect(
      (
        await putDays([
          day,
          {
            ...day,
            date: "2026-10-22",
            entries: [{ ...day.entries[0], minutes: -1 }],
          },
        ])
      ).status,
    ).toBe(400);
    expect((await putDays([day], "https://example.com")).status).toBe(403);
    expect(store.read(day.date).revision).toBe(0);
  });
});
