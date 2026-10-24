import { describe, expect, it } from "vitest";
import {
  validateActivityCatalog,
  resolveActivity,
  consolidateLegacyActivities,
} from "./activities";
const first = { activityId: 101, name: "Revisão" };
describe("one activity catalog", () => {
  it("resolves a name without a task or project", () => {
    const catalog = validateActivityCatalog({
      revision: 0,
      activities: [first],
    });
    expect(resolveActivity(catalog.activities, " revisão ")).toEqual(first);
    expect(resolveActivity(catalog.activities, "Missing")).toBeNull();
  });
  it("normalizes Unicode and whitespace without removing accents", () => {
    expect(
      validateActivityCatalog({
        revision: 0,
        activities: [{ ...first, name: " Revisão " }],
      }).activities,
    ).toEqual([first]);
    expect(resolveActivity([first], "REVISA\u0303O")).toEqual(first);
    expect(resolveActivity([first], "Revisao")).toBeNull();
  });
  it("rejects ambiguous names and reused codes", () => {
    for (const other of [
      { activityId: 102, name: " revisão " },
      { activityId: 101, name: "Outra" },
    ])
      expect(() =>
        validateActivityCatalog({ revision: 0, activities: [first, other] }),
      ).toThrow(/únicos/);
  });
  it.each([
    null,
    { revision: -1, activities: [] },
    { revision: 0, activities: null },
    { revision: 0, activities: [{ ...first, activityId: 1.5 }] },
    { revision: 0, activities: [{ ...first, name: " " }] },
    { revision: 0, activities: [{ ...first, activityId: "101" }] },
  ])("rejects malformed catalogs", (value) =>
    expect(() => validateActivityCatalog(value)).toThrow(),
  );
  it("rejects a write from the previous project-based editor", () => {
    expect(() =>
      validateActivityCatalog({
        revision: 1,
        activities: [{ ...first, projectId: 10 }],
      }),
    ).toThrow(/Recarregue/);
  });
  it("accepts empty catalogs and strips unrelated fields", () => {
    expect(validateActivityCatalog({ revision: 0, activities: [] })).toEqual({
      revision: 0,
      activities: [],
    });
    expect(
      validateActivityCatalog({
        revision: 0,
        activities: [{ ...first, extra: "not-stored" }],
      }),
    ).toEqual({ revision: 0, activities: [first] });
  });
});
describe("legacy catalog consolidation", () => {
  it("combines identical mappings across projects without choosing another ID", () => {
    expect(
      consolidateLegacyActivities({
        revision: 3,
        activities: [
          { ...first, projectId: 10 },
          { ...first, projectId: 20, name: " revisão " },
        ],
      }),
    ).toEqual({ revision: 3, activities: [first] });
  });
  it("refuses same-label different-code mappings instead of silently discarding them", () => {
    expect(() =>
      consolidateLegacyActivities({
        revision: 1,
        activities: [
          { ...first, projectId: 10 },
          { ...first, projectId: 20, activityId: 202 },
        ],
      }),
    ).toThrow(/códigos diferentes/);
  });
  it("rejects conflicting labels for one ID and malformed legacy data", () => {
    expect(() =>
      consolidateLegacyActivities({
        revision: 1,
        activities: [
          { ...first, projectId: 10 },
          { ...first, projectId: 20, name: "Outra" },
        ],
      }),
    ).toThrow(/únicos/);
    expect(() =>
      consolidateLegacyActivities({
        revision: 1,
        activities: [{ ...first, projectId: 0 }],
      }),
    ).toThrow();
  });
});
