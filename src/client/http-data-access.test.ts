import { afterEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import { createApp, handleErrors } from "../server/app";
import { openDraftStore } from "../server/storage";
import type { ActivityCatalog } from "../shared/activities";
import type { DraftDay } from "../shared/worklogs";
import { DataAccessError } from "./data-access";
import { createHttpDataAccess } from "./http-data-access";

const catalog: ActivityCatalog = {
  revision: 2,
  activities: [{ activityId: 901, name: "Synthetic review" }],
};
const days: DraftDay[] = [
  {
    date: "2026-10-26",
    revision: 3,
    entries: [
      { id: "synthetic-row", issue: "", minutes: 90, activity: "", comment: "" },
    ],
  },
];
const savedDays = () =>
  days.map((day) => ({ ...day, revision: day.revision + 1 }));
const response = (data: unknown, status = 200) => Response.json(data, { status });
const setup = (result: Response) => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(result);
  return { request, data: createHttpDataAccess(request) };
};
afterEach(() => vi.restoreAllMocks());

describe("local HTTP data access", () => {
  it("reads the single activity catalog and forwards cancellation", async () => {
    const { request, data } = setup(response(catalog));
    const controller = new AbortController();
    expect(await data.readActivities(controller.signal)).toEqual(catalog);
    expect(request).toHaveBeenCalledExactlyOnceWith("/api/activities", {
      signal: controller.signal,
    });
  });

  it("saves the catalog with its revision and confirms the returned content", async () => {
    const saved = { ...catalog, revision: 3 };
    const { request, data } = setup(response(saved));
    expect(await data.saveActivities(catalog)).toEqual(saved);
    expect(request).toHaveBeenCalledExactlyOnceWith("/api/activities", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(catalog),
    });
  });

  it("reads the period envelope and forwards cancellation", async () => {
    const { request, data } = setup(response({ days }));
    const controller = new AbortController();
    expect(
      await data.readDays("2026-10-26", "2026-10-28", controller.signal),
    ).toEqual(days);
    expect(request).toHaveBeenCalledExactlyOnceWith(
      "/api/days?from=2026-10-26&to=2026-10-28",
      { signal: controller.signal },
    );
  });

  it("saves incomplete drafts in the original envelope and confirms every revision", async () => {
    const saved = savedDays();
    const { request, data } = setup(response({ days: saved }));
    expect(await data.saveDays(days)).toEqual(saved);
    expect(request).toHaveBeenCalledExactlyOnceWith("/api/days", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    });
    expect(days[0].revision).toBe(3);
  });

  it.each(["catalog", "days"])(
    "preserves 409 status, message and input without retrying a %s save",
    async (kind) => {
      const message = "Conflito fictício: preserve suas edições e recarregue.";
      const { request, data } = setup(response({ error: message }, 409));
      const before = structuredClone({ catalog, days });
      const saving = kind === "catalog"
        ? data.saveActivities(catalog)
        : data.saveDays(days);
      await expect(saving).rejects.toBeInstanceOf(DataAccessError);
      await expect(saving).rejects.toMatchObject({ message, status: 409 });
      expect({ catalog, days }).toEqual(before);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ["catalog read", "Não foi possível carregar o catálogo."],
    ["catalog save", "Não foi possível salvar o catálogo."],
    ["days read", "Não foi possível acessar os rascunhos."],
    ["days save", "Não foi possível acessar os rascunhos."],
  ])("keeps the original fallback for a failed %s", async (operation, message) => {
    const { data } = setup(response({}, 503));
    const operations = {
      "catalog read": () => data.readActivities(),
      "catalog save": () => data.saveActivities(catalog),
      "days read": () => data.readDays("2026-10-26", "2026-10-28"),
      "days save": () => data.saveDays(days),
    };
    await expect(
      operations[operation as keyof typeof operations](),
    ).rejects.toMatchObject({ message, status: 503 });
  });

  it.each(["catalog", "days"])(
    "propagates cancellation of a %s read without retrying",
    async (kind) => {
      const controller = new AbortController();
      const aborted = new DOMException("Synthetic cancellation", "AbortError");
      const request = vi.fn<typeof fetch>().mockImplementation((_url, options) =>
        new Promise((_resolve, reject) =>
          options?.signal?.addEventListener("abort", () => reject(aborted)),
        ),
      );
      const data = createHttpDataAccess(request);
      const reading = kind === "catalog"
        ? data.readActivities(controller.signal)
        : data.readDays("2026-10-26", "2026-10-28", controller.signal);
      controller.abort();
      await expect(reading).rejects.toBe(aborted);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it("propagates a lost save response without retrying or mutating drafts", async () => {
    const failure = new TypeError("Synthetic network failure");
    const request = vi.fn<typeof fetch>().mockRejectedValue(failure);
    const before = structuredClone(days);
    await expect(createHttpDataAccess(request).saveDays(days)).rejects.toBe(
      failure,
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(days).toEqual(before);
  });

  it.each([
    { ...catalog, revision: 2 },
    { ...catalog, revision: 4 },
    { revision: 3, activities: [] },
  ])("rejects an unconfirmed catalog save: %j", async (saved) => {
    const { data } = setup(response(saved));
    await expect(data.saveActivities(catalog)).rejects.toThrow(
      "Não foi possível confirmar o salvamento do catálogo.",
    );
  });

  it.each([
    { reason: "missing dates", saved: [] },
    { reason: "unchanged revision", saved: days },
    { reason: "skipped revision", saved: [{ ...days[0], revision: 5 }] },
    { reason: "wrong date", saved: [{ ...days[0], date: "2026-10-27", revision: 4 }] },
    { reason: "extra date", saved: [...savedDays(), { date: "2026-10-27", revision: 1, entries: [] }] },
  ])("rejects an invalid day-save acknowledgement: $reason", async ({ saved }) => {
    const { data } = setup(response({ days: saved }));
    await expect(data.saveDays(days)).rejects.toThrow(
      "Não foi possível confirmar o salvamento de todos os dias.",
    );
  });

  it("validates catalog and day response shapes", async () => {
    const legacyCatalog = {
      ...catalog,
      activities: [{ ...catalog.activities[0], projectId: 9 }],
    };
    await expect(
      setup(response(legacyCatalog)).data.readActivities(),
    ).rejects.toThrow("sem projeto");
    await expect(
      setup(response(days)).data.readDays("2026-10-26", "2026-10-28"),
    ).rejects.toThrow("Lista de dias inválida");
    await expect(
      setup(response({ days: [{ ...days[0], revision: -1 }] })).data.saveDays(days),
    ).rejects.toThrow("Data ou formato do dia inválido");
  });
});

describe("HTTP adapter against the local contract", () => {
  it("round-trips synthetic data and preserves real 409s and atomic day saves", async () => {
    const store = openDraftStore(":memory:");
    const app = createApp(store);
    app.use(handleErrors);
    const server = app.listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
      });
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const data = createHttpDataAccess((input, options) =>
        fetch(new URL(String(input), base), options),
      );
      expect(await data.readActivities()).toEqual({ revision: 0, activities: [] });
      const initialCatalog = { ...catalog, revision: 0 };
      expect(await data.saveActivities(initialCatalog)).toEqual({
        ...catalog, revision: 1,
      });
      await expect(data.saveActivities(initialCatalog)).rejects.toMatchObject({
        status: 409,
      });
      expect(await data.readActivities()).toEqual(store.readActivities());

      const initialDays = [
        { ...days[0], revision: 0 },
        { date: "2026-10-27", revision: 0, entries: [] },
      ];
      const saved = await data.saveDays(initialDays);
      expect(await data.readDays("2026-10-26", "2026-10-27")).toEqual(saved);
      const secondTab = await data.saveDays([saved[1]]);
      await expect(data.saveDays(saved)).rejects.toMatchObject({ status: 409 });
      expect(await data.readDays("2026-10-26", "2026-10-27")).toEqual([
        saved[0], secondTab[0],
      ]);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()),
      );
      store.close();
    }
  });
});
