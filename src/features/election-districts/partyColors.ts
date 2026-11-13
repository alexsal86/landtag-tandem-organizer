export function getPartyColor(party?: string): string {
  const name = party?.trim().toUpperCase().replace(/[\s/–-]+/g, '');
  switch (name) {
    case 'CDU': return '#000000';
    case 'FDP':
    case 'DVP':
    case 'FDPDVP': return '#ffed00';
    case 'GRÜNE':
    case 'BÜNDNIS90DIEGRÜNEN': return '#16a34a';
    case 'SPD': return '#dc2626';
    case 'AFD': return '#1e40af';
    default: return '#6b7280';
  }
}

export function getPartyTextColor(party?: string): string {
  return getPartyColor(party) === '#ffed00' ? '#000000' : '#ffffff';
}
