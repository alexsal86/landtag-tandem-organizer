export type HistoryFaction = { id: string; result_code?: string; name: string; full_name: string | null; aliases: string[]; is_active: boolean };
export const factionKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');
export function resolveFaction(name: string, factions: HistoryFaction[]): HistoryFaction | undefined {
  const key = factionKey(name);
  const matches = factions.filter(f => [f.name, ...f.aliases].some(alias => factionKey(alias) === key));
  return key && matches.length === 1 ? matches[0] : undefined;
}

/** Official result codes stay fixed when a catalog display name changes. */
export function factionResultCode(name: string, factions: HistoryFaction[]): string {
  const code = resolveFaction(name, factions)?.result_code;
  if (code) return code;
  const key = factionKey(name);
  if (['fdp', 'fdp/dvp'].includes(key)) return 'FDP';
  if (['grüne', 'bündnis 90/die grünen'].includes(key)) return 'GRÜNE';
  return key === 'afd' ? 'AfD' : name.trim();
}
