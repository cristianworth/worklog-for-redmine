export interface Activity {
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
      !positiveId(activity.activityId) ||
      typeof activity.name !== "string" ||
      !activity.name.trim()
    )
      throw new Error(
        "Informe um código inteiro positivo e um nome para cada atividade.",
      );
    if ("projectId" in activity)
      throw new Error(
        "O catálogo agora usa uma lista única, sem projeto. Recarregue a página antes de salvar.",
      );
    const nameKey = normalizedName(activity.name);
    const idKey = String(activity.activityId);
    if (names.has(nameKey) || ids.has(idKey))
      throw new Error(
        "O catálogo deve ter códigos e nomes de atividade únicos.",
      );
    names.add(nameKey);
    ids.add(idKey);
    return {
      activityId: activity.activityId,
      name: activity.name.trim().normalize("NFC"),
    };
  });
  return { revision: catalog.revision!, activities };
}

export function resolveActivity(
  activities: Activity[],
  name: string,
): Activity | null {
  return (
    activities.find(
      (activity) => normalizedName(activity.name) === normalizedName(name),
    ) ?? null
  );
}

export function consolidateLegacyActivities(value: unknown): ActivityCatalog {
  const catalog = value as {
    revision: number;
    activities: (Activity & { projectId: number })[];
  };
  if (!catalog || !Array.isArray(catalog.activities))
    throw new Error("Formato do catálogo antigo inválido.");
  const activities: Activity[] = [];
  for (const activity of catalog.activities) {
    if (!activity || !positiveId(activity.projectId))
      throw new Error("O catálogo antigo contém um projeto inválido.");
    const candidate = validateActivityCatalog({
      revision: 0,
      activities: [{ activityId: activity.activityId, name: activity.name }],
    }).activities[0];
    const previous = resolveActivity(activities, candidate.name);
    if (previous) {
      if (previous.activityId !== candidate.activityId)
        throw new Error(
          "O catálogo antigo contém códigos diferentes para o mesmo nome. Resolva o conflito antes de consolidar; nenhum dado foi alterado.",
        );
      continue;
    }
    activities.push(candidate);
  }
  return validateActivityCatalog({ revision: catalog.revision, activities });
}
