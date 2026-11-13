import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';
import { useAuth } from '@/hooks/useAuth';
import { useAdministrationAccess } from '@/components/administration/useAdministrationAccess';
import { useElectionHistory, useElectionPeriods, useElectionPersonSearch, saveHistoryEntry, deleteHistoryEntry, historyError } from './useElectionHistory';
import { formatPersonalResult, type FormValues, type HistoryEntity } from './model';
import type { ElectionHistoryData } from './types';
import { ElectionHistoryAudit } from './ElectionHistoryAudit';
import { ElectionPeriodPreview } from './ElectionPeriodPreview';

const sections: Record<HistoryEntity, string> = { periods: 'Legislaturperioden', people: 'Personen', districts: 'Wahlkreise', candidacies: 'Kandidaturen & Ergebnisse', mandates: 'Mandate' };
type Field = { key: string; label: string; type?: 'text' | 'number' | 'date' | 'url' | 'textarea' | 'checkbox' | 'select'; required?: boolean; min?: number; max?: number; step?: string; help?: string };
const periodField: Field = { key: 'period_id', label: 'Legislaturperiode', type: 'select', required: true };
const personField: Field = { key: 'person_id', label: 'Person', type: 'select', required: true };
const districtField: Field = { key: 'district_id', label: 'Wahlkreis der Kandidatur / des Mandats', type: 'select', help: 'Bei reinen Listenkandidaturen ohne Wahlkreis leer lassen.' };
const partyField: Field = { key: 'party', label: 'Partei zum damaligen Zeitpunkt', required: true };
const notesField: Field = { key: 'notes', label: 'Anmerkungen', type: 'textarea' };
const fields: Record<HistoryEntity, Field[]> = {
  periods: [
    { key: 'number', label: 'Nummer der Legislaturperiode', type: 'number', min: 1, required: true },
    { key: 'name', label: 'Bezeichnung', required: true },
    { key: 'election_year', label: 'Wahljahr', type: 'number', min: 1900, max: 2200 },
    { key: 'election_date', label: 'Wahltag (falls bekannt)', type: 'date' },
    { key: 'starts_on', label: 'Beginn der Legislaturperiode (falls bekannt)', type: 'date' },
    { key: 'ends_on', label: 'Ende der Legislaturperiode', type: 'date' }, notesField,
    { key: 'is_published', label: 'Für alle Tenants freigeben', type: 'checkbox', help: 'Erst nach der Prüfung freigeben. Die aktuelle Periode muss freigegeben bleiben.' },
  ],
  people: [{ key: 'name', label: 'Vollständiger Name', required: true }, { key: 'biography', label: 'Kurzbiografie / Identifikationshinweis', type: 'textarea', help: 'Hilft, namensgleiche Personen auseinanderzuhalten.' },
    { key: 'history_complete', label: 'Mandatshistorie dieser Person vollständig geprüft', type: 'checkbox', help: 'Nur dann wird eine Zahl der Wiederwahlen ausgewiesen. Alle früheren gewählten Mandate müssen in freigegebenen Perioden erfasst sein.' }],
  districts: [periodField, { key: 'district_number', label: 'Gesicherte Wahlkreisnummer', type: 'number', min: 1 }, { key: 'number_label', label: 'Überlieferte Nummer (falls ungeklärt)' }, { key: 'name', label: 'Wahlkreisname in dieser Periode', required: true }, { key: 'boundary_note', label: 'Hinweis zu damaligen Grenzen / Änderungen', type: 'textarea' }, { key: 'boundaries', label: 'Historischer Umriss als GeoJSON', type: 'textarea', help: 'WGS84 Polygon oder MultiPolygon. Ohne belegten Umriss bleibt die historische Karte an dieser Stelle leer.' }],
  candidacies: [periodField, personField, districtField, partyField,
    { key: 'ballot_type', label: 'Art des persönlichen Wahlergebnisses', type: 'select', required: true, help: 'Das persönliche Wahlkreisergebnis gilt auch bei Listeneinzug. Parteizweitstimmen sind kein persönliches Kandidatenergebnis.' },
    { key: 'votes', label: 'Persönliche Stimmen im Wahlkreis', type: 'number', min: 0 },
    { key: 'vote_share', label: 'Persönlicher Stimmenanteil (%)', type: 'number', min: 0, max: 100, step: '0.001' },
    { key: 'district_rank', label: 'Platz im Wahlkreis', type: 'number', min: 1 },
    { key: 'list_position', label: 'Listenplatz (falls vorhanden)', type: 'number', min: 1 },
    { key: 'outcome', label: 'Wahlausgang', type: 'select', required: true }, notesField],
  mandates: [periodField, { key: 'person_name', label: 'Name des historischen Mandatsträgers' }, { ...personField, required: false, label: 'Bestätigte Personenverknüpfung (optional)' }, districtField, { key: 'candidacy_id', label: 'Zugehörige Kandidatur', type: 'select', help: 'Es werden nur Kandidaturen dieser Person und Periode angeboten.' }, partyField,
    { key: 'mandate_type', label: 'Mandatsart', type: 'select', required: true }, { key: 'entry_type', label: 'Eintritt in den Landtag', type: 'select', required: true },
    { key: 'original_mandate', label: 'Historische Mandatsbezeichnung' }, { key: 'party_label', label: 'Historische Partei-/Fraktionsangabe' },
    { key: 'left_early', label: 'Vorzeitig ausgeschieden', type: 'checkbox' },
    { key: 'starts_on', label: 'Tatsächlicher Mandatsbeginn (falls bekannt)', type: 'date' }, { key: 'ends_on', label: 'Tatsächliches Mandatsende', type: 'date' }, notesField],
};
const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
function optionsFor(key: string, data: ElectionHistoryData, values: FormValues): { value: string; label: string }[] {
  if (key === 'period_id') return data.periods.filter(p => !values.period_id || p.id === values.period_id).map(p => ({ value: p.id, label: p.name }));
  if (key === 'person_id') return data.people.map(p => ({ value: p.id, label: `${p.name}${p.biography ? ` · ${p.biography.slice(0, 60)}` : ''}` }));
  if (key === 'district_id') return data.districts.filter(d => d.period_id === values.period_id).sort((a, b) => (a.district_number ?? Infinity) - (b.district_number ?? Infinity)).map(d => ({ value: d.id, label: `${d.district_number ?? d.number_label ?? "–"}: ${d.name}` }));
  if (key === 'candidacy_id') return data.candidacies.filter(c => c.period_id === values.period_id && c.person_id === values.person_id).map(c => ({ value: c.id, label: `${c.party} · ${data.districts.find(d => d.id === c.district_id)?.name || 'ohne Wahlkreis'}` }));
  const entries: Record<string, [string, string][]> = {
    ballot_type: [['candidate', 'Kandidatenstimmen (bisheriges Wahlsystem)'], ['first_vote', 'Erststimmen (Zweistimmensystem)']],
    outcome: [['unknown', 'Noch nicht erfasst'], ['direct', 'Direkt gewählt'], ['list', 'Über Liste gewählt'], ['not_elected', 'Nicht gewählt']],
    mandate_type: [['direct', 'Direktmandat'], ['list', 'Listenmandat']], entry_type: [['election', 'Bei der Wahl gewählt'], ['succession', 'Nachgerückt']],
  };
  return (entries[key] || []).map(([value, label]) => ({ value, label }));
}
function rowValues(row: ElectionHistoryData[HistoryEntity][number]): FormValues {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === null ? '' : typeof value === 'boolean' ? value : typeof value === 'object' ? JSON.stringify(value) : String(value)]));
}

export default function ElectionHistoryAdmin() {
  const { user, loading } = useAuth();
  const access = useAdministrationAccess(user?.id, undefined, loading);
  if (access.checkingAdmin) return <p>Prüfe Berechtigung …</p>;
  if (!access.isSuperAdmin) return <p>Nur Super-Admins können zentrale Wahldaten verwalten.</p>;
  return <ElectionHistoryWorkspace />;
}
function ElectionHistoryWorkspace() {
  const periodQuery = useElectionPeriods();
  const cache = useQueryClient();
  const [entity, setEntity] = useState<HistoryEntity>('periods');
  const [periodFilter, setPeriodFilter] = useState('');
  const selectedPeriod = periodFilter || periodQuery.data?.find(p => p.is_current)?.id || periodQuery.data?.[0]?.id || '';
  const query = useElectionHistory(selectedPeriod);
  const [pageSize, setPageSize] = useState(25);
  const [personSearch, setPersonSearch] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const [values, setValues] = useState<FormValues>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [preview, setPreview] = useState(false);
  const personMatches = useElectionPersonSearch(entity === 'people' ? search : personSearch, entity === 'people' || editing !== undefined);
  const data: ElectionHistoryData | undefined = periodQuery.data && (!selectedPeriod || query.data) ? {
    ...(query.data || { periods: [], people: [], districts: [], candidacies: [], mandates: [] }),
    periods: periodQuery.data,
    people: [...new Map([...(query.data?.people || []), ...((entity === 'people' || editing !== undefined) ? personMatches.data || [] : [])].map(person => [person.id, person])).values()],
  } : undefined;
  const refresh = () => cache.invalidateQueries({ queryKey: ['election-history'] });
  if (periodQuery.isLoading || query.isLoading) return <p>Lade zentrale Wahldaten …</p>;
  if (periodQuery.error || query.error || !data) return <Card><CardHeader><CardTitle>Wahldatenbank</CardTitle></CardHeader><CardContent><p role="alert">{historyError(periodQuery.error || query.error)}</p><Button className="mt-3" onClick={() => void Promise.all([periodQuery.refetch(), query.refetch()])}>Erneut laden</Button></CardContent></Card>;
  const periodName = (id: string) => data.periods.find(p => p.id === id)?.name || '';
  const personName = (id: string) => data.people.find(p => p.id === id)?.name || '';
  const describe = (v: FormValues) => {
    if (entity === 'periods') return `${v.name} · ${v.is_published ? 'Freigegeben' : 'Entwurf'}${v.is_current ? ' · Aktuell' : ''}`;
    if (entity === 'people') return `${v.name}${v.biography ? ` · ${v.biography}` : ''}`;
    if (entity === 'districts') return `${v.district_number || v.number_label || '–'}: ${v.name} · ${periodName(String(v.period_id))}`;
    return `${personName(String(v.person_id)) || v.person_name || 'Name fehlt'} · ${v.party} · ${periodName(String(v.period_id))} · ${data.districts.find(d => d.id === v.district_id)?.name || 'ohne Wahlkreis'} · ${entity === 'mandates' ? `${v.mandate_type === 'direct' ? 'Direkt' : 'Liste'} (${v.entry_type === 'succession' ? 'nachgerückt' : 'gewählt'}) · ${v.starts_on || 'Beginn unbekannt'}–${v.ends_on || 'Ende unbekannt'}` : `${v.outcome === 'direct' ? 'Direkt gewählt' : v.outcome === 'list' ? 'Über Liste gewählt' : v.outcome === 'not_elected' ? 'Nicht gewählt' : 'Ausgang offen'}`}`;
  };
  const rows = data[entity].map(row => ({ id: row.id, values: rowValues(row) })).filter(row =>
    (entity === 'periods' || entity === 'people' || !periodFilter || row.values.period_id === periodFilter)
    && describe(row.values).toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))
  ).sort((a, b) => entity === 'periods' ? Number(b.values.number) - Number(a.values.number) : describe(a.values).localeCompare(describe(b.values), 'de', { numeric: true }));
  const startNew = () => {
    const period = data.periods.find(p => p.id === selectedPeriod) || data.periods.find(p => p.is_current) || data.periods[0];
    setValues({ period_id: period?.id || '', starts_on: entity === 'mandates' ? period?.starts_on || '' : '', is_current: false, is_published: false, history_complete: false,
      ballot_type: 'candidate', outcome: 'unknown', mandate_type: 'list', entry_type: 'election' });
    setEditing(null); setFormError('');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (saving) return;
    setSaving(true); setFormError('');
    try { await saveHistoryEntry(entity, values, editing || undefined); setEditing(undefined); await refresh(); notify.success('Zentrale Wahldaten gespeichert'); }
    catch (error) { setFormError(historyError(error)); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    if (saving || !window.confirm('Diesen zentralen Datensatz für alle Tenants löschen? Verwendete Datensätze können nicht gelöscht werden.')) return;
    setSaving(true);
    try { await deleteHistoryEntry(entity, id); await refresh(); notify.success('Datensatz gelöscht'); }
    catch (error) { notify.error(historyError(error)); }
    finally { setSaving(false); }
  };
  const makeCurrent = async (id: string) => {
    if (saving || !window.confirm('Diese freigegebene Legislaturperiode als aktuelle Kartenansicht für alle Tenants festlegen?')) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('set_current_election_history_period', { period: id });
      if (error) throw error;
      await refresh(); notify.success('Aktuelle Legislaturperiode geändert');
    } catch (error) { notify.error(historyError(error)); } finally { setSaving(false); }
  };
  const changeField = (key: string, value: string | boolean) => setValues(previous => {
    const next = { ...previous, [key]: value };
    if (key === 'period_id') {
      next.district_id = ''; next.candidacy_id = '';
      if (entity === 'mandates' && !editing) next.starts_on = data.periods.find(p => p.id === value)?.starts_on || '';
    }
    if (key === 'person_id') next.candidacy_id = '';
    if (key === 'candidacy_id') {
      const c = data.candidacies.find(c => c.id === value);
      if (c) { next.district_id = c.district_id || ''; next.party = c.party; if (c.outcome === 'direct' || c.outcome === 'list') next.mandate_type = c.outcome; }
    }
    return next;
  });
  return <div className="space-y-5">
    <div><h2 className="text-2xl font-semibold">Wahldaten & Mandatshistorie</h2><p className="mt-1 text-sm text-muted-foreground">Zentrale Daten für alle Tenants. Jeweils eine Legislatur auswählen. Importierte Mandate behalten ihre Namen; Personen werden erst nach Bestätigung verknüpft. Historische Umrisse lassen sich bei den damaligen Wahlkreisen ergänzen.</p></div>
    <Tabs value={entity} onValueChange={value => { setEntity(value as HistoryEntity); setEditing(undefined); setFormError(''); setSearch(''); setPageSize(25); setPersonSearch(''); }}>
      <TabsList className="h-auto flex flex-wrap justify-start gap-1">{Object.entries(sections).map(([key, label]) => <TabsTrigger disabled={saving} key={key} value={key}>{label} ({data[key as HistoryEntity].length})</TabsTrigger>)}</TabsList>
    </Tabs>
    <div className="flex flex-wrap items-end gap-3">
      <div><Label htmlFor="history-period-filter">Periode / Vorschau</Label><select id="history-period-filter" className={selectClass} value={selectedPeriod} disabled={saving} onChange={e => { setPeriodFilter(e.target.value); setEditing(undefined); setPageSize(25); setSearch(''); setPageSize(25); setPersonSearch(''); }}><option value="" disabled>Legislaturperiode auswählen</option>{data.periods.map(p => <option key={p.id} value={p.id}>{p.name}{p.is_published ? '' : ' · Entwurf'}</option>)}</select></div>
      <div className="flex-1"><Label htmlFor="history-search">Datensätze suchen</Label><Input id="history-search" value={search} onChange={e => { setSearch(e.target.value); setPageSize(25); }} placeholder="Name, Partei oder Wahlkreis …" /></div>
      <Button variant="outline" disabled={!selectedPeriod} onClick={() => setPreview(v => !v)}>{preview ? 'Vorschau schließen' : 'Periode prüfen'}</Button>
      <Button disabled={saving} onClick={startNew}>+ Neu anlegen</Button>
    </div>
    {preview && selectedPeriod && <ElectionPeriodPreview data={data} periodId={selectedPeriod} />}
    {editing !== undefined && <Card><CardHeader><CardTitle>{editing ? 'Datensatz bearbeiten' : `${sections[entity]}: neuer Datensatz`}</CardTitle></CardHeader><CardContent>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <fieldset disabled={saving} className="contents">
          {(entity === 'mandates' || entity === 'candidacies') && <div className="md:col-span-2"><Label htmlFor="history-person-search">Weitere Personen suchen</Label><Input id="history-person-search" value={personSearch} onChange={event => setPersonSearch(event.target.value)} placeholder="Mindestens 2 Anfangsbuchstaben · höchstens 20 Treffer" />{personMatches.error && <p role="alert" className="text-xs">Personensuche fehlgeschlagen.</p>}</div>}
          {fields[entity].map(field => <div key={field.key} className={field.type === 'textarea' || field.type === 'checkbox' ? 'md:col-span-2' : ''}>
            <Label htmlFor={`history-${field.key}`} className={field.type === 'checkbox' ? 'flex items-center gap-2' : ''}>
              {field.type === 'checkbox' && <input id={`history-${field.key}`} type="checkbox" checked={values[field.key] === true} onChange={e => changeField(field.key, e.target.checked)} />}
              {field.label}{field.required ? ' *' : ''}
            </Label>
            {field.type === 'select' ? <select id={`history-${field.key}`} className={selectClass} required={field.required} value={String(values[field.key] || '')} onChange={e => changeField(field.key, e.target.value)}><option value="">Bitte auswählen / keine Zuordnung</option>{optionsFor(field.key, data, values).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              : field.type === 'textarea' ? <Textarea id={`history-${field.key}`} value={String(values[field.key] || '')} onChange={e => changeField(field.key, e.target.value)} />
              : field.type !== 'checkbox' && <Input id={`history-${field.key}`} type={field.type || 'text'} required={field.required} min={field.min} max={field.max} step={field.step || (field.type === 'number' ? '1' : undefined)} value={String(values[field.key] ?? '')} onChange={e => changeField(field.key, e.target.value)} />}
            {field.help && <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>}
          </div>)}
          {formError && <p className="md:col-span-2 text-sm text-destructive" role="alert">{formError}</p>}
          <div className="md:col-span-2 flex gap-2"><Button type="submit">{saving ? 'Speichert …' : 'Speichern'}</Button><Button type="button" variant="outline" onClick={() => setEditing(undefined)}>Abbrechen</Button></div>
        </fieldset>
      </form>
    </CardContent></Card>}
    <Card><CardHeader><CardTitle>{sections[entity]} · {rows.length}</CardTitle></CardHeader><CardContent className="space-y-3">
      {!rows.length && <p className="text-sm text-muted-foreground">Noch keine passenden Datensätze. Es wurden keine Beispiel- oder Wahlergebnisse vorausgefüllt.</p>}
      {rows.slice(0, pageSize).map(row => <div key={row.id} className="flex flex-wrap items-start justify-between gap-2 border-b pb-3 last:border-0">
        <div className="min-w-0 flex-1"><p className="text-sm font-medium break-words">{describe(row.values)}</p>
          {entity === 'candidacies' && <p className="text-xs text-muted-foreground">{(() => { const candidate = data.candidacies.find(c => c.id === row.id); return candidate ? formatPersonalResult(candidate) : ''; })()}</p>}
          {row.values.source_url && <a href={String(row.values.source_url)} target="_blank" rel="noopener noreferrer" className="text-xs underline">Quelle</a>}
        </div>
        <div className="flex flex-wrap gap-2">
          {entity === 'periods' && row.values.is_published && !row.values.is_current && <Button size="sm" variant="outline" disabled={saving} onClick={() => void makeCurrent(row.id)}>Als aktuell festlegen</Button>}
          <Button size="sm" variant="outline" disabled={saving} onClick={() => { setValues(row.values); setEditing(row.id); setFormError(''); }}>Bearbeiten</Button>
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => void remove(row.id)}>Löschen</Button>
        </div>
      </div>)}
      {rows.length > pageSize && <Button variant="outline" onClick={() => setPageSize(size => size + 25)}>Weitere 25 anzeigen ({pageSize} von {rows.length})</Button>}
    </CardContent></Card>
    <ElectionHistoryAudit />
  </div>;
}
