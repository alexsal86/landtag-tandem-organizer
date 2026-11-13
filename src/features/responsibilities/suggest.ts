export type ResponsibilityKind =
  "topic" | "committee" | "region" | "role_focus";
export interface Responsibility {
  user_id: string;
  kind: ResponsibilityKind;
  topic_id?: string | null;
  committee_id?: string | null;
  region_id?: string | null;
  role_focus?: string | null;
  level: "primary" | "secondary";
}
export interface ResponsibilityContext {
  topicIds?: readonly string[];
  regionIds?: readonly string[];
  committeeIds?: readonly string[];
}
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export function referenceOf(r: Responsibility): string {
  return (
    (r.kind === "topic"
      ? r.topic_id
      : r.kind === "committee"
        ? r.committee_id
        : r.kind === "region"
          ? r.region_id
          : r.role_focus) ?? ""
  );
}
/** Category rank dominates level and count; absence always follows available candidates. */
export function suggestResponsible(
  context: ResponsibilityContext,
  responsibilities: readonly Responsibility[],
  absentUserIds: readonly string[],
) {
  const absent = new Set(absentUserIds);
  const matches = new Map<string, Responsibility[]>();
  for (const r of responsibilities) {
    const ids =
      r.kind === "topic"
        ? context.topicIds
        : r.kind === "region"
          ? context.regionIds
          : r.kind === "committee"
            ? context.committeeIds
            : undefined;
    if (!ids?.includes(referenceOf(r))) continue;
    matches.set(r.user_id, [...(matches.get(r.user_id) ?? []), r]);
  }
  const candidates = [...matches]
    .map(([userId, rows]) => {
      const topic = rows.some((r) => r.kind === "topic");
      const region = rows.some((r) => r.kind === "region");
      const rank = topic && region ? 4 : topic ? 3 : region ? 2 : 1;
      const primary = rows.some((r) => r.level === "primary");
      const isAbsent = absent.has(userId);
      const score = rank * 100 + (primary ? 10 : 0) - (isAbsent ? 1000 : 0);
      const reason = `${topic && region ? "Thema und Region" : topic ? "Thema" : region ? "Region" : "Ausschuss"} · ${primary ? "Primär" : "Sekundär"}${isAbsent ? " · abwesend" : ""}`;
      return { userId, score, reason, isAbsent, absentUserIds: [] as string[] };
    })
    .sort((a, b) => b.score - a.score || compare(a.userId, b.userId));
  const absentMatches = candidates
    .filter((c) => c.isAbsent)
    .map((c) => c.userId)
    .sort(compare);
  return candidates.map((c) => ({
    ...c,
    absentUserIds: c.isAbsent ? [] : absentMatches,
  }));
}
export interface CoverageCatalog {
  topics: readonly {
    id: string;
    name?: string;
    label?: string;
    is_active?: boolean;
  }[];
  committees: readonly { id: string; name: string; is_active?: boolean }[];
  regions: readonly { id: string; name: string; is_active?: boolean }[];
}
export function findCoverageGaps(
  catalog: CoverageCatalog,
  responsibilities: readonly Responsibility[],
) {
  const covered = new Set(
    responsibilities.map((r) => `${r.kind}:${referenceOf(r)}`),
  );
  return (
    [
      ["topic", catalog.topics],
      ["committee", catalog.committees],
      ["region", catalog.regions],
    ] as const
  )
    .flatMap(([kind, items]) =>
      items
        .filter((i) => i.is_active !== false && !covered.has(`${kind}:${i.id}`))
        .map((i) => ({
          kind,
          id: i.id,
          name: ("label" in i ? i.label : undefined) || i.name || i.id,
        })),
    )
    .sort((a, b) => compare(a.kind, b.kind) || compare(a.id, b.id));
}

export interface ResponsibilityArea {
  id: string;
  name: string;
  kind: "topic" | "committee" | "region";
}
/** Several people can be primary. Secondary-only coverage still needs a primary contact. */
export function responsibilityCoverage(
  area: Pick<ResponsibilityArea, "kind" | "id">,
  rows: readonly Responsibility[],
) {
  const matching = rows.filter(
    (r) => r.kind === area.kind && referenceOf(r) === area.id,
  );
  const primary = new Set(
    matching.filter((r) => r.level === "primary").map((r) => r.user_id),
  ).size;
  const secondary = new Set(
    matching.filter((r) => r.level === "secondary").map((r) => r.user_id),
  ).size;
  return {
    primary,
    secondary,
    state: primary
      ? ("covered" as const)
      : secondary
        ? ("no_primary" as const)
        : ("unassigned" as const),
  };
}
export function matchesResponsibilityArea(
  area: ResponsibilityArea,
  query: string,
  rows: readonly Responsibility[],
  people: readonly { id: string; name: string }[],
) {
  const term = query.trim().toLocaleLowerCase("de");
  return (
    !term ||
    area.name.toLocaleLowerCase("de").includes(term) ||
    rows.some(
      (r) =>
        r.kind === area.kind &&
        referenceOf(r) === area.id &&
        people.some(
          (p) =>
            p.id === r.user_id && p.name.toLocaleLowerCase("de").includes(term),
        ),
    )
  );
}
