import { normalizeGeoJsonGeometry } from '@/hooks/geoContracts';
import { hasRenderableBoundary } from '@/features/election-districts/mapModel';
import type { ElectionCandidacy, ElectionHistoryData, ElectionHistoryTables, HistoricalMandate } from './types';
export type HistoryEntity = 'periods' | 'people' | 'districts' | 'candidacies' | 'mandates';
export const historyTables = {
  periods: 'election_history_periods', people: 'election_history_people', districts: 'election_history_districts',
  candidacies: 'election_history_candidacies', mandates: 'election_history_mandates',
} as const;
type TableName = typeof historyTables[HistoryEntity];
export type HistoryInsert = ElectionHistoryTables[TableName]['Insert'];
export type FormValues = Record<string, string | boolean>;
const required = (v: FormValues, key: string) => {
  const value = String(v[key] ?? '').trim();
  if (!value) throw new Error('Bitte alle Pflichtfelder ausfüllen.');
  return value;
};
const optional = (v: FormValues, key: string) => String(v[key] ?? '').trim() || null;
const numberValue = (v: FormValues, key: string, min: number, max = Number.MAX_SAFE_INTEGER, integer = true) => {
  const raw = optional(v, key);
  if (raw === null) return null;
  const n = Number(raw.replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isSafeInteger(n))) throw new Error('Bitte gültige Zahlen innerhalb des angegebenen Bereichs eingeben.');
  return n;
};
const url = (v: FormValues) => {
  const value = optional(v, 'source_url');
  if (value && !/^https?:\/\//i.test(value)) throw new Error('Quellen bitte als vollständige http(s)-Adresse angeben.');
  if (value) { try { new URL(value); } catch { throw new Error('Die Quellenadresse ist ungültig.'); } }
  return value;
};
function dateValue(v: FormValues, key: string, mandatory?: true): string;
function dateValue(v: FormValues, key: string, mandatory: false): string | null;
function dateValue(v: FormValues, key: string, mandatory = true) {
  const value = mandatory ? required(v, key) : optional(v, key);
  if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error('Bitte ein gültiges Datum eingeben.');
  return value;
}
type ParsedHistoryForm = { [K in HistoryEntity]: { entity: K; data: Omit<ElectionHistoryTables[typeof historyTables[K]]['Insert'], 'id'> } }[HistoryEntity];
export function parseHistoryForm(entity: HistoryEntity, v: FormValues): ParsedHistoryForm {
  const source_url = url(v);
  const notes = optional(v, 'notes');
  switch (entity) {
    case 'periods': {
      const starts_on = dateValue(v, 'starts_on', false);
      const ends_on = dateValue(v, 'ends_on', false);
      const election_date = dateValue(v, 'election_date', false);
      if ((election_date && starts_on && election_date > starts_on) || (starts_on && ends_on && ends_on < starts_on)) throw new Error('Wahltag und Legislaturzeitraum passen nicht zusammen.');
      const number = numberValue(v, 'number', 1);
      if (number === null) throw new Error('Bitte eine Legislatur-Nummer angeben.');
      if (v.is_current === true && v.is_published !== true) throw new Error('Die aktuelle Periode muss freigegeben sein.');
      return { entity, data: { number, name: required(v, 'name'), election_year: numberValue(v, 'election_year', 1900, 2200), election_date, starts_on, ends_on, is_current: v.is_current === true, is_published: v.is_published === true, source_url, notes } } as const;
    }
    case 'people': return { entity, data: { name: required(v, 'name'), biography: optional(v, 'biography'), history_complete: v.history_complete === true, source_url } } as const;
    case 'districts': {
      const district_number = numberValue(v, 'district_number', 1);
      let boundaries = null;
      if (optional(v, 'boundaries')) {
        try { boundaries = normalizeGeoJsonGeometry(JSON.parse(String(v.boundaries))); }
        catch { throw new Error('Die Wahlkreisgrenze ist kein gültiges GeoJSON.'); }
        if (!hasRenderableBoundary(boundaries)) throw new Error('Bitte eine WGS84-Polygon- oder MultiPolygon-Geometrie eingeben.');
      }
      return { entity, data: { period_id: required(v, 'period_id'), district_number, number_label: optional(v, 'number_label'), boundaries, name: required(v, 'name'), boundary_note: optional(v, 'boundary_note'), source_url } } as const;
    }
    case 'candidacies': {
      const ballot_type = required(v, 'ballot_type');
      const outcome = required(v, 'outcome');
      if (!['candidate','first_vote'].includes(ballot_type) || !['direct','list','not_elected','unknown'].includes(outcome)) throw new Error('Ungültige Kandidaturauswahl.');
      const data = { period_id: required(v, 'period_id'), person_id: required(v, 'person_id'), district_id: optional(v, 'district_id'), party: required(v, 'party'),
        votes: numberValue(v, 'votes', 0), vote_share: numberValue(v, 'vote_share', 0, 100, false), district_rank: numberValue(v, 'district_rank', 1), list_position: numberValue(v, 'list_position', 1),
        ballot_type: ballot_type as ElectionCandidacy['ballot_type'], outcome: outcome as ElectionCandidacy['outcome'], source_url, notes };
      if (!data.district_id && (data.votes !== null || data.vote_share !== null || data.district_rank !== null || outcome === 'direct')) throw new Error('Ein persönliches Wahlkreisergebnis braucht einen Wahlkreis.');
      return { entity, data } as const;
    }
    case 'mandates': {
      const starts_on = dateValue(v, 'starts_on', false);
      const ends_on = dateValue(v, 'ends_on', false);
      if (starts_on && ends_on && ends_on < starts_on) throw new Error('Das Mandatsende liegt vor dem Beginn.');
      const mandate_type = required(v, 'mandate_type'), entry_type = required(v, 'entry_type');
      if (!['direct','list'].includes(mandate_type) || !['election','succession'].includes(entry_type)) throw new Error('Ungültige Mandatsauswahl.');
      const district_id = optional(v, 'district_id');
      if (mandate_type === 'direct' && !district_id) throw new Error('Ein Direktmandat braucht einen Wahlkreis.');
      const person_id = optional(v, 'person_id');
      const person_name = optional(v, 'person_name');
      if (!person_id && !person_name) throw new Error('Bitte einen Namen oder eine verknüpfte Person angeben.');
      return { entity, data: { period_id: required(v, 'period_id'), person_id, person_name,
        original_mandate: optional(v, 'original_mandate'), party_label: optional(v, 'party_label'), left_early: v.left_early === true,
        district_id, candidacy_id: optional(v, 'candidacy_id'), party: required(v, 'party'),
        starts_on, ends_on, mandate_type: mandate_type as HistoricalMandate['mandate_type'], entry_type: entry_type as HistoricalMandate['entry_type'], source_url, notes } } as const;
    }
  }
}

/** Count distinct elections, never mandate segments or a succession as a re-election. */
export function personElectionSummary(data: ElectionHistoryData, personId: string) {
  const elected = data.mandates.filter(m => m.person_id === personId && m.entry_type === 'election');
  const elections = new Set(elected.map(m => m.period_id)).size;
  const directWins = new Set(data.candidacies.filter(c => c.person_id === personId && c.outcome === 'direct').map(c => c.period_id)).size;
  const complete = data.people.find(p => p.id === personId)?.history_complete === true;
  return { elections, directWins, reelections: complete ? Math.max(0, elections - 1) : null };
}
export function formatPersonalResult(result: ElectionCandidacy): string {
  const parts: string[] = [];
  if (result.vote_share !== null) parts.push(`${result.vote_share.toLocaleString('de-DE', { maximumFractionDigits: 3 })} %`);
  if (result.votes !== null) parts.push(`${result.votes.toLocaleString('de-DE')} Stimmen`);
  if (result.district_rank !== null) parts.push(`Platz ${result.district_rank}`);
  return parts.join(' · ') || 'Ergebnis noch nicht erfasst';
}
