import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDraftStore } from "./storage";
import { createRedmineClient } from "./redmine";
import { createSubmissionService } from "./submissions";
import { createBatchService } from "./batches";
import { createApp, handleErrors } from "./app";
import { validateBatchSelection } from "../shared/batches";
import { parseDuration } from "../shared/worklogs";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
let store: ReturnType<typeof openDraftStore>;
let cleanupStore = () => {};
let folder: string | undefined;
let server: Server | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  if (server)
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
  cleanupStore();
  cleanupStore = () => {};
  if (folder) rmSync(folder, { recursive: true, force: true });
  folder = undefined;
});
function setup(filename = ":memory:", dates = ["2026-10-12"]) {
  store = openDraftStore(filename);
  cleanupStore = () => store.close();
  store.saveActivities({
    revision: 0,
    activities: [{ activityId: 101, name: "Review" }],
  });
  const days = dates.map((date) =>
    store.save({
      date,
      revision: 0,
      entries: [1, 2, 3].map((i) => ({
        id: `row-${i}`,
        issue: "1001",
        minutes: 30 + i,
        comment: `Synthetic work ${i}`,
        activity: "Review",
      })),
    }),
  );
  const selections = days.flatMap((day) =>
    day.entries.map((entry) => ({
      date: day.date,
      entryId: entry.id,
      revision: day.revision,
    })),
  );
  const rows: any[] = [];
  const invalidIssues = new Map<string, number>();
  let posts = 0,
    failAt = 0,
    failure = 422;
  let wait: Promise<void> | null = null;
  const request = vi
    .fn<typeof fetch>()
    .mockImplementation(async (input, options) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("users/current.json"))
        return json({ user: { id: 7 } });
      const issueId = url.pathname.match(/issues\/(\d+)\.json$/)?.[1];
      if (issueId && invalidIssues.has(issueId)) return json({}, invalidIssues.get(issueId));
      if (issueId)
        return json({
          issue: {
            id: Number(issueId),
            subject: "Synthetic task",
            status: { id: 2, name: "In progress" },
            project: { id: 10, name: "Example" },
          },
        });
      if (url.pathname.endsWith("projects/10.json"))
        return json({
          project: {
            id: 10,
            time_entry_activities: [{ id: 101, name: "Review" }],
          },
        });
      if (url.pathname.endsWith("time_entries.json")) {
        if (options?.method === "POST") {
          posts++;
          if (wait) await wait;
          const p = JSON.parse(String(options.body)).time_entry;
          if (posts === failAt && failure === 422) return json({}, 422);
          const row = {
            id: 900 + rows.length,
            issue: { id: p.issue_id },
            project: { id: 10 },
            user: { id: 7 },
            activity: { id: p.activity_id },
            spent_on: p.spent_on,
            hours: parseDuration(p.hours)! / 60,
            comments: p.comments,
          };
          rows.push(row);
          return posts === failAt
            ? json({}, failure)
            : json({ time_entry: row }, 201);
        }
        const filtered = rows.filter(
          (row) => row.spent_on === url.searchParams.get("from"),
        );
        return json({ time_entries: filtered, total_count: filtered.length });
      }
      const id = Number(url.pathname.match(/time_entries\/(\d+)\.json$/)?.[1]);
      if (id) return json({ time_entry: rows.find((row) => row.id === id) });
      throw new Error("Unexpected synthetic endpoint");
    });
  const client = createRedmineClient(
    { baseUrl: "https://example.invalid/", apiKey: "synthetic" },
    request,
  );
  const individual = createSubmissionService(store, client);
  return {
    days,
    invalidIssues,
    selections,
    rows,
    request,
    client,
    individual,
    service: createBatchService(store, individual),
    posts: () => posts,
    fail: (n: number, status = 422) => {
      failAt = n;
      failure = status;
    },
    hold: (promise: Promise<void>) => {
      wait = promise;
    },
  };
}
describe("batch submission", () => {
  it("identifies an invalid task during preparation and blocks the entire day", async () => {
    const t = setup();
    t.invalidIssues.set("1001", 404);
    const batch = await t.service.prepare(t.selections);
    expect(batch.items.every((item) => item.error?.includes("tarefa #1001"))).toBe(true);
    expect(batch.items[0].error).toContain("12/10/2026 · linha 1");
    expect(batch.message).toContain("Nenhuma hora");
    expect(() => t.service.start(batch.id)).toThrow();
    expect(t.posts()).toBe(0);
  });
  it.each([404, 403, 500])("sends nothing if the last task becomes inaccessible after review (%i)", async (status) => {
    const t = setup();
    const day = store.save({ ...t.days[0], entries: t.days[0].entries.map((entry, i) => ({ ...entry, issue: String(1001 + i) })) });
    const selections = t.selections.map((item) => ({ ...item, revision: day.revision }));
    const review = await t.service.prepare(selections);
    t.invalidIssues.set("1003", status);
    const result = await t.service.start(review.id);
    expect(t.posts()).toBe(0);
    expect(result.state).toBe("interrupted");
    expect(result.items[2].error).toContain("12/10/2026 · linha 3 · tarefa #1003");
    expect(result.items.every((item) => item.record?.state === "prepared")).toBe(true);
    expect(result.message).toContain("Nenhuma hora deste lote foi enviada");
    expect(() => t.service.start(review.id)).toThrow();
  });
  it("blocks both dates when a task in the second day becomes invalid", async () => {
    const t = setup(":memory:", ["2026-10-13", "2026-10-14"]);
    const day = store.save({ ...t.days[1], entries: t.days[1].entries.map((entry) => ({ ...entry, issue: "1002" })) });
    const selections = t.selections.map((item) => item.date === day.date ? { ...item, revision: day.revision } : item);
    const review = await t.service.prepare(selections);
    t.invalidIssues.set("1002", 404);
    const result = await t.service.start(review.id);
    expect(t.posts()).toBe(0);
    expect(result.items.slice(0, 3).every((item) => item.error === null)).toBe(true);
    expect(result.items[3].error).toContain("14/10/2026");
    expect(result.state).toBe("interrupted");
  });
  it("checks every task before the first POST and shares repeated context only within preflight", async () => {
    const t = setup();
    const day = store.save({ ...t.days[0], entries: t.days[0].entries.map((entry, i) => ({ ...entry, issue: i === 2 ? "1002" : "1001" })) });
    const review = await t.service.prepare(t.selections.map((item) => ({ ...item, revision: day.revision })));
    t.request.mockClear();
    await t.service.start(review.id);
    const calls = t.request.mock.calls;
    const firstPost = calls.findIndex(([, options]) => options?.method === "POST");
    const before = calls.slice(0, firstPost).map(([url]) => new URL(String(url)).pathname);
    expect(before).toContain("/issues/1002.json");
    // One shared preflight + the individual guard immediately preceding the first write.
    expect(before.filter((path) => path === "/issues/1001.json")).toHaveLength(2);
    expect(before.filter((path) => path === "/users/current.json")).toHaveLength(2);
    expect(t.posts()).toBe(3);
  });
  it("detects an edit made while remote preflight is pending before any POST", async () => {
    const t = setup();
    const review = await t.service.prepare(t.selections);
    const original = t.client.issue;
    let edited = false;
    vi.spyOn(t.client, "issue").mockImplementation(async (id) => {
      const result = await original(id);
      if (!edited) {
        edited = true;
        store.save({ ...t.days[0], entries: t.days[0].entries.map((entry) => ({ ...entry, comment: "Edited during validation" })) });
      }
      return result;
    });
    const result = await t.service.start(review.id);
    expect(result.state).toBe("interrupted");
    expect(t.posts()).toBe(0);
    expect(result.items.some((item) => item.error?.includes("mudou"))).toBe(true);
  });

  it("keeps submitted results in history even after many canceled preparations", async () => {
    const t = setup();
    const sent = await t.service.start(
      (await t.service.prepare(t.selections)).id,
    );
    for (let i = 0; i < 25; i++) await t.service.prepare(t.selections);
    expect(
      t.service.list("2026-10-12", "2026-10-12").map((batch) => batch.id),
    ).toEqual([sent.id]);
    expect(t.posts()).toBe(3);
  });

  it("reviews a whole day without creating anything, then confirms each line once", async () => {
    const t = setup(),
      batch = await t.service.prepare(t.selections);
    expect(t.posts()).toBe(0);
    expect(batch.items).toHaveLength(3);
    const result = await t.service.start(batch.id);
    expect(result.state).toBe("finished");
    expect(result.items.map((i) => i.record?.state)).toEqual([
      "confirmed",
      "confirmed",
      "confirmed",
    ]);
    expect(t.posts()).toBe(3);
    expect(() => t.service.start(batch.id)).toThrow();
    expect(t.posts()).toBe(3);
    expect(
      t.request.mock.calls
        .filter(([, options]) => options?.method === "POST")
        .every(([, options]) => !String(options?.body).includes("status_id")),
    ).toBe(true);
  });
  it("submits two selected dates together with the correct date on every entry", async () => {
    const t = setup(":memory:", ["2026-10-13", "2026-10-14"]);
    const result = await t.service.start(
      (await t.service.prepare(t.selections)).id,
    );
    expect(result.state).toBe("finished");
    expect(t.posts()).toBe(6);
    expect(t.rows.map((r) => r.spent_on)).toEqual([
      "2026-10-13",
      "2026-10-13",
      "2026-10-13",
      "2026-10-14",
      "2026-10-14",
      "2026-10-14",
    ]);
  });
  it("does not start any row if one selected draft cannot be reviewed", async () => {
    const t = setup();
    store.save({
      ...t.days[0],
      entries: t.days[0].entries.map((e, i) =>
        i === 1 ? { ...e, activity: "Missing" } : e,
      ),
    });
    const batch = await t.service.prepare(
      t.selections.map((s) => ({ ...s, revision: 2 })),
    );
    expect(batch.items[1].error).toBeTruthy();
    expect(() => t.service.start(batch.id)).toThrow();
    expect(t.posts()).toBe(0);
  });
  it("preflights all local revisions before posting the first row", async () => {
    const t = setup(":memory:", ["2026-10-13", "2026-10-14"]),
      batch = await t.service.prepare(t.selections);
    store.save({
      ...t.days[1],
      entries: t.days[1].entries.map((e) => ({
        ...e,
        comment: "Changed after review",
      })),
    });
    expect(() => t.service.start(batch.id)).toThrow(/mudou/);
    expect(t.posts()).toBe(0);
  });
  it("rejects a batch whose individual review was replaced in another tab", async () => {
    const t = setup(),
      batch = await t.service.prepare(t.selections);
    await t.individual.prepare(
      t.selections[1].date,
      t.selections[1].entryId,
      1,
    );
    expect(() => t.service.start(batch.id)).toThrow(/mudou/);
    expect(t.posts()).toBe(0);
  });
  it("stops on rejection, preserves prior success and requires a new selection for unsent rows", async () => {
    const t = setup();
    t.fail(2);
    const result = await t.service.start(
      (await t.service.prepare(t.selections)).id,
    );
    expect(result.state).toBe("interrupted");
    expect(result.items.map((i) => i.record?.state)).toEqual([
      "confirmed",
      "rejected",
      "prepared",
    ]);
    expect(t.posts()).toBe(2);
    expect(() => t.service.start(result.id)).toThrow();
    expect(t.posts()).toBe(2);
    t.fail(0);
    const next = await t.service.start(
      (await t.service.prepare(t.selections.slice(1))).id,
    );
    expect(next.state).toBe("finished");
    expect(t.posts()).toBe(4);
  });
  it("preserves uncertainty and reads the remote result without replaying the batch", async () => {
    const t = setup();
    t.fail(2, 500);
    const batch = await t.service.start(
      (await t.service.prepare(t.selections)).id,
    );
    expect(batch.items.map((i) => i.record?.state)).toEqual([
      "confirmed",
      "uncertain",
      "prepared",
    ]);
    const record = batch.items[1].record!;
    expect((await t.individual.reconcile(record.id)).state).toBe("confirmed");
    expect(t.service.get(batch.id).items[1].record?.state).toBe("confirmed");
    expect(t.posts()).toBe(2);
  });
  it("skips already confirmed or existing lines without a new POST", async () => {
    const t = setup();
    const one = await t.individual.prepare(
      t.selections[0].date,
      t.selections[0].entryId,
      1,
    );
    await t.individual.send(one.id);
    const result = await t.service.start(
      (await t.service.prepare(t.selections)).id,
    );
    expect(result.state).toBe("finished");
    expect(t.posts()).toBe(3);
  });
  it("does not create a duplicate when two selected drafts are equivalent", async () => {
    const t = setup();
    store.save({
      ...t.days[0],
      entries: [t.days[0].entries[0], { ...t.days[0].entries[0], id: "row-2" }],
    });
    const result = await t.service.start(
      (
        await t.service.prepare(
          t.selections.slice(0, 2).map((s) => ({ ...s, revision: 2 })),
        )
      ).id,
    );
    expect(result.state).toBe("interrupted");
    expect(t.posts()).toBe(1);
  });
  it("blocks a second confirmation while exposing progress from the first worker", async () => {
    const t = setup(),
      batch = await t.service.prepare(t.selections);
    let release!: () => void;
    t.hold(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    const completion = t.service.start(batch.id);
    await vi.waitFor(() => expect(t.posts()).toBe(1));
    expect(t.service.get(batch.id).state).toBe("running");
    expect(t.service.get(batch.id).items[0].record?.state).toBe("sending");
    expect(() => t.service.start(batch.id)).toThrow();
    release();
    await completion;
    expect(t.posts()).toBe(3);
  });
  it("recovers interrupted execution from the database without dispatching remaining rows", async () => {
    folder = mkdtempSync(join(tmpdir(), "worklog-batch-"));
    const filename = join(folder, "test.sqlite"),
      t = setup(filename);
    const review = await t.service.prepare(t.selections);
    store.beginBatch(review.id);
    store.beginSubmission(review.items[0].record!.id);
    store.close();
    store = openDraftStore(filename);
    const recovered = createBatchService(
      store,
      createSubmissionService(store, t.client),
    );
    expect(recovered.get(review.id).state).toBe("interrupted");
    expect(recovered.get(review.id).items.map((i) => i.record?.state)).toEqual([
      "sending",
      "prepared",
      "prepared",
    ]);
    expect(() => recovered.start(review.id)).toThrow();
    expect(t.posts()).toBe(0);
  });
  it("expires batch review before creation", async () => {
    const t = setup(),
      batch = await t.service.prepare(t.selections);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 16 * 60 * 1000);
    expect(() => t.service.start(batch.id)).toThrow(/expirou/);
    expect(t.posts()).toBe(0);
  });
  it("rejects changed activity configuration before creating any row", async () => {
    const t = setup(),
      batch = await t.service.prepare(t.selections);
    store.saveActivities({
      revision: 1,
      activities: [{ activityId: 202, name: "Review" }],
    });
    expect(() => t.service.start(batch.id)).toThrow(/mudou/);
    expect(t.posts()).toBe(0);
  });
  it("validates selection size, identities, revisions and repeated rows", () => {
    for (const value of [
      null,
      [],
      Array(101).fill({}),
      [{ date: "bad", entryId: "x", revision: 1 }],
      [{ date: "2026-10-12", entryId: "x", revision: 0 }],
    ])
      expect(() => validateBatchSelection(value)).toThrow();
    const s = { date: "2026-10-12", entryId: "x", revision: 1 };
    expect(() => validateBatchSelection([s, s])).toThrow();
  });
  it("requires explicit local API confirmation and preserves origin checks", async () => {
    const t = setup(),
      app = createApp(store, t.client);
    app.use(handleErrors);
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (path: string, data: unknown, origin?: string) =>
      fetch(base + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(origin ? { Origin: origin } : {}),
        },
        body: JSON.stringify(data),
      });
    const review = await (
      await post("/api/submission-batches/prepare", { entries: t.selections })
    ).json();
    expect(
      (await post(`/api/submission-batches/${review.id}/confirm`, {})).status,
    ).toBe(400);
    expect(
      (
        await post(
          `/api/submission-batches/${review.id}/confirm`,
          { confirmed: true },
          "https://example.invalid",
        )
      ).status,
    ).toBe(403);
    expect(t.posts()).toBe(0);
    expect(
      (
        await post(`/api/submission-batches/${review.id}/confirm`, {
          confirmed: true,
        })
      ).status,
    ).toBe(202);
    await vi.waitFor(() => expect(t.posts()).toBe(3));
    const response = await fetch(`${base}/api/submission-batches/${review.id}`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).state).toBe("finished");
    expect(
      (
        await (
          await fetch(
            `${base}/api/submission-batches?from=2026-10-12&to=2026-10-12`,
          )
        ).json()
      ).batches,
    ).toHaveLength(1);
  });
});
