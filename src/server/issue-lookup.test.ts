import { afterEach, describe, expect, it, vi } from "vitest";
import { createIssueLookup } from "./issue-lookup";
import { createRedmineClient } from "./redmine";

afterEach(() => vi.restoreAllMocks());
function setup() {
  const request = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const id = Number(new URL(String(input)).pathname.match(/issues\/(\d+)\.json$/)?.[1]);
    return new Response(JSON.stringify({issue: {id, subject: "Synthetic task", project: {id: 10, name: "Example"}, status: {id: 1, name: "Open"}}}), { headers: {"content-type": "application/json"} });
  });
  const client = createRedmineClient({baseUrl: "https://example.invalid/", apiKey: "synthetic"}, request);
  return { request, client, lookup: createIssueLookup(client) };
}
describe("temporary issue lookup cache", () => {
  it("shares a successful lookup across rows and simultaneous requests", async () => {
    const t = setup();
    const results = await Promise.all([t.lookup("1001"), t.lookup("1001"), t.lookup("1002")]);
    expect(results.map((issue) => issue.id)).toEqual([1001, 1001, 1002]);
    await t.lookup("1001");
    expect(t.request).toHaveBeenCalledTimes(2);
  });
  it("expires after ten minutes and supports explicit refresh", async () => {
    const t = setup();
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    await t.lookup("1001");
    vi.mocked(Date.now).mockReturnValue(now + 10 * 60 * 1000);
    await t.lookup("1001");
    await t.lookup("1001", true);
    expect(t.request).toHaveBeenCalledTimes(3);
  });
  it.each([404, 403, 500])("does not retain failures (%i)", async (status) => {
    const t = setup();
    t.request.mockResolvedValueOnce(new Response("{}", {status, headers: {"content-type": "application/json"}}));
    await expect(t.lookup("1001")).rejects.toBeDefined();
    expect((await t.lookup("1001")).id).toBe(1001);
    expect(t.request).toHaveBeenCalledTimes(2);
  });
  it("keeps separate configured clients isolated", async () => {
    const t = setup();
    await t.lookup("1001");
    await createIssueLookup(t.client)("1001");
    expect(t.request).toHaveBeenCalledTimes(2);
  });
  it("limits memory to 500 recent tasks", async () => {
    const t = setup();
    for (let id = 1; id <= 501; id++) await t.lookup(String(id));
    await t.lookup("501");
    expect(t.request).toHaveBeenCalledTimes(501);
    await t.lookup("1");
    expect(t.request).toHaveBeenCalledTimes(502);
  });
  it("rejects malformed codes without contacting Redmine", async () => {
    const t = setup();
    for (const code of ["", "0", "01", "abc", "1/2", "9007199254740992"])
      await expect(t.lookup(code)).rejects.toMatchObject({code: "invalid_issue"});
    expect(t.request).not.toHaveBeenCalled();
  });
});
