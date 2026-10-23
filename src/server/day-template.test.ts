import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDraftStore } from "./storage";
import { createApp, handleErrors } from "./app";
import { createRedmineClient } from "./redmine";
import {
  instantiateDayTemplate,
  validateDayTemplate,
} from "../shared/day-template";
import {
  emptyDay,
  mergeLoadedDays,
  startDayWithTemplate,
  toDraftDay,
  toEditor,
  type EditorState,
} from "../client/editor";

const entry = {
  issue: "1001",
  minutes: 30,
  activity: "Reunião",
  comment: "Exemplo fictício de rotina.",
};
const model = { revision: 0, entries: [entry] };
let store: ReturnType<typeof openDraftStore> | undefined;
let folder: string | undefined;
let server: Server | undefined;
afterEach(async () => {
  if (server)
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
  store?.close();
  store = undefined;
  if (folder) rmSync(folder, { recursive: true, force: true });
  folder = undefined;
});
const initial = (): EditorState => ({ days: {}, dirtyDates: [] });
describe("local day template", () => {
  it("starts empty without seeding real or synthetic defaults", () => {
    store = openDraftStore(":memory:");
    expect(store.readDayTemplate()).toEqual({ revision: 0, entries: [] });
    expect(store.readRange("2026-10-22", "2026-10-24")).toEqual([]);
  });
  it("keeps incomplete defaults and strips dates, IDs and receipts", () => {
    const template = validateDayTemplate({
      revision: 0,
      entries: [
        {
          ...entry,
          issue: "",
          minutes: null,
          id: "old",
          date: "2026-10-22",
          remoteId: 900,
          state: "confirmed",
        },
      ],
    });
    expect(template.entries).toEqual([{ ...entry, issue: "", minutes: null }]);
    const drafts = instantiateDayTemplate(template, () => "new");
    expect(drafts[0]).toEqual({
      ...entry,
      issue: "",
      minutes: null,
      id: "new",
    });
    expect(drafts[0]).not.toHaveProperty("remoteId");
  });
  it("rejects malformed templates and invalid issue codes or durations", () => {
    const invalid = [
      null,
      {},
      { ...model, revision: -1 },
      { ...model, entries: Array(101).fill(entry) },
      ...[
        { issue: "abc" },
        { issue: "0" },
        { issue: "9007199254740992" },
        { minutes: -1 },
        { minutes: 1.5 },
        { minutes: "30" },
        { comment: 7 },
      ].map((bad) => ({ ...model, entries: [{ ...entry, ...bad }] })),
      {
        ...model,
        entries: [{ ...entry, minutes: Number.MAX_SAFE_INTEGER }, entry],
      },
    ];
    for (const value of invalid)
      expect(() => validateDayTemplate(value)).toThrow();
  });
  it("creates independent row identities for each new date", () => {
    let id = 0;
    const makeId = () => `new-${++id}`;
    const first = instantiateDayTemplate(model, makeId);
    const second = instantiateDayTemplate(model, makeId);
    expect(first[0].id).not.toBe(second[0].id);
    first[0].comment = "Changed in one day";
    expect(second[0].comment).toBe(entry.comment);
    expect(model.entries[0].comment).toBe(entry.comment);
  });
  it("fills only the requested new day and waits for explicit draft saving", () => {
    store = openDraftStore(":memory:");
    const filled = startDayWithTemplate(
      initial(),
      "2026-10-22",
      instantiateDayTemplate(model, () => "new"),
    );
    expect(filled.dirtyDates).toEqual(["2026-10-22"]);
    expect(filled.days["2026-10-22"].entries[0].duration).toBe("00:30");
    expect(filled.days).not.toHaveProperty("2026-10-23");
    expect(store.read("2026-10-22").entries).toEqual([]);
    expect(
      store.save(toDraftDay(filled.days["2026-10-22"])).entries[0].id,
    ).toBe("new");
  });
  it("does not apply twice or reapply after removing all unsaved copied rows", () => {
    const rows = instantiateDayTemplate(model, () => "new");
    const once = startDayWithTemplate(initial(), "2026-10-22", rows);
    expect(startDayWithTemplate(once, "2026-10-22", rows)).toBe(once);
    const removed = { ...once, days: { "2026-10-22": emptyDay("2026-10-22") } };
    expect(startDayWithTemplate(removed, "2026-10-22", rows)).toBe(removed);
  });
  it("preserves saved days, saved empty days and unsaved manual work", () => {
    const date = "2026-10-22",
      rows = instantiateDayTemplate(model, () => "new");
    for (const day of [
      { ...emptyDay(date), revision: 1 },
      toEditor({ date, revision: 1, entries: rows }),
      toEditor({ date, revision: 0, entries: rows }),
    ]) {
      const state = { days: { [date]: day }, dirtyDates: [] };
      expect(startDayWithTemplate(state, date, rows)).toBe(state);
    }
    expect(startDayWithTemplate(initial(), "bad", rows).dirtyDates).toEqual([]);
    expect(startDayWithTemplate(initial(), date, []).dirtyDates).toEqual([]);
  });
  it("never fills dates just by viewing or refreshing a period", () => {
    const viewed = mergeLoadedDays(initial(), ["2026-10-22", "2026-10-23"], []);
    expect(viewed.dirtyDates).toEqual([]);
    expect(Object.values(viewed.days).every((day) => !day.entries.length)).toBe(
      true,
    );
  });
  it("reopens the template and drafts without applying newer defaults to existing dates", () => {
    folder = mkdtempSync(join(tmpdir(), "worklog-template-"));
    const filename = join(folder, "test.sqlite");
    store = openDraftStore(filename);
    store.saveDayTemplate(model);
    const filled = startDayWithTemplate(
      initial(),
      "2026-10-22",
      instantiateDayTemplate(model, () => "new"),
    );
    const saved = store.save(toDraftDay(filled.days["2026-10-22"]));
    store.saveDayTemplate({
      revision: 1,
      entries: [{ ...entry, minutes: 45 }],
    });
    store.close();
    store = openDraftStore(filename);
    expect(store.readDayTemplate().entries[0].minutes).toBe(45);
    expect(store.read("2026-10-22")).toEqual(saved);
    const state = { days: { "2026-10-22": toEditor(saved) }, dirtyDates: [] };
    expect(
      startDayWithTemplate(
        state,
        "2026-10-22",
        instantiateDayTemplate(store.readDayTemplate(), () => "later"),
      ),
    ).toBe(state);
    expect(store.read("2026-10-23").entries).toEqual([]);
  });
  it("rejects stale settings without changing the template or drafts", () => {
    store = openDraftStore(":memory:");
    const day = store.save({
      date: "2026-10-22",
      revision: 0,
      entries: instantiateDayTemplate(model, () => "new"),
    });
    const saved = store.saveDayTemplate(model);
    expect(() => store!.saveDayTemplate({ ...model, entries: [] })).toThrow(
      /outra aba/,
    );
    expect(() =>
      store!.saveDayTemplate({
        revision: 1,
        entries: [{ ...entry, minutes: -1 }],
      }),
    ).toThrow();
    expect(store.readDayTemplate()).toEqual(saved);
    expect(store.read(day.date)).toEqual(day);
  });
  it("opens an older database without rewriting its saved day", () => {
    folder = mkdtempSync(join(tmpdir(), "worklog-template-old-"));
    const filename = join(folder, "test.sqlite"),
      legacy = new DatabaseSync(filename);
    const entries = JSON.stringify([{ ...entry, id: "old" }]);
    legacy.exec(
      "CREATE TABLE draft_days (date TEXT PRIMARY KEY, revision INTEGER NOT NULL, entries TEXT NOT NULL)",
    );
    legacy
      .prepare("INSERT INTO draft_days VALUES (?, ?, ?)")
      .run("2026-10-22", 7, entries);
    legacy.close();
    store = openDraftStore(filename);
    store.saveDayTemplate(model);
    store.close();
    store = undefined;
    const check = new DatabaseSync(filename);
    expect(
      check.prepare("SELECT revision, entries FROM draft_days").get(),
    ).toMatchObject({ revision: 7, entries });
    check.close();
  });
  it("protects a day saved in another tab before the model-based draft is saved", () => {
    store = openDraftStore(":memory:");
    const filled = startDayWithTemplate(
      initial(),
      "2026-10-22",
      instantiateDayTemplate(model, () => "from-template"),
    );
    const other = store.save({
      date: "2026-10-22",
      revision: 0,
      entries: [{ ...entry, id: "other-tab" }],
    });
    expect(() => store!.save(toDraftDay(filled.days["2026-10-22"]))).toThrow(
      /outra aba/,
    );
    expect(store.read("2026-10-22")).toEqual(other);
    expect(filled.dirtyDates).toEqual(["2026-10-22"]);
  });
  it("serves and saves configuration locally with conflict/origin checks and zero Redmine requests", async () => {
    store = openDraftStore(":memory:");
    const remote = vi.fn<typeof fetch>();
    const app = createApp(
      store,
      createRedmineClient(
        { baseUrl: "https://example.invalid/", apiKey: "synthetic" },
        remote,
      ),
    );
    app.use(handleErrors);
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const put = (data: unknown, origin?: string) =>
      fetch(`${base}/api/day-template`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(origin ? { Origin: origin } : {}),
        },
        body: JSON.stringify(data),
      });
    const response = await fetch(`${base}/api/day-template`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ revision: 0, entries: [] });
    expect((await put(model, "https://example.invalid")).status).toBe(403);
    expect(
      (await put({ ...model, entries: [{ ...entry, issue: "bad" }] })).status,
    ).toBe(400);
    expect((await put(model)).status).toBe(200);
    expect((await put(model)).status).toBe(409);
    expect((await put({ revision: 1, entries: [] })).status).toBe(200);
    expect(store.readDayTemplate().entries).toEqual([]);
    expect(store.readRange("2026-10-22", "2026-10-24")).toEqual([]);
    expect(remote).not.toHaveBeenCalled();
  });
});
