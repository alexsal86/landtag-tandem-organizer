import { candidacyMandateStatus, careerPeriods, type PersonCareer } from '@/features/election-history/admin/candidateCareerModel';
import { supabase } from '@/integrations/supabase/client';
import { uniqueStateListMatch, type StateListPerson } from '@/features/election-history/admin/stateListModel';
import type { TestScenario } from '../types';
export const electionHistoryWorkbenchScenario: TestScenario = {
  id: 'election-history-workbench', title: 'Wahldaten: Problemfälle und Landeslisten',
  description: 'Prüft die eindeutige Namenszuordnung und liest die begrenzte Problemübersicht ohne Datenänderung.',
  features: ['election-history'], touches: [],
  limitations: ['Die Schreibberechtigungen, Listenplatz-Constraints und Trigger müssen zusätzlich mit Datenbank-Rollenszenarien geprüft werden.'],
  steps: [
    { id: 'candidate-before-member', label: 'Erfolglose Kandidatur bleibt mit späterem Mandat verbunden, ohne selbst als Mandat zu zählen', kind: 'logic', run: async () => {
      const candidate = { id: 'candidate', person_id: 'person', period_id: 'first', district_id: 'district', party: 'Partei', votes: 123, vote_share: 10, district_rank: 2, list_position: null, ballot_type: 'candidate' as const, outcome: 'not_elected' as const, source_url: null, notes: null, period_number: 1, period_name: 'Erste Periode', district_name: 'Wahlkreis', district_label: '1' };
      const laterMandate = { id: 'mandate', person_id: 'person', period_id: 'third', person_name: 'Person', original_mandate: null, party_label: null, left_early: false, district_id: 'district', candidacy_id: null, party: 'Partei', mandate_type: 'direct' as const, entry_type: 'election' as const, start_from_period: false, end_from_period: false, starts_on: '1980-01-01', ends_on: '1984-01-01', source_url: null, notes: null, period_number: 3, period_name: 'Dritte Periode', district_name: 'Wahlkreis', district_label: '1', end_is_expected: false };
      if (candidacyMandateStatus(candidate, [laterMandate]) !== 'Kein Mandat in dieser Periode erfasst') throw new Error('Ein späteres Mandat darf eine frühere Niederlage nicht in einen Wahlsieg verwandeln.');
      if (candidacyMandateStatus(candidate, [{ ...laterMandate, period_id: 'first', entry_type: 'succession' }]) !== 'In dieser Periode nachgerückt') throw new Error('Nachrücken und ursprünglicher Wahlausgang bleiben getrennt.');
      if (candidacyMandateStatus(candidate, [{ ...laterMandate, person_id: 'namesake', period_id: 'first' }]) !== 'Kein Mandat in dieser Periode erfasst') throw new Error('Namensgleiche Personen dürfen keine Mandate voneinander übernehmen.');
      const career: PersonCareer = { person: { id: 'person', name: 'Person', biography: null, source_url: null, history_complete: false }, candidacies: [candidate], mandates: [laterMandate] };
      if (careerPeriods(career).map(period => period.number).join(',') !== '1,3' || career.mandates.length !== 1) throw new Error('Die Laufbahn muss chronologisch bleiben, ohne Mandate oder Zwischenperioden zu erfinden.');
      return { ok: true, message: 'Erfolglose Wahlteilnahme und spätere Mandatszeit sind derselben Person zugeordnet und bleiben unterschiedliche Ereignisse.' };
    } },
    { id: 'state-list-identity', label: 'Landeslisten: keine automatische Auswahl bei mehreren gleichnamigen Historien', kind: 'logic', run: async () => {
      const first: StateListPerson = { connection_id: 'older', name: 'Gleicher Name', parties: ['FDP'], periods: [4, 5], exact_match: true };
      const second: StateListPerson = { ...first, connection_id: 'younger', periods: [17] };
      if (uniqueStateListMatch([first, second]) || uniqueStateListMatch([{ ...first, exact_match: false }]) || uniqueStateListMatch([])) throw new Error('Mehrdeutige und nur ähnliche Namen dürfen nicht automatisch zugeordnet werden.');
      if (uniqueStateListMatch([first, { ...first }])?.connection_id !== 'older') throw new Error('Mehrere Mandate derselben Historie müssen als eine Identität zählen.');
      return { ok: true, message: 'Nur eine einzige exakte Historie wird vorgeschlagen; Partei und Namensähnlichkeit reichen nicht aus.' };
    } },
    { id: 'cross-period-issues', label: 'Problemfälle: begrenzte globale Suche und Filter nach Problemart', kind: 'db', run: async ctx => {
      const role = await supabase.rpc('is_superadmin', { _user_id: ctx.userId }); if (role.error) throw role.error;
      if (!role.data) return { ok: true, message: 'Globale Problemübersicht benötigt Super-Admin; in dieser Sitzung nicht geprüft.' };
      const result = await supabase.rpc('get_election_history_issues', { page_offset: 0 }); if (result.error) throw result.error;
      const value = result.data;
      if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.rows) || value.rows.length > 50 || typeof value.total !== 'number') return { ok: false, message: 'Problemübersicht ist nicht korrekt begrenzt.' };
      const first = value.rows[0];
      if (!first) return { ok: true, message: 'Keine Problemhinweise vorhanden; Problemartfilter ohne Daten nicht geprüft.' };
      if (typeof first !== 'object' || Array.isArray(first) || typeof first.issue_code !== 'string') return { ok: false, message: 'Ungültiger Problemhinweis.' };
      const filtered = await supabase.rpc('get_election_history_issues', { issue_filter: first.issue_code }); if (filtered.error) throw filtered.error;
      const payload = filtered.data;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Array.isArray(payload.rows) || payload.rows.some(row => !row || typeof row !== 'object' || Array.isArray(row) || row.issue_code !== first.issue_code)) return { ok: false, message: 'Problemartfilter liefert fremde Problemarten.' };
      return { ok: true, message: 'Globale Problemübersicht liefert höchstens 50 Hinweise und filtert die Problemart korrekt.' };
    } },
  ],
};
