import { describe, expect, it } from "vitest";
import {
  validateActivityCatalog,
  resolveActivity,
  activitiesForProject,
} from "./activities";
const first = { projectId: 10, activityId: 101, name: "Revisão" };
const second = { projectId: 20, activityId: 202, name: "Revisão" };
describe("project-specific activities", () => {
  it("resolves the same label to different IDs in different projects", () => {
    const catalog = validateActivityCatalog({
      revision: 0,
      activities: [first, second],
    });
    expect(resolveActivity(catalog.activities, 10, "Revisão")).toEqual(first);
    expect(resolveActivity(catalog.activities, 20, " revisão ")).toEqual(
      second,
    );
    expect(activitiesForProject(catalog.activities, 20)).toEqual([second]);
  });
  it("never falls back to a mapping from another or unknown project", () => {
    expect(resolveActivity([first], 20, "Revisão")).toBeNull();
    expect(resolveActivity([first], undefined, "Revisão")).toBeNull();
    expect(activitiesForProject([first], undefined)).toEqual([]);
  });
  it("normalizes outer whitespace, case and equivalent Unicode without removing accents", () => {
    const item = { ...first, name: "  Revisão  " };
    expect(
      validateActivityCatalog({ revision: 0, activities: [item] }).activities[0]
        .name,
    ).toBe("Revisão");
    expect(resolveActivity([first], 10, "REVISA\u0303O")).toEqual(first);
    expect(resolveActivity([first], 10, "Revisao")).toBeNull();
  });
  it("rejects ambiguous names and reused IDs within one project", () => {
    expect(() =>
      validateActivityCatalog({
        revision: 0,
        activities: [first, { ...first, activityId: 102, name: " revisão " }],
      }),
    ).toThrow(/únicos/);
    expect(() =>
      validateActivityCatalog({
        revision: 0,
        activities: [first, { ...first, name: "Outra atividade" }],
      }),
    ).toThrow(/únicos/);
  });
  it.each([
    null,
    { revision: -1, activities: [] },
    { revision: 0, activities: null },
    { revision: 0, activities: [{ ...first, projectId: 0 }] },
    { revision: 0, activities: [{ ...first, activityId: 1.5 }] },
    { revision: 0, activities: [{ ...first, name: " " }] },
    { revision: 0, activities: [{ ...first, activityId: "101" }] },
  ])("rejects malformed catalog data before persistence", (value) =>
    expect(() => validateActivityCatalog(value)).toThrow(),
  );
  it("accepts an empty catalog and strips unrelated fields", () => {
    expect(validateActivityCatalog({ revision: 0, activities: [] })).toEqual({
      revision: 0,
      activities: [],
    });
    expect(
      validateActivityCatalog({
        revision: 0,
        activities: [{ ...first, extra: "not-stored" }],
        secret: "not-stored",
      }),
    ).toEqual({ revision: 0, activities: [first] });
  });
});
