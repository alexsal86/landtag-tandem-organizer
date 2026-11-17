import { seatBasisLabels } from '../periodSeats';
import { boundaryYearLabel } from '@/utils/electoralGeometryCatalog';
import { ELECTORAL_TOPOLOGY_MANIFESTS } from '@/utils/electoralTopologyAsset';
import type { ElectionHistoryData } from '../types';
import type { FormValues, HistoryEntity } from '../model';

export type GridEntity = Exclude<HistoryEntity, 'people'>;
export type Field = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'url' | 'textarea' | 'checkbox' | 'select' | 'seat_distribution' | 'faction';
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
  help?: string;
};

const sourceField: Field = { key: 'source_url', label: 'Quelle / Quellen-URL', type: 'url', help: 'Amtliche oder sonstig belegte Herkunft dieses Datensatzes.' };
const periodField: Field = { key: 'period_id', label: 'Legislaturperiode', type: 'select', required: true };
const personField: Field = { key: 'person_id', label: 'Zugeordnete Person', type: 'select' };
const districtField: Field = { key: 'district_id', label: 'Wahlkreis', type: 'select', help: 'Bei reinen Listenkandidaturen ohne Wahlkreis leer lassen.' };
const partyField: Field = { key: 'party', label: 'Partei / Fraktion zum damaligen Zeitpunkt', type: 'faction', required: true };
const notesField: Field = { key: 'notes', label: 'Anmerkungen', type: 'textarea' };

export const gridFields: Record<GridEntity, Field[]> = {
  periods: [
    { key: 'number', label: 'Nummer', type: 'number', min: 1, required: true },
    { key: 'name', label: 'Bezeichnung', required: true },
    { key: 'election_year', label: 'Wahljahr', type: 'number', min: 1900, max: 2200 },
    { key: 'seat_total', label: 'Gesamtsitze', type: 'number', min: 1, max: 1000 },
    { key: 'seat_distribution', label: 'Sitze nach Partei / Fraktion', type: 'seat_distribution' },
    { key: 'seat_basis', label: 'Bezugsstand der Sitzzahlen', type: 'select' },
    { key: 'seat_reference_date', label: 'Stichtag der Sitzverteilung (optional)', type: 'date' },
    { key: 'seat_source_url', label: 'Quelle der Sitzzahlen', type: 'url' },
    { key: 'seat_notes', label: 'Hinweise zur Sitzverteilung', type: 'textarea' },
    { key: 'election_date', label: 'Wahltag', type: 'date' },
    { key: 'starts_on', label: 'Beginn', type: 'date' },
    { key: 'ends_on', label: 'Ende', type: 'date' },
    { key: 'ends_on_is_expected', label: 'Endtermin ist voraussichtlich', type: 'checkbox' },
    { key: 'expected_ends_on', label: 'Voraussichtliches reguläres Ende (separat)', type: 'date' },
    { key: 'boundary_geometry_year', label: 'Historischer Grenzstand', type: 'select', help: 'Nur die für dieses Wahljahr freigegebenen Grenzstände werden angeboten.' },
    { key: 'boundary_geometry_confirmed', label: 'Grenzstand und Wahlkreisnummern ausdrücklich geprüft', type: 'checkbox', help: 'Die Bestätigung wird bei einer Änderung von Wahljahr oder Grenzstand zurückgesetzt.' },
    { key: 'is_published', label: 'Für alle Tenants freigeben', type: 'checkbox', help: 'Die aktuelle Periode muss freigegeben bleiben.' },
    sourceField, notesField,
  ],
  districts: [
    periodField,
    { key: 'district_number', label: 'Wahlkreisnummer', type: 'number', min: 1 },
    { key: 'number_label', label: 'Historische / regionale Nummer', help: '1952 etwa SB 1; technische IDs sind keine historischen Nummern.' },
    { key: 'name', label: 'Amtlicher Name in dieser Periode', required: true },
    { key: 'boundary_note', label: 'Hinweis zu damaligen Grenzen / Änderungen', type: 'textarea' },
    { key: 'boundaries', label: 'Individueller historischer Umriss als GeoJSON', type: 'textarea', help: 'Nur bei einem individuell belegten Umriss. Vorhandene gemeinsam genutzte Grenzstände bleiben unverändert.' },
    sourceField,
  ],
  mandates: [
    periodField,
    { key: 'person_name', label: 'Historischer Name im Mandat' },
    { ...personField, label: 'Bestätigte zentrale Person (optional)' },
    districtField,
    { key: 'candidacy_id', label: 'Zugehörige Kandidatur', type: 'select', help: 'Nur Kandidaturen derselben Person und Periode.' },
    partyField,
    { key: 'mandate_type', label: 'Mandatsart', type: 'select', required: true },
    { key: 'entry_type', label: 'Eintritt', type: 'select', required: true },
    { key: 'original_mandate', label: 'Historische Quellenbezeichnung' },
    { key: 'party_label', label: 'Historische Partei-/Fraktionszuordnung', type: 'faction' },
    { key: 'starts_on', label: 'Tatsächlicher Mandatsbeginn', type: 'date' },
    { key: 'ends_on', label: 'Tatsächliches Mandatsende', type: 'date' },
    { key: 'left_early', label: 'Vorzeitig ausgeschieden', type: 'checkbox' },
    sourceField, notesField,
  ],
  candidacies: [
    periodField,
    { ...personField, required: true, label: 'Kandidierende Person' },
    districtField,
    partyField,
    { key: 'ballot_type', label: 'Stimmenart', type: 'select', required: true },
    { key: 'votes', label: 'Persönliche Stimmen', type: 'number', min: 0 },
    { key: 'vote_share', label: 'Stimmenanteil (%)', type: 'number', min: 0, max: 100, step: '0.00001' },
    { key: 'district_rank', label: 'Platz im Wahlkreis', type: 'number', min: 1 },
    { key: 'list_position', label: 'Listenplatz', type: 'number', min: 1 },
    { key: 'outcome', label: 'Wahlausgang', type: 'select', required: true },
    sourceField, notesField,
  ],
};

export const gridSections: Record<GridEntity, string> = {
  periods: 'Legislaturperioden', districts: 'Wahlkreise', mandates: 'Abgeordnete & Mandate', candidacies: 'Kandidaturen & Ergebnisse',
};

export function rowValues(row: ElectionHistoryData[HistoryEntity][number]): FormValues {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === null ? '' : typeof value === 'boolean' ? value : typeof value === 'object' ? JSON.stringify(value) : String(value)]));
}

export function optionsFor(key: string, data: ElectionHistoryData, values: FormValues): { value: string; label: string }[] {
  if (key === 'seat_basis') return Object.entries(seatBasisLabels).map(([value, label]) => ({ value, label }));
  if (key === 'boundary_geometry_year') return Object.keys(ELECTORAL_TOPOLOGY_MANIFESTS).sort((a, b) => Number(a) - Number(b)).map(year => ({ value: year, label: `Grenzen ${boundaryYearLabel(Number(year))}` }));
  if (key === 'period_id') return data.periods.filter(period => !values.period_id || period.id === values.period_id).map(period => ({ value: period.id, label: period.name }));
  if (key === 'person_id') return data.people.map(person => ({ value: person.id, label: `${person.name}${person.biography ? ` · ${person.biography.slice(0, 60)}` : ''}` }));
  if (key === 'district_id') return data.districts.filter(district => district.period_id === values.period_id).sort((a, b) => (a.district_number ?? Infinity) - (b.district_number ?? Infinity)).map(district => ({ value: district.id, label: `${district.district_number ?? district.number_label ?? '–'}: ${district.name}` }));
  if (key === 'candidacy_id') return data.candidacies.filter(candidacy => candidacy.period_id === values.period_id && candidacy.person_id === values.person_id).map(candidacy => ({ value: candidacy.id, label: `${candidacy.party} · ${data.districts.find(district => district.id === candidacy.district_id)?.name || 'ohne Wahlkreis'}` }));
  const entries: Record<string, [string, string][]> = {
    ballot_type: [['candidate', 'Kandidatenstimmen (bisheriges Wahlsystem)'], ['first_vote', 'Erststimmen (Zweistimmensystem)']],
    outcome: [['unknown', 'Noch nicht erfasst'], ['direct', 'Direkt gewählt'], ['list', 'Über Liste gewählt'], ['not_elected', 'Nicht gewählt']],
    mandate_type: [['direct', 'Direktmandat'], ['list', 'Listenmandat']],
    entry_type: [['election', 'Bei der Wahl gewählt'], ['succession', 'Nachgerückt']],
  };
  return (entries[key] || []).map(([value, label]) => ({ value, label }));
}
