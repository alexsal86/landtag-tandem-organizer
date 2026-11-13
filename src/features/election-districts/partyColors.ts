export const partyColors: Record<string, string> = {
  CDU: '#343a40', SPD: '#dc2626', GRÜNE: '#15803d', FDP: '#facc15',
  AFD: '#009ee0', LINKE: '#be3075', 'Ohne Direktmandat': '#9ca3af',
};

export function getPartyColor(party?: string): string {
  const name = party?.trim().toUpperCase().replace(/[\s/–-]+/g, '');
  const normalized = name === 'FDPDVP' || name === 'DVP' ? 'FDP'
    : name === 'BÜNDNIS90DIEGRÜNEN' ? 'GRÜNE' : name === 'DIELINKE' ? 'LINKE' : name;
  return partyColors[normalized || ''] || '#9ca3af';
}

export function getPartyTextColor(party?: string): string {
  return getPartyColor(party) === '#facc15' ? '#000000' : '#ffffff';
}
