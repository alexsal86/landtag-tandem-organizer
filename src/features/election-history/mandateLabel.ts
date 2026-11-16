/** The structured mandate type is authoritative; imported source text may be stale. */
export function formatMandateType(type: string | null | undefined): string {
  if (type === 'direct') return 'Direktmandat';
  if (type === 'list') return 'Listenmandat';
  return 'Mandatsart nicht erfasst';
}
