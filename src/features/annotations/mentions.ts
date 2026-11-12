const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const mentionPattern = () => new RegExp(`@\\[([^\\]\\r\\n]*)\\]\\((${UUID})\\)`, 'g');
export function annotationMentionToken(name: string, userId: string): string {
  if (!new RegExp(`^${UUID}$`).test(userId)) throw new Error('Ungültige Erwähnung');
  return `@[${name.replace(/[\[\]\r\n]/g, '')}](${userId.toLowerCase()})`;
}
export function annotationMentionIds(text: string): string[] {
  return [...new Set(Array.from(text.matchAll(mentionPattern()), match => match[2].toLowerCase()))];
}
export function plainAnnotationComment(text: string): string {
  return text.replace(mentionPattern(), '@$1');
}
export function annotationDocumentPath(documentId: string | null | undefined, annotationId?: string | null): string {
  if (!documentId) return '/documents?tab=documents';
  const params = new URLSearchParams({ tab: 'documents', annotate: documentId });
  if (annotationId) params.set('annotation', annotationId);
  return `/documents?${params.toString()}`;
}
