import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDraftStore } from "./storage";
import { createRedmineClient } from "./redmine";
import { createSubmissionService } from "./submissions";
import { createConfirmedImportService } from "./confirmed-import";
import { submissionFingerprint } from "./submission-identity";
import { createApp, handleErrors } from "./app";
import {
  acceptReceipt,
  appropriationSummary,
  isAppropriated,
  normalizeReceipt,
  receiptTimestamp,
  type SubmissionRecord,
} from "../shared/submissions";

const config = {
  baseUrl: "https://example.invalid/redmine/",
  apiKey: "synthetic-key",
};
const scope = createHash("sha256")
  .update(JSON.stringify([config.baseUrl, 7]))
  .digest("hex");
const confirmedTime = "2026-10-22T10:30:01.000Z";
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
const receipt = (id = 900, date = "2026-10-12"): SubmissionRecord => ({
  id: `receipt-${id}`,
  state: "confirmed",
  remoteId: id,
  preparedAt: "2026-10-22T10:29:00.000Z",
  updatedAt: confirmedTime,
  message: "Synthetic confirmed result",
  snapshot: {
    date,
    entryId: `entry-${id}`,
    dayRevision: 1,
    catalogRevision: 1,
    issueId: 1001,
    projectId: 10,
    userId: 7,
    scope,
    activityId: 101,
    activityName: "Review",
    activityVerified: false,
    minutes: 30,
    comment: `Synthetic work ${id}`,
    subject: "Synthetic task",
    projectName: "Example project",
    statusName: "In progress",
  },
});
const entryOf = (r: SubmissionRecord) => ({
  id: r.snapshot.entryId,
  issue: String(r.snapshot.issueId),
  minutes: r.snapshot.minutes,
  activity: r.snapshot.activityName,
  comment: r.snapshot.comment,
});
let store: ReturnType<typeof openDraftStore> | undefined;
let folder: string | undefined;
let server: Server | undefined;
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (server)
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
  store?.close();
  store = undefined;
  if (folder) rmSync(folder, { recursive: true, force: true });
  folder = undefined;
});
function setup(records = [receipt()], filename = ":memory:") {
  store = openDraftStore(filename);
  const rows = new Map(
    records.map((r) => [
      r.remoteId!,
      {
        id: r.remoteId!,
        issue: { id: r.snapshot.issueId },
        project: { id: r.snapshot.projectId },
        user: { id: r.snapshot.userId },
        activity: { id: r.snapshot.activityId },
        spent_on: r.snapshot.date,
        hours: r.snapshot.minutes / 60,
        comments: r.snapshot.comment,
        created_on: "2026-10-22T10:30:00Z",
      },
    ]),
  );
  const failures = new Map<number, number>();
  let userId = 7;
  const request = vi
    .fn<typeof fetch>()
    .mockImplementation(async (input, options) => {
      const url = new URL(String(input));
      if (options?.method !== "GET")
        throw new Error("Read-only fixture forbids remote writes.");
      if (url.pathname.endsWith("users/current.json"))
        return json({ user: { id: userId } });
      const id = Number(url.pathname.match(/time_entries\/(\d+)\.json$/)?.[1]);
      if (id)
        return failures.has(id)
          ? json({}, failures.get(id))
          : rows.has(id)
            ? json({ time_entry: rows.get(id) })
            : json({}, 404);
      throw new Error("Unexpected synthetic read");
    });
  const client = createRedmineClient(config, request);
  return {
    client,
    rows,
    request,
    failures,
    setUser: (id: number) => {
      userId = id;
    },
    importer: createConfirmedImportService(store, client),
    service: createSubmissionService(store, client),
  };
}
describe("receipt dates and read-only verification", () => {
  it("keeps the first terminal update of legacy confirmations without inventing an existing entry's creation date", () => {
    expect(normalizeReceipt(receipt()).confirmedAt).toBe(confirmedTime);
    const existing = normalizeReceipt({ ...receipt(), state: "existing" });
    expect(existing.confirmedAt).toBeNull();
    expect(existing.lastCheckedAt).toBe(confirmedTime);
    expect(
      normalizeReceipt({ ...receipt(), confirmedAt: null }).confirmedAt,
    ).toBeNull();
    expect(receiptTimestamp("2026-02-30T10:00:00Z")).toBeNull();
    expect(receiptTimestamp("not-a-date")).toBeNull();
    expect(receiptTimestamp("2026-10-22")).toBeNull();
  });
  it("preserves original confirmation and creation dates when later checks update the receipt", async () => {
    const t = setup();
    const imported = await t.importer.import([receipt()]);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-24T12:00:00Z"));
    const checked = await t.service.verify(imported.records[0].id);
    expect(checked).toMatchObject({
      state: "confirmed",
      confirmedAt: confirmedTime,
      remoteCreatedAt: "2026-10-22T10:30:00.000Z",
      lastCheckedAt: "2026-10-24T12:00:00.000Z",
      verification: "matched",
      origin: "imported",
    });
    expect(
      t.request.mock.calls.every(([, options]) => options?.method === "GET"),
    ).toBe(true);
  });
  it("warns on missing or hidden remote data while retaining the confirmation and resend lock", async () => {
    const t = setup();
    const imported = await t.importer.import([receipt()]);
    t.rows.clear();
    const checked = await t.service.verify(imported.records[0].id);
    expect(checked).toMatchObject({
      state: "confirmed",
      verification: "missing",
      confirmedAt: confirmedTime,
      remoteId: 900,
    });
    expect(isAppropriated(checked)).toBe(false);
    expect(() => store!.beginSubmission(checked.id)).toThrow();
    expect(() =>
      store!.save({ ...store!.read(checked.snapshot.date), entries: [] }),
    ).toThrow();
  });
  it("distinguishes divergent and unavailable checks, and restores the green status after a matching read", async () => {
    const t = setup();
    const imported = await t.importer.import([receipt()]);
    const id = imported.records[0].id;
    const row = t.rows.get(900)!;
    const original = row.comments;
    row.comments = "Changed remotely";
    expect((await t.service.verify(id)).verification).toBe("different");
    t.failures.set(900, 503);
    expect((await t.service.verify(id)).verification).toBe("unavailable");
    t.failures.clear();
    row.comments = original;
    const checked = await t.service.verify(id);
    expect(isAppropriated(checked)).toBe(true);
    expect(checked.confirmedAt).toBe(confirmedTime);
  });
  it("requires the original account and installation before checking a receipt", async () => {
    const t = setup();
    await t.importer.import([receipt()]);
    t.setUser(8);
    await expect(t.service.verify("receipt-900")).rejects.toThrow(/conta/);
    expect(store!.submission("receipt-900")?.verification).toBe("matched");
  });
  it("does not trust an invalid remote creation date", async () => {
    const t = setup();
    t.rows.get(900)!.created_on = "invalid";
    const result = await t.importer.import([receipt()]);
    expect(result.records[0].remoteCreatedAt).toBeNull();
    expect(result.records[0].confirmedAt).toBe(confirmedTime);
  });
  it("supports verification through the local API with origin checks and no remote POST", async () => {
    const t = setup();
    await t.importer.import([receipt()]);
    const app = createApp(store!, t.client);
    app.use(handleErrors);
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    expect(
      (
        await fetch(base + "/api/submissions/receipt-900/verify", {
          method: "POST",
          headers: { Origin: "https://example.invalid" },
        })
      ).status,
    ).toBe(403);
    const response = await fetch(base + "/api/submissions/receipt-900/verify", {
      method: "POST",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).verification).toBe("matched");
    expect(
      t.request.mock.calls.every(([, options]) => options?.method === "GET"),
    ).toBe(true);
  });
});
describe("confirmed history import", () => {
  it("imports three days with nine receipts while preserving unrelated local rows and an empty catalog", async () => {
    const records = ["2026-10-12", "2026-10-13", "2026-10-14"].flatMap(
      (date, day) => [0, 1, 2].map((i) => receipt(900 + day * 3 + i, date)),
    );
    const t = setup(records);
    const extras = [
      {
        ...entryOf(receipt()),
        id: "local-a",
        issue: "2001",
        comment: "Unrelated draft A",
      },
      {
        ...entryOf(receipt()),
        id: "local-b",
        issue: "2002",
        comment: "Unrelated draft B",
      },
    ];
    store!.save({ date: "2026-10-14", revision: 0, entries: extras });
    const result = await t.importer.import(records, "synthetic-history");
    expect(result).toMatchObject({
      addedRows: 9,
      linkedRows: 0,
      alreadyPresent: 0,
    });
    expect(result.records).toHaveLength(9);
    const last = store!.read("2026-10-14");
    expect(last.entries.slice(0, 2)).toEqual(extras);
    expect(last.entries).toHaveLength(5);
    expect(store!.submissions("2026-10-12", "2026-10-14")).toHaveLength(9);
    expect(store!.readActivities().activities).toEqual([]);
    expect(
      result.records.every(
        (r) =>
          r.origin === "imported" &&
          r.confirmedAt === confirmedTime &&
          r.verification === "matched",
      ),
    ).toBe(true);
    expect(() =>
      store!.save({ ...last, entries: last.entries.slice(0, 2) }),
    ).toThrow();
  });
  it("associates a unique matching draft and replaces an unused review without duplicating the row", async () => {
    const r = receipt(),
      t = setup();
    const day = store!.save({
      date: r.snapshot.date,
      revision: 0,
      entries: [{ ...entryOf(r), id: "local-row" }],
    });
    const prepared: SubmissionRecord = {
      ...r,
      id: "local-review",
      state: "prepared",
      remoteId: null,
      snapshot: {
        ...r.snapshot,
        entryId: "local-row",
        dayRevision: day.revision,
        catalogRevision: 0,
      },
    };
    store!.putReview(prepared, submissionFingerprint(prepared.snapshot));
    const result = await t.importer.import([r]);
    expect(result).toMatchObject({ addedRows: 0, linkedRows: 1 });
    expect(result.records[0]).toMatchObject({
      id: "local-review",
      origin: "imported",
      sourceSubmissionId: "receipt-900",
      snapshot: { entryId: "local-row" },
    });
    expect(store!.read(day.date).revision).toBe(day.revision);
  });
  it("is repeatable after reopening without adding rows, changing IDs or replacing original dates", async () => {
    folder = mkdtempSync(join(tmpdir(), "worklog-receipt-import-"));
    const filename = join(folder, "test.sqlite"),
      t = setup([receipt()], filename);
    const first = await t.importer.import([receipt()]);
    const revision = store!.read(receipt().snapshot.date).revision;
    store!.close();
    store = openDraftStore(filename);
    const repeated = await createConfirmedImportService(store, t.client).import(
      [receipt()],
    );
    expect(repeated).toMatchObject({
      addedRows: 0,
      linkedRows: 0,
      alreadyPresent: 1,
    });
    expect(repeated.records[0].id).toBe(first.records[0].id);
    expect(repeated.records[0].confirmedAt).toBe(confirmedTime);
    expect(store.read(receipt().snapshot.date).revision).toBe(revision);
    expect(
      store.submissions(receipt().snapshot.date, receipt().snapshot.date),
    ).toHaveLength(1);
  });
  it("rejects ambiguous matching drafts without saving other imported days", async () => {
    const first = receipt(),
      second = receipt(901, "2026-10-13"),
      t = setup([first, second]);
    const entry = entryOf(second);
    store!.save({
      date: second.snapshot.date,
      revision: 0,
      entries: [entry, { ...entry, id: "duplicate" }],
    });
    await expect(t.importer.import([first, second])).rejects.toThrow(/ambígua/);
    expect(store!.read(first.snapshot.date).revision).toBe(0);
    expect(
      store!.submissions(first.snapshot.date, second.snapshot.date),
    ).toHaveLength(0);
  });
  it("rolls back row writes if a receipt conflicts during the same transaction", async () => {
    const first = receipt(),
      second = { ...receipt(901, "2026-10-13"), id: first.id },
      t = setup([first, second]);
    await t.importer.import([first]);
    await expect(t.importer.import([second])).rejects.toThrow(/conflito/);
    expect(store!.read(second.snapshot.date).entries).toEqual([]);
    expect(store!.submission(first.id)?.remoteId).toBe(900);
  });
  it("verifies every ID before saving any row and rejects foreign scope or repeated receipts", async () => {
    const a = receipt(),
      b = receipt(901, "2026-10-13"),
      t = setup([a, b]);
    t.rows.delete(901);
    await expect(t.importer.import([a, b])).rejects.toThrow(/remoto/);
    expect(store!.read(a.snapshot.date).entries).toEqual([]);
    await expect(
      t.importer.import([
        { ...a, snapshot: { ...a.snapshot, scope: "another-installation" } },
      ]),
    ).rejects.toThrow(/conta/);
    await expect(t.importer.import([a, a])).rejects.toThrow(/mesmo recibo/);
    expect(store!.submissions(a.snapshot.date, b.snapshot.date)).toEqual([]);
  });
  it("creates a consistent SQLite backup before adding confirmed history", async () => {
    folder = mkdtempSync(join(tmpdir(), "worklog-receipt-backup-"));
    const t = setup([receipt()], join(folder, "live.sqlite"));
    const extra = {
      ...entryOf(receipt()),
      id: "saved-before",
      comment: "Saved before import",
    };
    store!.save({
      date: receipt().snapshot.date,
      revision: 0,
      entries: [extra],
    });
    const backupPath = join(folder, "before.sqlite");
    await store!.backupTo(backupPath);
    await t.importer.import([receipt()]);
    const restored = openDraftStore(backupPath);
    try {
      expect(restored.read(receipt().snapshot.date).entries).toEqual([extra]);
      expect(
        restored.submissions(receipt().snapshot.date, receipt().snapshot.date),
      ).toHaveLength(0);
    } finally {
      restored.close();
    }
  });
});
describe("appropriation presentation", () => {
  it("counts complete, partial and uncertain days without treating the issue number as the identity", () => {
    const a = receipt(),
      b = receipt(901),
      c = { ...receipt(902), state: "uncertain" as const },
      ids = [a, b, c].map((r) => r.snapshot.entryId);
    expect(appropriationSummary(ids, [a, b, undefined])).toMatchObject({
      confirmed: 2,
      pending: 1,
      checking: 0,
      complete: false,
    });
    expect(appropriationSummary(ids, [a, b, c])).toMatchObject({
      confirmed: 2,
      pending: 0,
      checking: 1,
    });
    expect(appropriationSummary(ids, [a, b, receipt(902)]).label).toBe(
      "3 de 3 apropriadas",
    );
    expect(appropriationSummary([], []).label).toBe("Nenhum lançamento");
    expect(
      appropriationSummary(
        [a.snapshot.entryId],
        [{ ...a, verification: "different" }],
      ).checking,
    ).toBe(1);
  });
  it("accepts newer verification metadata but ignores stale results that would undo a confirmation", () => {
    const a = receipt(),
      later = {
        ...a,
        updatedAt: "2026-10-24T12:00:00Z",
        verification: "missing" as const,
      };
    expect(acceptReceipt(a, later)).toBe(true);
    expect(acceptReceipt(later, a)).toBe(false);
    expect(acceptReceipt(a, { ...later, state: "sending" })).toBe(false);
  });
});
