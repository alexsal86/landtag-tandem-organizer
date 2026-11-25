const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

/** Token in Textform, z.B. für Exporte: `#[Presse](<uuid>)`. */
const topicTokenPattern = () => new RegExp(`#\\[([^\\]\\r\\n]*)\\]\\((${UUID})\\)`, "g");

/** Gespeicherte Notizen sind Editor-HTML: der Chip trägt die ID als Attribut. */
const topicHtmlPattern = () => new RegExp(`data-lexical-topic-id\\s*=\\s*["'](${UUID})["']`, "gi");

export function topicMentionToken(label: string, topicId: string): string {
  if (!new RegExp(`^${UUID}$`).test(topicId)) throw new Error("Ungültiges Thema");
  return `#[${label.replace(/[[\]\r\n]/g, "")}](${topicId.toLowerCase()})`;
}

/** Liest Themen-IDs aus Token-Text oder gespeichertem HTML; Duplikate entfallen. */
export function topicMentionIds(text: string): string[] {
  const ids = [
    ...Array.from(text.matchAll(topicTokenPattern()), (match) => match[2]),
    ...Array.from(text.matchAll(topicHtmlPattern()), (match) => match[1]),
  ];
  return [...new Set(ids.map((id) => id.toLowerCase()))];
}
