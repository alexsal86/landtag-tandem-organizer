import type { ComparisonValue, Metric } from "./types";

export const atlasValue = (
  row: ComparisonValue,
  metric: Metric,
): number | null =>
  metric === "votes"
    ? row.voteDelta
    : metric === "relative"
      ? row.relativeSwing
      : row.swing;

/** Exact district numbers; names are case-insensitive substrings. */
export function atlasRows(
  rows: ComparisonValue[],
  party: string,
  search: string,
) {
  const term = search.trim().toLocaleLowerCase("de-DE");
  return rows.filter(
    (row) =>
      row.party === party &&
      (!term ||
        (/^\d+$/.test(term)
          ? row.districtNumber === Number(term)
          : row.districtName.toLocaleLowerCase("de-DE").includes(term))),
  );
}

/** Null and measured zero never enter gain/loss rankings. */
export function atlasRankings(rows: ComparisonValue[], metric: Metric) {
  const known = rows.filter((r) => atlasValue(r, metric) !== null);
  const sorted = [...known].sort(
    (a, b) =>
      atlasValue(b, metric)! - atlasValue(a, metric)! ||
      a.districtNumber - b.districtNumber,
  );
  return {
    gains: sorted.filter((r) => atlasValue(r, metric)! > 0).slice(0, 5),
    losses: sorted
      .filter((r) => atlasValue(r, metric)! < 0)
      .reverse()
      .slice(0, 5),
    positive: known.filter((r) => atlasValue(r, metric)! > 0).length,
    negative: known.filter((r) => atlasValue(r, metric)! < 0).length,
    unchanged: known.filter((r) => atlasValue(r, metric) === 0).length,
    unknown: rows.length - known.length,
  };
}

// Stable across parties and elections. Saturated values remain explicit in tooltips.
export const atlasScale = (metric: Metric) => (metric === "votes" ? 10000 : 10);
