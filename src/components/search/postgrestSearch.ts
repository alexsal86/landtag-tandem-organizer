/**
 * Helpers for the PostgREST logical filters used by the global search.
 *
 * `.or()` is a string grammar: commas separate conditions, parentheses group
 * them and `.`/`:` separate column and operator. A raw search term containing
 * those characters splits the filter into malformed conditions, and supabase-js
 * reports that only as `data: null` — the search then silently returns nothing.
 * Reserved characters therefore have to be sent as a double-quoted value.
 *
 * See PostgREST URL grammar: values with reserved characters (`,`, `.`, `:`,
 * `*`, `(`, `)`) must be quoted, a `"` inside is escaped as `\"` and a
 * backslash as `\\`. LIKE wildcards (`%`, `_`, `\`) additionally need their
 * own SQL escape, which PostgREST unescapes once.
 */

const LIKE_ESCAPE = /[\\%_]/g;

/** LIKE pattern matching the term literally, quoted for use in `.or()`. */
export function toQuotedIlikePattern(term: string): string {
  const literal = term
    .trim()
    .replace(LIKE_ESCAPE, (match) => `\\${match}`)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
  return `"%${literal}%"`;
}

/** Builds a quoted `.or()` filter that matches `term` on any of `columns`. */
export function buildOrIlikeFilter(columns: readonly string[], term: string): string {
  const pattern = toQuotedIlikePattern(term);
  return columns.map((column) => `${column}.ilike.${pattern}`).join(",");
}
