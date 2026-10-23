import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDraftStore } from "./storage";
import { createRedmineClient } from "./redmine";
import { createSubmissionService } from "./submissions";
import { createBatchService } from "./batches";
import {
  daySummary,
  toDraftDay,
  toEditor,
  type EditorDay,
} from "../client/editor";
import { instantiateDayTemplate } from "../shared/day-template";
import { parseDuration } from "../shared/worklogs";

const editorDay = (
  date: string,
  issue: string,
  duration: string,
): EditorDay => ({
  date,
  revision: 0,
  entries: [
    {
      id: `row-${date}`,
      issue,
      duration,
      activity: "Revisão",
      comment: "Synthetic work",
    },
  ],
});
let store: ReturnType<typeof openDraftStore> | undefined;
let folder: string | undefined;
afterEach(() => {
  store?.close();
  store = undefined;
  if (folder) rmSync(folder, { recursive: true, force: true });
  folder = undefined;
});
function setup() {
  store = openDraftStore(":memory:");
  store.saveActivities({
    revision: 0,
    activities: [
      { projectId: 10, activityId: 101, name: "Revisão" },
      { projectId: 20, activityId: 202, name: "Revisão" },
    ],
  });
  const posts: any[] = [],
    rows: any[] = [];
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    });
  const request: typeof fetch = async (input, options) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("users/current.json"))
      return json({ user: { id: 7 } });
    const issue = Number(url.pathname.match(/issues\/(\d+)\.json$/)?.[1]);
    if (issue)
      return json({
        issue: {
          id: issue,
          subject: "Synthetic task",
          project: { id: issue === 1001 ? 10 : 20, name: "Example" },
          status: { id: 1, name: "Open" },
        },
      });
    const project = Number(url.pathname.match(/projects\/(\d+)\.json$/)?.[1]);
    if (project)
      return json({
        project: {
          id: project,
          time_entry_activities: [
            { id: project === 10 ? 101 : 202, name: "Revisão" },
          ],
        },
      });
    if (url.pathname.endsWith("time_entries.json")) {
      if (options?.method === "POST") {
        const payload = JSON.parse(String(options.body)).time_entry;
        posts.push(payload);
        const row = {
          id: 900 + rows.length,
          issue: { id: payload.issue_id },
          project: { id: payload.issue_id === 1001 ? 10 : 20 },
          user: { id: 7 },
          activity: { id: payload.activity_id },
          spent_on: payload.spent_on,
          hours: parseDuration(payload.hours)! / 60,
          comments: payload.comments,
        };
        rows.push(row);
        return json({ time_entry: row }, 201);
      }
      const matching = rows.filter(
        (row) => row.spent_on === url.searchParams.get("from"),
      );
      return json({ time_entries: matching, total_count: matching.length });
    }
    throw new Error("Unexpected simulated endpoint");
  };
  const client = createRedmineClient(
    { baseUrl: "https://example.invalid/", apiKey: "synthetic" },
    request,
  );
  const service = createBatchService(
    store,
    createSubmissionService(store, client),
  );
  return { service, posts };
}
describe("v0.2 filling and submission boundaries", () => {
  it("sends each project's activity ID and canonical hours from two compact drafts", async () => {
    const t = setup();
    const days = store!.saveMany([
      toDraftDay(editorDay("2026-10-22", "1001", "030")),
      toDraftDay(editorDay("2026-10-23", "1002", "130")),
    ]);
    const selection = days.map((day) => ({
      date: day.date,
      entryId: day.entries[0].id,
      revision: day.revision,
    }));
    const review = await t.service.prepare(selection);
    expect(t.posts).toHaveLength(0);
    const result = await t.service.start(review.id);
    expect(
      result.items.every((item) => item.record?.state === "confirmed"),
    ).toBe(true);
    expect(
      t.posts.map((payload) => [
        payload.activity_id,
        payload.hours,
        payload.spent_on,
      ]),
    ).toEqual([
      [101, "00:30", "2026-10-22"],
      [202, "01:30", "2026-10-23"],
    ]);
    expect(t.posts.every((payload) => !("status_id" in payload))).toBe(true);
  });
  it("blocks all selected dates if a caller bypasses the selector with an unmapped label", async () => {
    const t = setup();
    const bad = editorDay("2026-10-23", "1002", "130");
    bad.entries[0].activity = "Unmapped label";
    const days = store!.saveMany([
      toDraftDay(editorDay("2026-10-22", "1001", "030")),
      toDraftDay(bad),
    ]);
    const review = await t.service.prepare(
      days.map((day) => ({
        date: day.date,
        entryId: day.entries[0].id,
        revision: day.revision,
      })),
    );
    expect(review.items[1].error).toContain("Cadastre esta atividade");
    expect(() => t.service.start(review.id)).toThrow();
    expect(t.posts).toHaveLength(0);
  });
  it("reopens a template and copied day without changing minutes or activity labels", () => {
    folder = mkdtempSync(join(tmpdir(), "worklog-filling-"));
    const filename = join(folder, "test.sqlite");
    store = openDraftStore(filename);
    const compact = editorDay("2026-10-22", "1001", "130");
    const template = store.saveDayTemplate({
      revision: 0,
      entries: toDraftDay(compact).entries,
    });
    const saved = store.save({
      date: "2026-10-23",
      revision: 0,
      entries: instantiateDayTemplate(template, () => "copy"),
    });
    store.close();
    store = openDraftStore(filename);
    expect(store.readDayTemplate().entries[0].minutes).toBe(90);
    expect(store.read("2026-10-23")).toEqual(saved);
    expect(daySummary(toEditor(saved))).toEqual({
      total: "01:30",
      invalid: false,
    });
  });
});
