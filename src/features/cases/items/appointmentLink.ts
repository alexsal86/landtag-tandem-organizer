/** The request RPC copies notes into the accepted appointment description. */
const SOURCE_PATTERN = /(?:^|\n)Vorgang: (?:https?:\/\/[^\s/]+)?\/mywork\?tab=cases&caseItemId=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?=\s|$)/i;

export function caseSourceHref(text: string | null | undefined): string | null {
  const id = text?.match(SOURCE_PATTERN)?.[1];
  return id ? `/mywork?tab=cases&caseItemId=${id}` : null;
}

export function appendCaseSource(notes: string, caseItemId?: string, origin = ""): string {
  if (!caseItemId) return notes.trim();
  return [notes.trim(), `Vorgang: ${origin}/mywork?tab=cases&caseItemId=${encodeURIComponent(caseItemId)}`].filter(Boolean).join("\n");
}
