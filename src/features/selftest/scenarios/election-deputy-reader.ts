import { supabase } from '@/integrations/supabase/client';
import type { TestScenario } from '../types';

export const electionDeputyReaderScenario: TestScenario = {
  id: 'election-deputy-reader', title: 'Wahlanalyse: Abgeordnetenübersicht',
  description: 'Prüft lesend die begrenzte Suche und die Chronologie freigegebener Mandate.',
  features: ['election-analysis'], touches: [],
  limitations: ['Prüft die erste verfügbare Mandatshistorie. Weitere Rollen und die visuelle Darstellung werden dadurch nicht vollständig abgedeckt.'],
  steps: [{ id: 'published-deputy-history', label: 'Suche und Detail zeigen ausschließlich freigegebene Legislaturperioden', kind: 'db', run: async () => {
    const page = await supabase.rpc('list_analysis_deputies', { search_text: '', page_offset: 0 });
    if (page.error) throw page.error;
    if (!Array.isArray(page.data) || page.data.length > 26) return { ok: false, message: 'Die Abgeordnetensuche liefert keine begrenzte Trefferseite.' };
    if (!page.data.length) return { ok: true, message: 'Keine freigegebenen Abgeordneten vorhanden; Detailprüfung ohne verfügbare Daten nicht durchgeführt.' };
    const first = page.data[0];
    if (!first || typeof first !== 'object' || Array.isArray(first) || typeof first.name_key !== 'string') return { ok: false, message: 'Ungültiger Suchtreffer.' };
    const [history, periods] = await Promise.all([
      supabase.rpc('get_analysis_deputy', { name_key: first.name_key }),
      supabase.from('election_history_periods').select('number').eq('is_published', true).limit(100),
    ]);
    if (history.error) throw history.error;
    if (periods.error) throw periods.error;
    if (!Array.isArray(history.data) || history.data.length > 201) return { ok: false, message: 'Die Detailansicht liefert keine begrenzte Historie.' };
    const published = new Set((periods.data || []).map(period => period.number));
    let previous = 0;
    for (const row of history.data) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row.period_number !== 'number' || !published.has(row.period_number) || row.period_number < previous) return { ok: false, message: 'Unveröffentlichte oder nicht chronologisch geordnete Mandate in der Detailansicht.' };
      previous = row.period_number;
    }
    return { ok: true, message: 'Begrenzte Suche und chronologische, freigegebene Mandatshistorie sind lesbar.' };
  } }],
};
