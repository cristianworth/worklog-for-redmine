import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, it, expect, vi } from "vitest";
import { openDraftStore } from "./storage";
import { createRedmineClient } from "./redmine";
import { createSubmissionService } from "./submissions";
import { createApp, handleErrors } from "./app";
import {
  matchesTimeEntry,
  type SubmissionSnapshot,
} from "../shared/submissions";
import { parseDuration } from "../shared/worklogs";

const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
const date = "2026-10-22";
const entry = {
  id: "example",
  issue: "1001",
  minutes: 30,
  activity: "Reunião",
  comment: "Synthetic meeting",
};
const config = {
  baseUrl: "https://example.invalid/redmine/",
  apiKey: "synthetic-key",
};
function simulatedRedmine() {
  const rows: any[] = [];
  let userId = 7,
    projectId = 10;
  let post: ((payload: any) => Response | Promise<Response>) | null = null;
  let projectActivities: any[] | null = [{ id: 101, name: "Reunião" }];
  const request = vi
    .fn<typeof fetch>()
    .mockImplementation(async (input, options) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/users/current.json"))
        return json({ user: { id: userId } });
      if (url.pathname.endsWith("/issues/1001.json"))
        return json({
          issue: {
            id: 1001,
            subject: "Synthetic issue",
            status: { id: 2, name: "In progress" },
            project: { id: projectId, name: "Synthetic project" },
          },
        });
      if (/\/projects\/\d+\.json$/.test(url.pathname))
        return json({
          project: {
            id: projectId,
            ...(projectActivities === null
              ? {}
              : { time_entry_activities: projectActivities }),
          },
        });
      if (url.pathname.endsWith("/time_entries.json")) {
        if (options?.method === "POST") {
          const payload = JSON.parse(String(options.body)).time_entry;
          if (post) return post(payload);
          const row = {
            id: 900 + rows.length,
            issue: { id: payload.issue_id },
            project: { id: projectId },
            user: { id: userId },
            activity: { id: payload.activity_id },
            spent_on: payload.spent_on,
            hours: parseDuration(payload.hours)! / 60,
            comments: payload.comments,
          };
          rows.push(row);
          return json({ time_entry: row }, 201);
        }
        return json({
          time_entries: rows,
          total_count: rows.length,
          offset: 0,
          limit: 100,
        });
      }
      const id = url.pathname.match(/\/time_entries\/(\d+)\.json$/)?.[1];
      if (id)
        return json({ time_entry: rows.find((row) => row.id === Number(id)) });
      throw new Error("Unexpected synthetic URL");
    });
  const client = createRedmineClient(config, request);
  return {
    client,
    request,
    rows,
    setUser: (id: number) => {
      userId = id;
    },
    setProject: (id: number) => {
      projectId = id;
    },
    setActivities: (rows: any[] | null) => {
      projectActivities = rows;
    },
    setPost: (handler: (payload: any) => Response | Promise<Response>) => {
      post = handler;
    },
    posts: () =>
      request.mock.calls.filter(([, options]) => options?.method === "POST"),
  };
}
let store: ReturnType<typeof openDraftStore> | undefined;
let folder: string | undefined;
let server: Server | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
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
function setup(filename = ":memory:") {
  store = openDraftStore(filename);
  const remote = simulatedRedmine();
  store.saveActivities({
    revision: 0,
    activities: [{ activityId: 101, name: "Reunião" }],
  });
  const day = store.save({ date, revision: 0, entries: [entry] });
  return {
    ...remote,
    service: createSubmissionService(store, remote.client),
    day,
  };
}
describe("individual submission lifecycle", () => {
  it("keeps confirmation separate from remote creation when reconciling an earlier uncertain send", async () => {
    const t = setup();
    const review = await t.service.prepare(date, entry.id, t.day.revision);
    t.setPost((payload) => {
      t.rows.push({
        id: 904,
        issue: { id: 1001 },
        project: { id: 10 },
        user: { id: 7 },
        activity: { id: 101 },
        spent_on: date,
        hours: 0.5,
        comments: payload.comments,
        created_on: "2026-10-22T08:00:00Z",
      });
      return json({}, 500);
    });
    const uncertain = await t.service.send(review.id);
    expect(uncertain.confirmedAt).toBeNull();
    const result = await t.service.reconcile(review.id);
    expect(result).toMatchObject({
      state: "confirmed",
      remoteCreatedAt: "2026-10-22T08:00:00.000Z",
    });
    expect(result.confirmedAt).toBe(result.updatedAt);
    expect(result.confirmedAt).not.toBe(result.remoteCreatedAt);
    expect(t.posts()).toHaveLength(1);
    const checked = await t.service.verify(review.id);
    expect(checked.confirmedAt).toBe(result.confirmedAt);
  });

  it("commits the sending state visibly to another connection before the remote POST", async () => {
    folder = mkdtempSync(join(tmpdir(), "worklog-write-ahead-"));
    const filename = join(folder, "worklog.sqlite");
    const t = setup(filename);
    const review = await t.service.prepare(date, entry.id, t.day.revision),
      snapshot = review.snapshot;
    t.setPost(() => {
      const other = openDraftStore(filename);
      try {
        expect(other.submission(review.id)?.state).toBe("sending");
      } finally {
        other.close();
      }
      const row = {
        id: 905,
        issue: { id: snapshot.issueId },
        project: { id: snapshot.projectId },
        user: { id: snapshot.userId },
        activity: { id: snapshot.activityId },
        spent_on: snapshot.date,
        hours: 0.5,
        comments: snapshot.comment,
      };
      t.rows.push(row);
      return json({ time_entry: row }, 201);
    });
    expect(await t.service.send(review.id)).toMatchObject({
      state: "confirmed",
      remoteId: 905,
    });
    expect(t.posts()).toHaveLength(1);
  });

  it("prepares only a saved row using the activity in its issue project", async () => {
    const t = setup();
    const review = await t.service.prepare(date, entry.id, t.day.revision);
    expect(review).toMatchObject({
      state: "prepared",
      remoteId: null,
      snapshot: {
        date,
        entryId: entry.id,
        issueId: 1001,
        projectId: 10,
        userId: 7,
        activityId: 101,
        minutes: 30,
        comment: entry.comment,
        activityVerified: true,
      },
    });
    expect(t.posts()).toHaveLength(0);
    expect(store!.submissions(date, date)).toEqual([review]);
    expect(JSON.stringify(review)).not.toContain("synthetic-key");
  });
  it("creates exactly once after confirmation and sends no issue-status fields or user impersonation", async () => {
    const t = setup();
    const review = await t.service.prepare(date, entry.id, t.day.revision);
    const result = await t.service.send(review.id);
    expect(result).toMatchObject({ state: "confirmed", remoteId: 900 });
    expect(JSON.parse(String(t.posts()[0][1]?.body))).toEqual({
      time_entry: {
        issue_id: 1001,
        spent_on: date,
        hours: "00:30",
        comments: entry.comment,
        activity_id: 101,
      },
    });
    await expect(t.service.send(review.id)).rejects.toThrow(/utilizada/);
    expect(t.posts()).toHaveLength(1);
    expect(
      t.request.mock.calls.every(
        ([url, options]) =>
          options?.method === "GET" ||
          String(url) === "https://example.invalid/redmine/time_entries.json",
      ),
    ).toBe(true);
  });
  it("rejects a concurrent double click before a second POST", async () => {
    const t = setup();
    const review = await t.service.prepare(date, entry.id, t.day.revision);
    const results = await Promise.allSettled([
      t.service.send(review.id),
      t.service.send(review.id),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(t.posts()).toHaveLength(1);
  });
  it.each(["draft", "catalog"])(
    "invalidates a review after the %s changes",
    async (kind) => {
      const t = setup();
      const review = await t.service.prepare(date, entry.id, t.day.revision);
      if (kind === "draft")
        store!.save({ ...t.day, entries: [{ ...entry, comment: "Changed" }] });
      else
        store!.saveActivities({
          revision: 1,
          activities: [{ activityId: 101, name: "Reunião" }],
        });
      await expect(t.service.send(review.id)).rejects.toThrow(/mudou/);
      expect(t.posts()).toHaveLength(0);
    },
  );
  it("rejects a different authenticated account after review without posting", async () => {
    const t = setup();
    const review = await t.service.prepare(date, entry.id, t.day.revision);
    t.setUser(8);
    expect(await t.service.send(review.id)).toMatchObject({
      state: "rejected",
    });
    expect(t.posts()).toHaveLength(0);
  });
  it("blocks an activity unavailable in the issue project and tolerates an unavailable project catalog explicitly", async () => {
    const t = setup();
    t.setActivities([{ id: 202, name: "Reunião" }]);
    await expect(
      t.service.prepare(date, entry.id, t.day.revision),
    ).rejects.toThrow(/não está disponível/);
    t.setActivities(null);
    expect(
      (await t.service.prepare(date, entry.id, t.day.revision)).snapshot
        .activityVerified,
    ).toBe(false);
    expect(t.posts()).toHaveLength(0);
  });
  it.each([
    { ...entry, issue: "" },
    { ...entry, minutes: null },
    { ...entry, comment: " " },
    { ...entry, activity: "" },
  ])("rejects incomplete drafts without any remote request", async (input) => {
    const t = setup();
    const day = store!.save({ ...t.day, entries: [input] });
    await expect(
      t.service.prepare(date, entry.id, day.revision),
    ).rejects.toThrow();
    expect(t.request).not.toHaveBeenCalled();
  });
  it("leaves zero-hour acceptance to the server, preserving the draft rule", async () => {
    const t = setup();
    const day = store!.save({ ...t.day, entries: [{ ...entry, minutes: 0 }] });
    const review = await t.service.prepare(date, entry.id, day.revision);
    expect((await t.service.send(review.id)).state).toBe("confirmed");
    expect(JSON.parse(String(t.posts()[0][1]?.body)).time_entry.hours).toBe(
      "00:00",
    );
  });
  it("recognizes an existing equivalent entry and never creates another", async () => {
    const t = setup();
    const review = await t.service.prepare(date, entry.id, t.day.revision);
    const s = review.snapshot;
    t.rows.push({
      id: 899,
      issue: { id: s.issueId },
      project: { id: s.projectId },
      user: { id: s.userId },
      activity: { id: s.activityId },
      spent_on: s.date,
      hours: 0.5,
      comments: s.comment,
    });
    expect(await t.service.send(review.id)).toMatchObject({
      state: "existing",
      remoteId: 899,
    });
    expect(t.posts()).toHaveLength(0);
  });
  it("protects against duplicate payloads prepared as different rows", async () => {
    const t = setup();
    const day = store!.save({
      ...t.day,
      entries: [entry, { ...entry, id: "another" }],
    });
    const a = await t.service.prepare(date, entry.id, day.revision),
      b = await t.service.prepare(date, "another", day.revision);
    const outcomes = await Promise.allSettled([
      t.service.send(a.id),
      t.service.send(b.id),
    ]);
    expect(
      outcomes.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(t.posts()).toHaveLength(1);
  });
  it("keeps a definitive validation rejection editable and does not retry automatically", async () => {
    const t = setup();
    t.setPost(() => json({ errors: ["private remote details"] }, 422));
    const review = await t.service.prepare(date, entry.id, t.day.revision);
    const result = await t.service.send(review.id);
    expect(result).toMatchObject({ state: "rejected", remoteId: null });
    expect(result.message).not.toContain("private remote details");
    expect(t.posts()).toHaveLength(1);
    expect(
      store!.save({ ...t.day, entries: [{ ...entry, comment: "Fixed" }] })
        .revision,
    ).toBe(2);
  });
  it.each([500, 302, 200])(
    "treats HTTP %s after POST as uncertain and blocks editing and retry",
    async (status) => {
      const t = setup();
      t.setPost(() => json({}, status));
      const review = await t.service.prepare(date, entry.id, t.day.revision);
      expect(await t.service.send(review.id)).toMatchObject({
        state: "uncertain",
      });
      await expect(t.service.send(review.id)).rejects.toThrow();
      expect(() => store!.save({ ...t.day, entries: [] })).toThrow(/não pode/);
      expect(t.posts()).toHaveLength(1);
    },
  );
  it("retains a known remote ID when the accepted response cannot be matched", async () => {
    const t = setup();
    t.setPost(() => json({ time_entry: { id: 901 } }, 201));
    const review = await t.service.prepare(date, entry.id, t.day.revision);
    expect(await t.service.send(review.id)).toMatchObject({
      state: "uncertain",
      remoteId: 901,
    });
    expect(t.posts()).toHaveLength(1);
  });
  it("confirms an empty accepted response through a safe Location and readback", async () => {
    const t = setup();
    const review = await t.service.prepare(date, entry.id, t.day.revision),
      s = review.snapshot;
    t.setPost(() => {
      t.rows.push({
        id: 901,
        issue: { id: s.issueId },
        project: { id: s.projectId },
        user: { id: s.userId },
        activity: { id: s.activityId },
        spent_on: s.date,
        hours: 0.5,
        comments: s.comment,
      });
      return new Response(null, {
        status: 201,
        headers: {
          Location: "https://example.invalid/redmine/time_entries/901",
        },
      });
    });
    expect(await t.service.send(review.id)).toMatchObject({
      state: "confirmed",
      remoteId: 901,
    });
  });
  it("does not forward a key to a foreign Location or follow it", async () => {
    const t = setup();
    t.setPost(
      () =>
        new Response(null, {
          status: 201,
          headers: { Location: "https://elsewhere.invalid/time_entries/901" },
        }),
    );
    const review = await t.service.prepare(date, entry.id, t.day.revision);
    expect(await t.service.send(review.id)).toMatchObject({
      state: "uncertain",
      remoteId: null,
    });
    expect(
      t.request.mock.calls.every(([url]) =>
        String(url).startsWith(config.baseUrl),
      ),
    ).toBe(true);
  });
  it("recovers a lost creation response after reopening the database using read-only reconciliation", async () => {
    folder = mkdtempSync(join(tmpdir(), "worklog-submission-"));
    const filename = join(folder, "worklog.sqlite");
    const t = setup(filename);
    const review = await t.service.prepare(date, entry.id, t.day.revision),
      s = review.snapshot;
    t.setPost(() => {
      t.rows.push({
        id: 901,
        issue: { id: s.issueId },
        project: { id: s.projectId },
        user: { id: s.userId },
        activity: { id: s.activityId },
        spent_on: s.date,
        hours: 0.5,
        comments: s.comment,
      });
      throw new Error("Connection lost after creation");
    });
    expect((await t.service.send(review.id)).state).toBe("uncertain");
    store!.close();
    store = openDraftStore(filename);
    expect(store.submission(review.id)?.state).toBe("uncertain");
    expect(
      await createSubmissionService(store, t.client).reconcile(review.id),
    ).toMatchObject({ state: "confirmed", remoteId: 901 });
    expect(t.posts()).toHaveLength(1);
  });
  it("never releases an unresolved send for automatic retry after a restart", async () => {
    const t = setup(),
      review = await t.service.prepare(date, entry.id, t.day.revision);
    store!.beginSubmission(review.id);
    expect((await t.service.reconcile(review.id)).state).toBe("sending");
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61000);
    expect((await t.service.reconcile(review.id)).state).toBe("uncertain");
    await expect(t.service.send(review.id)).rejects.toThrow();
    expect(t.posts()).toHaveLength(0);
  });
  it("allows edits to other rows while preserving a confirmed row exactly", async () => {
    const t = setup(),
      review = await t.service.prepare(date, entry.id, t.day.revision);
    await t.service.send(review.id);
    const saved = store!.save({
      ...t.day,
      entries: [entry, { ...entry, id: "next", minutes: 60 }],
    });
    expect(saved.revision).toBe(2);
    expect(() =>
      store!.saveMany([
        { date: "2026-10-23", revision: 0, entries: [] },
        { ...saved, entries: [{ ...entry, minutes: 60 }] },
      ]),
    ).toThrow();
    expect(store!.read("2026-10-23").revision).toBe(0);
  });
  it("expires an old review before making a remote creation", async () => {
    const t = setup(),
      review = await t.service.prepare(date, entry.id, t.day.revision);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 16 * 60 * 1000);
    await expect(t.service.send(review.id)).rejects.toThrow(/expirou/);
    expect(t.posts()).toHaveLength(0);
  });
});
describe("matching persisted remote results", () => {
  it("requires identity, date, activity, user, comment and minutes, with normal server rounding", () => {
    const s = {
      issueId: 1,
      projectId: 10,
      userId: 7,
      activityId: 101,
      date,
      minutes: 1,
      comment: "Synthetic",
    } as SubmissionSnapshot;
    const remote = {
      id: 9,
      issue: { id: 1 },
      project: { id: 10 },
      user: { id: 7 },
      activity: { id: 101 },
      spent_on: date,
      hours: 0.02,
      comments: s.comment,
    };
    expect(matchesTimeEntry(remote, s)).toBe(true);
    for (const changed of [
      { ...remote, user: { id: 8 } },
      { ...remote, activity: { id: 202 } },
      { ...remote, hours: null },
      { ...remote, comments: "Different" },
    ])
      expect(matchesTimeEntry(changed, s)).toBe(false);
  });
});
describe("local submission API", () => {
  async function start() {
    const t = setup();
    const app = createApp(store!, t.client);
    app.use(handleErrors);
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    return {
      ...t,
      base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    };
  }
  it("requires explicit confirmation and rejects foreign-origin writes", async () => {
    const t = await start();
    const response = await fetch(t.base + "/api/submissions/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        entryId: entry.id,
        revision: t.day.revision,
      }),
    });
    const review = await response.json();
    expect(response.status).toBe(200);
    expect(
      (
        await fetch(`${t.base}/api/submissions/${review.id}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(`${t.base}/api/submissions/${review.id}/confirm`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://example.invalid",
          },
          body: '{"confirmed":true}',
        })
      ).status,
    ).toBe(403);
    expect(t.posts()).toHaveLength(0);
    const sent = await fetch(`${t.base}/api/submissions/${review.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"confirmed":true}',
    });
    expect((await sent.json()).state).toBe("confirmed");
    const records = await fetch(
      `${t.base}/api/submissions?from=${date}&to=${date}`,
    );
    expect(records.headers.get("cache-control")).toBe("no-store");
    expect((await records.json()).submissions[0].remoteId).toBe(900);
  });
});
