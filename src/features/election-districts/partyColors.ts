export const partyColors: Record<string, string> = {
  CDU: '#1f2937', SPD: '#dc2626', GRÜNE: '#16a34a', FDP: '#ffed00',
  AFD: '#1e40af', LINKE: '#be3075', 'Ohne Direktmandat': '#9ca3af',
};

export function getPartyColor(party?: string): string {
  const name = party?.trim().toUpperCase().replace(/[\s/–-]+/g, '');
  const normalized = name === 'FDPDVP' || name === 'DVP' ? 'FDP'
    : name === 'BÜNDNIS90DIEGRÜNEN' ? 'GRÜNE' : name === 'DIELINKE' ? 'LINKE' : name;
  return partyColors[normalized || ''] || '#9ca3af';
}

export function getPartyTextColor(party?: string): string {
  return getPartyColor(party) === '#ffed00' ? '#000000' : '#ffffff';
}
