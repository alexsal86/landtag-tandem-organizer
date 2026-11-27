/**
 * Reine Regeln für "Ministerien und Themen" in der Administration.
 *
 * Die Administration ordnet die Ministerien der laufenden Wahlperiode den
 * Ressortlinien zu. Frühere Wahlperioden bleiben als Zuordnungsarchiv
 * erreichbar; die Namens- und Ministerhistorie wird dort nicht mehr gepflegt,
 * sondern im Super-Admin-Bereich dargestellt.
 */

export interface MinistrySourceRow {
  legislature: number;
  ressort: string;
  requests: number;
  suggested_line: string | null;
}

export interface MinistrySuggestionRow {
  legislature: number;
  ressort: string;
  line_id: string;
}

export interface ElectionPeriodRow {
  number: number;
  starts_on: string | null;
  ends_on: string | null;
  is_current: boolean;
}

export interface MinistryOfPeriod {
  ressort: string;
  requests: number;
  suggestedLine: string | null;
}

/**
 * Laufende Wahlperiode: zuerst die von der Wahlhistorie markierte Periode,
 * dann die Periode, die den Stichtag einschließt, sonst die höchste in PARLIS
 * belegte Wahlperiode.
 */
export function currentLegislature(
  periods: ElectionPeriodRow[],
  sources: Pick<MinistrySourceRow, "legislature">[],
  today = new Date().toISOString().slice(0, 10),
): number | null {
  const marked = periods.find(period => period.is_current);
  if (marked) return marked.number;
  const including = periods.find(period =>
    period.starts_on !== null && period.ends_on !== null
    && period.starts_on <= today && today <= period.ends_on);
  if (including) return including.number;
  return sources.length ? Math.max(...sources.map(source => source.legislature)) : null;
}

/**
 * Ministerien einer Wahlperiode: PARLIS-Ressorts und hinterlegte Vorschläge
 * werden zusammengeführt, damit auch Ministerien ohne Anfragen zugeordnet
 * werden können. Ein PARLIS-Vorschlag hat Vorrang vor dem Tabellenvorschlag.
 * Sortiert wird nach Ressortnamen, damit die Liste unabhängig von der
 * Reihenfolge der Datenquelle stabil bleibt.
 */
export function ministriesForLegislature(
  legislature: number,
  sources: MinistrySourceRow[],
  suggestions: MinistrySuggestionRow[],
): MinistryOfPeriod[] {
  const rows = new Map<string, MinistryOfPeriod>();
  for (const suggestion of suggestions) {
    if (suggestion.legislature !== legislature) continue;
    rows.set(suggestion.ressort, {
      ressort: suggestion.ressort,
      requests: 0,
      suggestedLine: suggestion.line_id,
    });
  }
  for (const source of sources) {
    if (source.legislature !== legislature) continue;
    rows.set(source.ressort, {
      ressort: source.ressort,
      requests: source.requests,
      suggestedLine: source.suggested_line ?? rows.get(source.ressort)?.suggestedLine ?? null,
    });
  }
  return [...rows.values()].sort((a, b) => a.ressort.localeCompare(b.ressort, "de"));
}

/** Wahlperioden, zu denen PARLIS-Ressorts oder Vorschläge vorliegen. */
export function knownLegislatures(
  sources: Pick<MinistrySourceRow, "legislature">[],
  suggestions: Pick<MinistrySuggestionRow, "legislature">[],
): number[] {
  return [...new Set([...sources, ...suggestions].map(row => row.legislature))].sort((a, b) => a - b);
}

/** Jahresangabe einer Wahlperiode, z. B. "2026–2031"; null ohne Zeiträume. */
export function periodYears(period: ElectionPeriodRow | null | undefined): string | null {
  if (!period?.starts_on || !period.ends_on) return null;
  return `${period.starts_on.slice(0, 4)}–${period.ends_on.slice(0, 4)}`;
}
