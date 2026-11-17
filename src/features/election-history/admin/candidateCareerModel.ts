import type { ElectionCandidacy, ElectionPerson, HistoricalMandate } from '../types';
export type CareerPeriod = { period_number: number; period_name: string; district_name: string | null; district_label: string | null };
export type CareerCandidate = ElectionCandidacy & CareerPeriod;
export type CareerMandate = HistoricalMandate & CareerPeriod & { end_is_expected: boolean };
export type PersonCareer = { person: ElectionPerson; candidacies: CareerCandidate[]; mandates: CareerMandate[] };
export const candidacyOutcomeLabels: Record<ElectionCandidacy['outcome'], string> = { direct: 'Direkt gewählt', list: 'Über Liste gewählt', not_elected: 'Nicht gewählt', unknown: 'Wahlausgang offen' };
/** An unsuccessful election and a later succession are separate facts, not conflicting outcomes. */
export function candidacyMandateStatus(candidate: ElectionCandidacy, mandates: readonly HistoricalMandate[]): string {
  const current = mandates.filter(m => m.person_id === candidate.person_id && m.period_id === candidate.period_id);
  if (!current.length) return 'Kein Mandat in dieser Periode erfasst';
  if (current.some(m => m.entry_type === 'election')) return 'Mandat in dieser Periode erfasst';
  return 'In dieser Periode nachgerückt';
}
export function careerPeriods(career: PersonCareer) {
  const ids = new Map<string, { id: string; number: number; name: string }>();
  for (const row of [...career.candidacies, ...career.mandates]) ids.set(row.period_id, { id: row.period_id, number: row.period_number, name: row.period_name });
  return [...ids.values()].sort((a,b) => a.number - b.number);
}
