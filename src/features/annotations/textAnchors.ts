/** Whitespace/case normalization keeps stable offsets into individual PDF text items. */
export function normalizedText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLocaleLowerCase("de");
}
export function uniqueTextAnchor(
  haystack: string,
  quote: string,
): { start: number; end: number } | null {
  const needle = normalizedText(quote),
    text = normalizedText(haystack);
  // Short phrases recur too easily. Ambiguous matches always require manual relocation.
  if (needle.length < 8) return null;
  const start = text.indexOf(needle);
  return start >= 0 && text.indexOf(needle, start + 1) < 0
    ? { start, end: start + needle.length }
    : null;
}
