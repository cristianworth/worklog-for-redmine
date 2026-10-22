import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { openDraftStore, ConflictError } from "./storage";
import { createApp, handleErrors } from "./app";
const activity = { projectId: 10, activityId: 101, name: "Revisão" };
let folder: string | undefined;
let store: ReturnType<typeof openDraftStore> | undefined;
let server: Server | undefined;
afterEach(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server!.close((error) => (error ? reject(error) : resolve())),
    );
  server = undefined;
  store?.close();
  store = undefined;
  if (folder) rmSync(folder, { recursive: true, force: true });
  folder = undefined;
});
describe("local activity catalog persistence", () => {
  it("adds an empty catalog when opening a database from the previous version", () => {
    folder = mkdtempSync(join(tmpdir(), "worklog-old-schema-"));
    const filename = join(folder, "worklog.sqlite");
    const old = new DatabaseSync(filename);
    const day = {
      date: "2026-10-22",
      revision: 4,
      entries: [
        {
          id: "old-entry",
          issue: "1001",
          minutes: 30,
          activity: "Old label",
          comment: "Synthetic",
        },
      ],
    };
    old.exec(
      "CREATE TABLE draft_days (date TEXT PRIMARY KEY, revision INTEGER NOT NULL, entries TEXT NOT NULL)",
    );
    old
      .prepare("INSERT INTO draft_days VALUES (?, ?, ?)")
      .run(day.date, day.revision, JSON.stringify(day.entries));
    old.close();
    store = openDraftStore(filename);
    expect(store.read(day.date)).toEqual(day);
    expect(store.readActivities()).toEqual({ revision: 0, activities: [] });
  });

  it("reopens settings alongside existing drafts without changing their revisions", () => {
    folder = mkdtempSync(join(tmpdir(), "worklog-catalog-"));
    const filename = join(folder, "worklog.sqlite");
    store = openDraftStore(filename);
    const draft = store.save({
      date: "2026-10-22",
      revision: 0,
      entries: [
        {
          id: "example",
          issue: "1001",
          minutes: 30,
          activity: "Old label",
          comment: "Synthetic",
        },
      ],
    });
    expect(store.readActivities()).toEqual({ revision: 0, activities: [] });
    const saved = store.saveActivities({ revision: 0, activities: [activity] });
    store.close();
    store = openDraftStore(filename);
    expect(store.readActivities()).toEqual(saved);
    expect(store.read(draft.date)).toEqual(draft);
    expect(store.saveActivities({ ...saved, activities: [] })).toEqual({
      revision: 2,
      activities: [],
    });
  });
  it("rejects conflicting and invalid writes without replacing the current catalog", () => {
    store = openDraftStore(":memory:");
    const saved = store.saveActivities({ revision: 0, activities: [activity] });
    expect(() =>
      store!.saveActivities({ revision: 0, activities: [] }),
    ).toThrow(ConflictError);
    expect(() =>
      store!.saveActivities({ revision: 1, activities: [activity, activity] }),
    ).toThrow();
    expect(store.readActivities()).toEqual(saved);
  });
});
describe("local activity catalog API", () => {
  async function start() {
    store = openDraftStore(":memory:");
    const app = createApp(store);
    app.use(handleErrors);
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }
  const put = (base: string, body: unknown, origin = base) =>
    fetch(base + "/api/activities", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(body),
    });
  it("saves a catalog independently from drafts and reports stale versions", async () => {
    const base = await start();
    const first = await fetch(base + "/api/activities");
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(await first.json()).toEqual({ revision: 0, activities: [] });
    const response = await put(base, { revision: 0, activities: [activity] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      revision: 1,
      activities: [activity],
    });
    expect((await put(base, { revision: 0, activities: [] })).status).toBe(409);
    expect(await (await fetch(base + "/api/activities")).json()).toEqual({
      revision: 1,
      activities: [activity],
    });
    expect(store!.read("2026-10-22").revision).toBe(0);
  });
  it("rejects malformed and foreign-origin requests without persisting anything", async () => {
    const base = await start();
    expect(
      (
        await put(base, {
          revision: 0,
          activities: [{ ...activity, projectId: "10" }],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await put(
          base,
          { revision: 0, activities: [activity] },
          "https://example.invalid",
        )
      ).status,
    ).toBe(403);
    expect(store!.readActivities()).toEqual({ revision: 0, activities: [] });
  });
});
