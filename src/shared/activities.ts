export interface Activity {
  projectId: number;
  activityId: number;
  name: string;
}
export interface ActivityCatalog {
  revision: number;
  activities: Activity[];
}
const positiveId = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const normalizedName = (value: string) =>
  value.trim().normalize("NFC").toLocaleLowerCase("pt-BR");

export function validateActivityCatalog(value: unknown): ActivityCatalog {
  const catalog = value as Partial<ActivityCatalog> | null;
  if (
    !catalog ||
    typeof catalog !== "object" ||
    !Number.isSafeInteger(catalog.revision) ||
    catalog.revision! < 0 ||
    !Array.isArray(catalog.activities)
  )
    throw new Error("Formato do catálogo de atividades inválido.");
  const names = new Set<string>();
  const ids = new Set<string>();
  const activities = catalog.activities.map((activity) => {
    if (
      !activity ||
      !positiveId(activity.projectId) ||
      !positiveId(activity.activityId) ||
      typeof activity.name !== "string" ||
      !activity.name.trim()
    )
      throw new Error(
        "Informe projeto e atividade com códigos inteiros positivos e um nome para cada atividade.",
      );
    const nameKey = `${activity.projectId}:${normalizedName(activity.name)}`;
    const idKey = `${activity.projectId}:${activity.activityId}`;
    if (names.has(nameKey) || ids.has(idKey))
      throw new Error(
        "Cada projeto deve ter códigos e nomes de atividade únicos.",
      );
    names.add(nameKey);
    ids.add(idKey);
    return {
      projectId: activity.projectId,
      activityId: activity.activityId,
      name: activity.name.trim().normalize("NFC"),
    };
  });
  return { revision: catalog.revision!, activities };
}

export function activitiesForProject(
  activities: Activity[],
  projectId: number | undefined,
): Activity[] {
  return activities.filter((activity) => activity.projectId === projectId);
}

export function resolveActivity(
  activities: Activity[],
  projectId: number | undefined,
  name: string,
): Activity | null {
  if (!projectId || !name.trim()) return null;
  // A label only resolves inside the issue's project; it is never a global activity identifier.
  return (
    activitiesForProject(activities, projectId).find(
      (activity) => normalizedName(activity.name) === normalizedName(name),
    ) ?? null
  );
}
