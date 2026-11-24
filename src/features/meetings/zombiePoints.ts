/**
 * Zombie-Punkt-Erkennung.
 *
 * Ein Tagesordnungspunkt, der über mehrere Sitzungen hinweg immer wieder
 * verschoben wird, kostet jedes Mal Vorbereitungs- und Sitzungszeit, ohne
 * entschieden zu werden. Die Zahl der Verschiebungen steht bereits in
 * `meeting_agenda_items.carryover_count`; hier werden daraus Stufen und
 * Handlungsempfehlungen abgeleitet. Reine Regeln ohne Datenbankzugriff, damit
 * Editor, Fokusmodus und Selbsttest dieselbe Logik verwenden.
 */

/** Ab dieser Zahl gilt ein Punkt als Zombie-Punkt. */
export const ZOMBIE_THRESHOLD = 3;

/** Ab dieser Zahl wird der Punkt zur Chefsache (Beschluss oder Verwerfen erzwingen). */
export const ZOMBIE_ESCALATION_THRESHOLD = 5;

export type ZombieLevel = "none" | "watch" | "zombie" | "escalated";

export interface ZombiePointSource {
  title?: string;
  carryover_count?: number | null;
  source_meeting_id?: string | null;
  original_meeting_title?: string | null;
  is_completed?: boolean | null;
  parent_id?: string | null;
  parentLocalKey?: string | null;
}

/** Verschiebungen eines Punktes; Altbestand ohne Zähler zählt als eine Verschiebung. */
export function carryoverCount(item: ZombiePointSource): number {
  const recorded = item.carryover_count ?? 0;
  if (recorded > 0) return recorded;
  return item.source_meeting_id ? 1 : 0;
}

export function zombieLevel(item: ZombiePointSource): ZombieLevel {
  const count = carryoverCount(item);
  if (count >= ZOMBIE_ESCALATION_THRESHOLD) return "escalated";
  if (count >= ZOMBIE_THRESHOLD) return "zombie";
  if (count === ZOMBIE_THRESHOLD - 1) return "watch";
  return "none";
}

export function zombieLabel(level: ZombieLevel): string | null {
  switch (level) {
    case "watch":
      return "Bleibt liegen";
    case "zombie":
      return "Zombie-Punkt";
    case "escalated":
      return "Eskaliert";
    default:
      return null;
  }
}

/** Was in der Sitzung passieren soll, statt den Punkt erneut zu verschieben. */
export function zombieAdvice(level: ZombieLevel): string | null {
  switch (level) {
    case "watch":
      return "Zweimal verschoben – jetzt eine Richtung festlegen.";
    case "zombie":
      return "Drittes Mal auf der Tagesordnung: heute entscheiden, beauftragen oder verwerfen.";
    case "escalated":
      return "Seit fünf Sitzungen offen: ohne Entscheidung mit Frist und Zuständigkeit nicht erneut übertragen.";
    default:
      return null;
  }
}

export interface ZombiePoint {
  item: ZombiePointSource;
  level: Exclude<ZombieLevel, "none">;
  count: number;
}

/**
 * Alle erkannten Punkte einer Sitzung, eskaliert zuerst, dann nach Zahl der
 * Verschiebungen. Unterpunkte erben das Thema ihres Hauptpunkts und werden
 * hier nicht separat gemeldet.
 */
export function findZombiePoints(items: ZombiePointSource[]): ZombiePoint[] {
  return items
    .filter((item) => !item.parent_id && !item.parentLocalKey)
    .map((item) => ({ item, level: zombieLevel(item), count: carryoverCount(item) }))
    .filter((entry): entry is ZombiePoint => entry.level !== "none")
    .sort((a, b) => b.count - a.count || (a.item.title ?? "").localeCompare(b.item.title ?? "", "de"));
}

export function zombieSummary(items: ZombiePointSource[]) {
  const points = findZombiePoints(items);
  return {
    points,
    count: points.length,
    escalated: points.filter((point) => point.level === "escalated").length,
    worst: points[0] ?? null,
  };
}
