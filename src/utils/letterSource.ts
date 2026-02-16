const LETTER_SOURCE_PATTERN = /\[\[letter:([^\]]+)\]\]/i;

export function extractLetterSourceId(text?: string | null): string | null {
  if (!text) return null;
  const match = text.match(LETTER_SOURCE_PATTERN);
  return match?.[1]?.trim() || null;
}

export function stripLetterSourceMarker(text?: string | null): string {
  if (!text) return "";
  return text.replace(LETTER_SOURCE_PATTERN, "").trim();
}

