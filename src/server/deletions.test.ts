import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { openDraftStore } from "./storage";
import { createRedmineClient } from "./redmine";
import { createSubmissionService } from "./submissions";
import { createDeletionService } from "./deletions";
import { createApp, handleErrors } from "./app";
import { submissionFingerprint } from "./submission-identity";

const date = "2026-11-23";
const entry = { id: "synthetic-row", issue: "9001", minutes: 90, activity: "Development", comment: "Synthetic work" };
const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => { vi.restoreAllMocks(); for (const action of cleanup.splice(0).reverse()) await action(); });
async function setup(existing = false) {
  const folder = mkdtempSync(join(tmpdir(), "worklog-deletion-"));
  cleanup.push(() => rmSync(folder, { recursive: true, force: true }));
  const filename = join(folder, "synthetic.sqlite");
  const store = openDraftStore(filename);
  cleanup.push(() => store.close());
  let userId = 7, deleted = false, status = 204;
  let inspect: "matched" | "different" | "missing" | "unavailable" = "matched";
  let deletion: (() => Promise<Response>) | undefined;
  const remote = { id: 555, issue: { id: 9001 }, project: { id: 10 }, user: { id: 7 },
    activity: { id: 101 }, spent_on: date, hours: 1.5, comments: entry.comment };
  const request = vi.fn<typeof fetch>().mockImplementation(async (input, options) => {
    const path = new URL(String(input)).pathname;
    if (options?.method === "DELETE") {
      expect(path).toBe("/redmine/time_entries/555.json");
      if (deletion) return deletion();
      if (status === 204) { deleted = true; return new Response(null, { status }); }
      return Response.json({ error: "private response must not escape" }, { status });
    }
    if (path.endsWith("users/current.json")) return Response.json({ user: { id: userId } });
    if (path.endsWith("issues/9001.json")) return Response.json({ issue: { id: 9001, subject: "Synthetic issue",
      project: { id: 10, name: "Synthetic project" }, status: { id: 2, name: "In progress" } } });
    if (path.endsWith("projects/10.json")) return Response.json({ project: { id: 10 } });
    if (path.endsWith("time_entries.json")) {
      if (options?.method === "POST") return Response.json({ time_entry: remote }, { status: 201 });
      return Response.json({ time_entries: existing ? [remote] : [], total_count: existing ? 1 : 0 });
    }
    if (path.endsWith("time_entries/555.json")) {
      if (inspect === "unavailable") throw new Error("synthetic offline");
      if (deleted || inspect === "missing") return Response.json({}, { status: 404 });
      return Response.json({ time_entry: { ...remote, ...(inspect === "different" ? { hours: 8 } : {}) } });
    }
    throw new Error("Unexpected synthetic URL");
  });
  const config = { baseUrl: "https://example.invalid/redmine/", apiKey: "synthetic-key" };
  const client = createRedmineClient(config, request);
  store.saveActivities({ revision: 0, activities: [{ name: "Development", activityId: 101 }] });
  const day = store.save({ date, revision: 0, entries: [entry, { ...entry, id: "other-row", issue: "9004" }] });
  const submissions = createSubmissionService(store, client);
  const review = await submissions.prepare(date, entry.id, day.revision);
  const record = review.state === "existing" ? review : await submissions.send(review.id);
  expect(record.state).toBe(existing ? "existing" : "confirmed");
  request.mockClear();
  return { store, filename, client, request, record, day, service: createDeletionService(store, client),
    setUser: (value: number) => { userId = value; },
    setInspect: (value: typeof inspect) => { inspect = value; },
    setStatus: (value: number) => { status = value; },
    setDeletion: (value: () => Promise<Response>) => { deletion = value; },
    deletes: () => request.mock.calls.filter(([, options]) => options?.method === "DELETE"),
  };
}

describe("explicit time-entry deletion", () => {
  it("removes a uniquely linked existing receipt despite later catalog changes", async () => {
    const t = await setup(true);
    t.store.saveActivities({ revision: 1, activities: [] });
    expect((await t.service.remove(t.record.id, t.day.revision)).state).toBe("deleted");
    expect(t.deletes()).toHaveLength(1);
    expect(t.store.submission(t.record.id)?.snapshot.activityId).toBe(101);
  });
  it("deletes only the trusted remote ID, removes one row and preserves an audited tombstone", async () => {
    const t = await setup();
    const result = await t.service.remove(t.record.id, t.day.revision);
    expect(result.state).toBe("deleted");
    expect(result.remoteId).toBe(555);
    expect(result.snapshot).toEqual(t.record.snapshot);
    expect(result.confirmedAt).toBe(t.record.confirmedAt);
    expect(result.deletion?.events.map((event) => event.state)).toEqual(["deleting", "remote_deleted", "deleted"]);
    expect(t.store.read(date)).toEqual({ ...t.day, revision: 2, entries: [t.day.entries[1]] });
    expect(t.deletes()).toHaveLength(1);
    expect(t.deletes()[0][1]).toMatchObject({ redirect: "manual", headers: { "X-Redmine-API-Key": "synthetic-key" } });
    expect(await t.service.remove(t.record.id, 1)).toEqual(result);
    expect(t.deletes()).toHaveLength(1);
    expect(() => t.store.save(t.day)).toThrow();
    expect(() => t.store.save({ ...t.day, revision: 2 })).toThrow(/excluída/);
    expect(t.store.save({ ...t.store.read(date), entries: [] }).revision).toBe(3);
    const replacement = t.store.save({ date, revision: 3, entries: [{ ...entry, id: "deliberate-new-row" }] });
    const snapshot = { ...t.record.snapshot, entryId: "deliberate-new-row", dayRevision: replacement.revision };
    const fresh = t.store.putReview({ ...t.record, id: "new-review", state: "prepared", remoteId: null, snapshot }, submissionFingerprint(snapshot));
    expect(t.store.beginSubmission(fresh.id).state).toBe("sending");
  });
  it.each(["different", "missing", "unavailable"] as const)("keeps the row protected when preflight is %s", async (check) => {
    const t = await setup(); t.setInspect(check);
    await expect(t.service.remove(t.record.id, 1)).rejects.toThrow();
    expect(t.deletes()).toHaveLength(0);
    expect(t.store.read(date)).toEqual(t.day);
    expect(t.store.submission(t.record.id)?.deletion?.state).toBe("rejected");
    expect(() => t.store.save({ ...t.day, entries: [] })).toThrow();
  });
  it("refuses a changed account or instance, stale revision and untrusted ID", async () => {
    const t = await setup(); t.setUser(8);
    await expect(t.service.remove(t.record.id, 1)).rejects.toThrow(/conta ou instância/);
    t.setUser(7);
    const otherInstance = createDeletionService(t.store, createRedmineClient({ baseUrl: "https://other.invalid/redmine/", apiKey: "synthetic" }, t.request));
    await expect(otherInstance.remove(t.record.id, 1)).rejects.toThrow(/conta ou instância/);
    await expect(t.service.remove(t.record.id, 9)).rejects.toThrow(/dia mudou/);
    t.store.save({ ...t.day, entries: [...t.day.entries, { ...entry, id: "ambiguous" }] });
    const ambiguous = t.store.putReview({ ...t.record, id: "ambiguous-receipt", state: "existing", remoteId: null,
      snapshot: { ...t.record.snapshot, entryId: "ambiguous", dayRevision: 2 } }, "synthetic-other-fingerprint");
    await expect(t.service.remove(ambiguous.id, 2)).rejects.toThrow(/conferência/);
    expect(t.deletes()).toHaveLength(0);
  });
  it.each([400, 401, 403, 405, 422, 200, 201, 202, 302, 404, 500])("handles DELETE HTTP %s without removing locally", async (status) => {
    const t = await setup(); t.setStatus(status);
    const result = await t.service.remove(t.record.id, 1);
    expect(result.deletion?.state).toBe([400, 401, 403, 405, 422].includes(status) ? "rejected" : "uncertain");
    expect(result.message).not.toContain("private response");
    expect(t.store.read(date)).toEqual(t.day);
    expect(t.deletes()).toHaveLength(1);
  });
  it("never repeats a lost DELETE and does not treat a later 404 as proof of deletion", async () => {
    const t = await setup();
    t.setDeletion(async () => { throw new Error("synthetic lost response"); });
    await t.service.remove(t.record.id, 1);
    t.setInspect("missing");
    expect((await t.service.recover(t.record.id)).deletion?.state).toBe("uncertain");
    await expect(t.service.remove(t.record.id, 1)).rejects.toThrow(/conferência/);
    expect(t.deletes()).toHaveLength(1);
    expect(t.store.read(date)).toEqual(t.day);
    t.setInspect("matched");
    expect((await t.service.recover(t.record.id)).deletion?.state).toBe("rejected");
    expect(t.deletes()).toHaveLength(1);
    t.setDeletion(async () => new Response(null, { status: 204 }));
    expect((await t.service.remove(t.record.id, 1)).state).toBe("deleted");
    expect(t.deletes()).toHaveLength(2);
  });
  it("serializes double clicks and other service instances before any remote write", async () => {
    const t = await setup();
    let release!: (value: Response) => void;
    t.setDeletion(() => new Promise((resolve) => { release = resolve; }));
    const first = t.service.remove(t.record.id, 1);
    await vi.waitFor(() => expect(t.deletes()).toHaveLength(1));
    await expect(t.service.remove(t.record.id, 1)).rejects.toThrow(/conferência/);
    await expect(createDeletionService(t.store, t.client).remove(t.record.id, 1)).rejects.toThrow(/conferência/);
    await expect(t.service.recover(t.record.id)).rejects.toThrow(/Aguarde/);
    t.store.save({ ...t.day, entries: [...t.day.entries, { ...entry, id: "new-link" }] });
    expect(() => t.store.putReview({ ...t.record, id: "new-link-receipt", state: "existing",
      snapshot: { ...t.record.snapshot, entryId: "new-link", dayRevision: 2 } }, "synthetic-new-link")).toThrow(/exclusão iniciada/);
    release(new Response(null, { status: 204 }));
    expect((await first).state).toBe("deleted");
    expect(t.deletes()).toHaveLength(1);
  });
  it("recovers an acknowledged remote deletion after local transaction failure and restart", async () => {
    const t = await setup();
    const faults = new DatabaseSync(t.filename);
    cleanup.push(() => faults.close());
    faults.exec(`CREATE TRIGGER fail_local_delete BEFORE UPDATE ON submission_records
      WHEN NEW.state = 'deleted' BEGIN SELECT RAISE(ABORT, 'synthetic local failure'); END;`);
    await expect(t.service.remove(t.record.id, 1)).rejects.toThrow();
    expect(t.store.read(date)).toEqual(t.day);
    expect(t.store.submission(t.record.id)?.deletion?.state).toBe("remote_deleted");
    faults.exec("DROP TRIGGER fail_local_delete");
    const reopened = openDraftStore(t.filename);
    cleanup.push(() => reopened.close());
    const recovered = await createDeletionService(reopened, t.client).recover(t.record.id);
    expect(recovered.state).toBe("deleted");
    expect(reopened.read(date).entries.map((entry) => entry.id)).toEqual(["other-row"]);
    expect(t.deletes()).toHaveLength(1);
  });
  it("preserves edits to other rows saved while the remote deletion is in flight", async () => {
    const t = await setup();
    let release!: (response: Response) => void;
    t.setDeletion(() => new Promise((resolve) => { release = resolve; }));
    const deletion = t.service.remove(t.record.id, 1);
    await vi.waitFor(() => expect(t.deletes()).toHaveLength(1));
    const other = { ...t.day.entries[1], comment: "Changed while waiting" };
    t.store.save({ ...t.day, entries: [entry, other] });
    release(new Response(null, { status: 204 }));
    await deletion;
    expect(t.store.read(date)).toEqual({ date, revision: 3, entries: [other] });
  });
  it("does not let an older recovery overwrite a newly started deletion", async () => {
    const t = await setup(); t.setStatus(403);
    await t.service.remove(t.record.id, 1);
    let read!: (value: { result: "matched"; createdAt: null }) => void;
    vi.spyOn(t.client, "inspectTimeEntry").mockImplementationOnce(() => new Promise((resolve) => { read = resolve; }));
    const recovering = t.service.recover(t.record.id);
    await vi.waitFor(() => expect(read).toBeTypeOf("function"));
    let release!: (response: Response) => void;
    t.setDeletion(() => new Promise((resolve) => { release = resolve; }));
    const deleting = t.service.remove(t.record.id, 1);
    await vi.waitFor(() => expect(t.deletes()).toHaveLength(2));
    read({ result: "matched", createdAt: null });
    await expect(recovering).rejects.toThrow(/mudou durante/);
    expect(t.store.submission(t.record.id)?.deletion?.state).toBe("deleting");
    release(new Response(null, { status: 204 }));
    expect((await deleting).state).toBe("deleted");
  });
  it("keeps an interrupted deletion locked and only offers an explicit retry after a matching read", async () => {
    const t = await setup();
    t.store.beginDeletion(t.record.id, 1);
    await expect(t.service.recover(t.record.id)).rejects.toThrow(/Aguarde/);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61000);
    expect((await createDeletionService(t.store, t.client).recover(t.record.id)).deletion?.state).toBe("rejected");
    expect(t.deletes()).toHaveLength(0);
    expect(t.store.read(date)).toEqual(t.day);
  });
  it("refuses multiple local links to one remote entry", async () => {
    const t = await setup();
    t.store.save({ ...t.day, entries: [...t.day.entries, { ...entry, id: "linked-row" }] });
    t.store.putReview({ ...t.record, id: "linked-receipt", state: "existing",
      snapshot: { ...t.record.snapshot, entryId: "linked-row", dayRevision: 2 } }, "synthetic-linked");
    await expect(t.service.remove(t.record.id, 2)).rejects.toThrow(/mais de uma linha/);
    expect(t.deletes()).toHaveLength(0);
    expect(t.store.read(date).entries).toHaveLength(3);
  });
  it("requires explicit HTTP confirmation and the saved revision", async () => {
    const t = await setup();
    const app = createApp(t.store, t.client); app.use(handleErrors);
    const server = await new Promise<Server>((resolve) => { const value = app.listen(0, "127.0.0.1", () => resolve(value)); });
    cleanup.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/submissions/${t.record.id}/delete`;
    for (const body of [{}, { confirmed: false, revision: 1 }, { confirmed: true }]) {
      expect((await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).status).toBe(400);
    }
    expect(t.deletes()).toHaveLength(0);
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true, revision: 1 }) });
    expect(response.status).toBe(200);
    expect((await response.json()).state).toBe("deleted");
    expect(t.deletes()).toHaveLength(1);
  });
});
