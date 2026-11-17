export const parliamentOrder = ['SPD', 'GRÜNE', 'FDP', 'CDU', 'AfD', 'REP', 'NPD'];

/** Normalize for spatial order only; preserve the source label in the legend. */
export function parliamentPartyKey(party: string): string {
  const name = party.trim().toUpperCase();
  return name==='FDP/DVP' ? 'FDP' : ['GRÜNE','BÜNDNIS 90/DIE GRÜNEN'].includes(name) ? 'GRÜNE' : name;
}
export function compareParliamentParties(a: string, b: string): number {
  const index = (party: string) => parliamentOrder.findIndex(value => parliamentPartyKey(value)===parliamentPartyKey(party));
  const left = index(a), right = index(b);
  return (left<0 ? parliamentOrder.length : left)-(right<0 ? parliamentOrder.length : right) || a.localeCompare(b,'de');
}
