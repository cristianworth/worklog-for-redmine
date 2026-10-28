import type { Activity } from "../shared/activities";

export function alphabeticalActivities(activities: Activity[]): Activity[] {
  return activities.toSorted((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}
