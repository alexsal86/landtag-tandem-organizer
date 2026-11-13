export const ACTION_ITEM_MIN_LENGTH = 3;

export function extractPlainTextFromHtml(html: string | undefined | null): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').trim();
}
