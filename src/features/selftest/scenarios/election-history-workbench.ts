import { supabase } from '@/integrations/supabase/client';
import { uniqueStateListMatch, type StateListPerson } from '@/features/election-history/admin/stateListModel';
import type { TestScenario } from '../types';
export const electionHistoryWorkbenchScenario: TestScenario = {
  id: 'election-history-workbench', title: 'Wahldaten: Problemfälle und Landeslisten',
  description: 'Prüft die eindeutige Namenszuordnung und liest die begrenzte Problemübersicht ohne Datenänderung.',
  features: ['election-history'], touches: [],
  limitations: ['Die Schreibberechtigungen, Listenplatz-Constraints und Trigger müssen zusätzlich mit Datenbank-Rollenszenarien geprüft werden.'],
  steps: [
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
