import { candidacyResultOrigin } from '../candidateResults';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, CircleCheck, FilePenLine, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui-patterns';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';
import { useAuth } from '@/hooks/useAuth';
import { useElectionEditorDrafts } from '../editorDrafts';
import { deleteHistoryEntry, historyError, saveHistoryEntry, useElectionPersonSearch, type ElectionPeriodOverview } from '../useElectionHistory';
import { formatHistoryDateInput, formatMandateDateRange, type FormValues } from '../model';
import { formatMandateType } from '../mandateLabel';
import type { ElectionCandidacy, ElectionHistoryData, ElectionPeriod, HistoricalDistrict, HistoricalMandate } from '../types';
import { HistoricalGeometryNotice } from '../HistoricalGeometryNotice';
import { gridFields, gridSections, optionsFor, rowValues, type Field, type GridEntity } from './historyFields';
import { candidacyQualityIssues, districtQualityIssues, mandateQualityIssues, rowSearchText } from './historyQuality';

type GridRow = ElectionPeriod | HistoricalDistrict | HistoricalMandate | ElectionCandidacy;
type Column = { key: string; label: string; fieldKey?: string; className?: string };

const columns: Record<GridEntity, Column[]> = {
  periods: [
    { key: 'number', label: 'LP', fieldKey: 'number', className: 'w-16' },
    { key: 'name', label: 'Bezeichnung', fieldKey: 'name' },
    { key: 'election_year', label: 'Wahljahr', fieldKey: 'election_year' },
    { key: 'election_date', label: 'Wahltag', fieldKey: 'election_date' },
    { key: 'starts_on', label: 'Beginn', fieldKey: 'starts_on' },
    { key: 'ends_on', label: 'Ende', fieldKey: 'ends_on' },
    { key: 'counts', label: 'Datenbestand' },
    { key: 'status', label: 'Status' },
    { key: 'quality', label: 'Prüfung' },
  ],
  districts: [
    { key: 'district_number', label: 'Nr.', fieldKey: 'district_number', className: 'w-20' },
    { key: 'number_label', label: 'Historische Nr.', fieldKey: 'number_label' },
    { key: 'name', label: 'Amtlicher Name', fieldKey: 'name' },
    { key: 'winner', label: 'Direktmandat' },
    { key: 'other_mandates', label: 'Weitere Mandate' },
    { key: 'geometry', label: 'Grenzstand' },
    { key: 'quality', label: 'Prüfung' },
  ],
  mandates: [
    { key: 'person_name', label: 'Name', fieldKey: 'person_name' },
    { key: 'party', label: 'Partei', fieldKey: 'party' },
    { key: 'mandate_type', label: 'Mandat', fieldKey: 'mandate_type' },
    { key: 'district_id', label: 'Wahlkreis', fieldKey: 'district_id' },
    { key: 'entry_type', label: 'Eintritt', fieldKey: 'entry_type' },
    { key: 'starts_on', label: 'Beginn', fieldKey: 'starts_on' },
    { key: 'ends_on', label: 'Ende', fieldKey: 'ends_on' },
    { key: 'quality', label: 'Prüfung' },
  ],
  candidacies: [
    { key: 'person_id', label: 'Person', fieldKey: 'person_id' },
    { key: 'party', label: 'Partei', fieldKey: 'party' },
    { key: 'district_id', label: 'Wahlkreis', fieldKey: 'district_id' },
    { key: 'votes', label: 'Stimmen', fieldKey: 'votes' },
    { key: 'vote_share', label: '%', fieldKey: 'vote_share' },
    { key: 'district_rank', label: 'Platz', fieldKey: 'district_rank' },
    { key: 'outcome', label: 'Ausgang', fieldKey: 'outcome' },
    { key: 'result_origin', label: 'Ergebnisquelle' },
    { key: 'quality', label: 'Prüfung' },
  ],
};

function dateLabel(value: string | null) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString('de-DE') : '–';
}

interface Props {
  entity: GridEntity;
  data: ElectionHistoryData;
  selectedPeriodId: string;
  overview: ElectionPeriodOverview[];
  initialEditId?: string;
  onOpenPeriod?: (periodId: string) => void;
}

export function HistoryDataGrid({ entity, data, selectedPeriodId, overview, onOpenPeriod, initialEditId = '' }: Props) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const drafts = useElectionEditorDrafts(user?.id || '');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(100);
  const initialRow = data[entity].find(row => row.id === initialEditId);
  const [editing, setEditing] = useState<string | null | undefined>(initialRow?.id);
  const [values, setValues] = useState<FormValues>(() => initialRow ? drafts.get(entity, initialRow.id, entity === 'periods' ? initialRow.id : selectedPeriodId)?.values || rowValues(initialRow) : {});
  const [personSearch, setPersonSearch] = useState('');
  useEffect(() => {
    if (editing === undefined) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(`history-editor-${entity}-${editing || 'new'}`)?.scrollIntoView({ block: 'start' }));
    return () => window.cancelAnimationFrame(frame);
  }, [editing, entity]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const personMatches = useElectionPersonSearch(personSearch, editing !== undefined && (entity === 'mandates' || entity === 'candidacies'));
  const viewData = useMemo<ElectionHistoryData>(() => ({
    ...data,
    people: [...new Map([...data.people, ...(personMatches.data || [])].map(person => [person.id, person])).values()],
  }), [data, personMatches.data]);
  const allRows = data[entity] as GridRow[];
  const rows = allRows.filter(row => {
    if (entity !== 'periods' && (row as HistoricalDistrict | HistoricalMandate | ElectionCandidacy).period_id !== selectedPeriodId) return false;
    return rowSearchText(entity, viewData, row.id).toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE'));
  }).sort((a, b) => {
    if (entity === 'periods') return (b as ElectionPeriod).number - (a as ElectionPeriod).number;
    if (entity === 'districts') return ((a as HistoricalDistrict).district_number ?? Infinity) - ((b as HistoricalDistrict).district_number ?? Infinity) || (a as HistoricalDistrict).name.localeCompare((b as HistoricalDistrict).name, 'de');
    return rowSearchText(entity, viewData, a.id).localeCompare(rowSearchText(entity, viewData, b.id), 'de', { numeric: true });
  });
  const visibleRows = rows.slice(0, pageSize);
  const activeRow = editing ? allRows.find(row => row.id === editing) : undefined;
  if (activeRow && !visibleRows.some(row => row.id === activeRow.id)) visibleRows.unshift(activeRow);
  const editorFields = gridFields[entity];
  const currentPeriod = data.periods.find(period => period.id === selectedPeriodId);
  const overviewByPeriod = new Map(overview.map(row => [row.period_id, row]));

  const refresh = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ['election-history'] }),
      cache.invalidateQueries({ queryKey: ['election-research'] }),
    ]);
  };
  const startNew = () => {
    setValues({
      period_id: selectedPeriodId, starts_on: '', ends_on: '', start_from_period: false, end_from_period: false,
      is_current: false, is_published: false, ballot_type: (currentPeriod?.election_year || 0) >= 2026 ? 'first_vote' : 'candidate',
      outcome: 'unknown', mandate_type: 'list', entry_type: 'election', boundaries: '', source_url: '',
    });
    setEditing(null); setError(''); setPersonSearch('');
  };
  const startEdit = (row: GridRow) => {
    const periodId = entity === 'periods' ? row.id : String((row as HistoricalDistrict).period_id);
    const draft = drafts.get(entity, row.id, periodId);
    setValues(draft?.values || rowValues(row));
    setEditing(row.id); setError(''); setPersonSearch('');
  };
  const cancel = () => {
    if (editing !== undefined) {
      const periodId = entity === 'periods' ? editing || selectedPeriodId : String(values.period_id || selectedPeriodId);
      drafts.remove(entity, editing, periodId);
    }
    setEditing(undefined); setValues({}); setError(''); setPersonSearch('');
  };
  const changeField = (key: string, value: string | boolean) => {
    const next = { ...values, [key]: value };
    if (key === 'boundary_geometry_year' || key === 'election_year') next.boundary_geometry_confirmed = false;
    if (key === 'period_id') { next.district_id = ''; next.candidacy_id = ''; }
    if (key === 'starts_on') next.start_from_period = false;
    if (key === 'ends_on') next.end_from_period = false;
    if (key === 'entry_type' && value === 'succession' && values.start_from_period === true) { next.starts_on = ''; next.start_from_period = false; }
    if (key === 'left_early' && value === true && values.end_from_period === true) { next.ends_on = ''; next.end_from_period = false; }
    if (key === 'person_id') next.candidacy_id = '';
    if (key === 'candidacy_id') {
      const candidacy = viewData.candidacies.find(item => item.id === value);
      if (candidacy) {
        next.district_id = candidacy.district_id || ''; next.party = candidacy.party;
        if (candidacy.outcome === 'direct' || candidacy.outcome === 'list') next.mandate_type = candidacy.outcome;
      }
    }
    setValues(next);
    const periodId = entity === 'periods' ? editing || selectedPeriodId : String(next.period_id || selectedPeriodId);
    drafts.put({ entity, id: editing ?? null, periodId, values: next });
  };
  const save = async () => {
    if (saving || editing === undefined) return;
    setSaving(true); setError('');
    try {
      await saveHistoryEntry(entity, values, editing || undefined);
      const periodId = entity === 'periods' ? editing || selectedPeriodId : String(values.period_id || selectedPeriodId);
      drafts.remove(entity, editing, periodId, values);
      setEditing(undefined); setValues({});
      await refresh();
      notify.success(`${gridSections[entity]} gespeichert`);
    } catch (failure) { setError(historyError(failure)); }
    finally { setSaving(false); }
  };
  const remove = async (row: GridRow) => {
    if (saving || !window.confirm('Diesen zentralen Datensatz für alle Tenants löschen? Verwendete Datensätze können nicht gelöscht werden.')) return;
    setSaving(true); setError('');
    try {
      await deleteHistoryEntry(entity, row.id); await refresh(); notify.success('Datensatz gelöscht');
      if (editing === row.id) setEditing(undefined);
    } catch (failure) { setError(historyError(failure)); }
    finally { setSaving(false); }
  };
  const makeCurrent = async (periodId: string) => {
    if (saving || !window.confirm('Diese freigegebene Legislaturperiode als aktuelle Ansicht für alle Tenants festlegen?')) return;
    setSaving(true); setError('');
    try {
      const { error: rpcError } = await supabase.rpc('set_current_election_history_period', { period: periodId });
      if (rpcError) throw rpcError;
      await refresh(); notify.success('Aktuelle Legislaturperiode geändert');
    } catch (failure) { setError(historyError(failure)); }
    finally { setSaving(false); }
  };

  const qualityIssues = (row: GridRow): string[] => {
    if (entity === 'periods') return (row as ElectionPeriod).source_url ? [] : ['Quelle fehlt'];
    if (entity === 'districts') return districtQualityIssues(row as HistoricalDistrict, data.mandates);
    if (entity === 'mandates') return mandateQualityIssues(row as HistoricalMandate);
    return candidacyQualityIssues(row as ElectionCandidacy);
  };
  const personName = (id: string | null, fallback?: string | null) => viewData.people.find(person => person.id === id)?.name || fallback || 'Nicht zugeordnet';
  const districtName = (id: string | null) => {
    const district = viewData.districts.find(item => item.id === id);
    return district ? `${district.district_number ?? district.number_label ?? '–'}: ${district.name}` : 'Ohne Wahlkreis';
  };
  const displayCell = (key: string, row: GridRow) => {
    if (key === 'quality') {
      const issues = qualityIssues(row);
      return issues.length ? <span className="inline-flex items-center gap-1 text-warning-foreground" title={issues.join(' · ')}><AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" /><span className="text-caption">{issues.length}</span><span className="sr-only">{issues.join(', ')}</span></span> : <Check className="h-4 w-4 text-success" aria-label="Keine offene Standardprüfung" />;
    }
    if (entity === 'periods') {
      const period = row as ElectionPeriod;
      if (key === 'counts') {
        const count = overviewByPeriod.get(period.id);
        return count ? <span className="text-caption tabular-nums">{count.district_count} WK · {count.mandate_count} Mandate · {count.candidacy_count} Kand.</span> : 'Zähler laden …';
      }
      if (key === 'status') return <span className="inline-flex flex-wrap items-center gap-1">{period.is_published ? <CircleCheck className="h-4 w-4 text-success" aria-hidden="true" /> : <FilePenLine className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}{period.is_current ? 'Aktuell' : period.is_published ? 'Freigegeben' : 'Entwurf'}</span>;
      if (['election_date', 'starts_on', 'ends_on', 'expected_ends_on'].includes(key)) return <span className="tabular-nums">{formatHistoryDateInput(String(period[key as keyof ElectionPeriod] || '')) || '–'}</span>;
      return String(period[key as keyof ElectionPeriod] ?? '–');
    }
    if (entity === 'districts') {
      const district = row as HistoricalDistrict;
      if (key === 'winner' || key === 'other_mandates') {
        const mandates = data.mandates.filter(mandate => mandate.period_id === district.period_id && mandate.district_id === district.id
          && (key === 'winner' ? mandate.mandate_type === 'direct' : mandate.mandate_type !== 'direct'));
        return mandates.length ? <ul className="space-y-2">{mandates.map(mandate => <li key={mandate.id}>
          <p>{personName(mandate.person_id, mandate.person_name)} ({mandate.party})</p>
          <p className="text-caption text-muted-foreground">{formatMandateType(mandate.mandate_type)}{mandate.entry_type === 'succession' ? ' · nachgerückt' : ''}</p>
          <p className="text-caption text-muted-foreground">{formatMandateDateRange(mandate)}</p>
        </li>)}</ul> : key === 'winner' ? 'Noch nicht zugeordnet' : 'Keine weiteren Mandate zugeordnet';
      }
      if (key === 'geometry') {
        if (district.boundaries) return 'Eigener Umriss';
        if (district.geometry_source_key) return 'Regionale Quelle';
        const period = data.periods.find(item => item.id === district.period_id);
        return period?.boundary_geometry_confirmed && period.boundary_geometry_year ? `Grenzstand ${period.boundary_geometry_year}` : 'Nicht belegt';
      }
      return String(district[key as keyof HistoricalDistrict] ?? '–');
    }
    if (entity === 'mandates') {
      const mandate = row as HistoricalMandate;
      if (key === 'person_name') return <div><p>{personName(mandate.person_id, mandate.person_name)}</p>{mandate.person_id && mandate.person_name && mandate.person_name !== personName(mandate.person_id) && <p className="text-caption text-muted-foreground">Historisch: {mandate.person_name}</p>}</div>;
      if (key === 'district_id') return districtName(mandate.district_id);
      if (key === 'mandate_type') return formatMandateType(mandate.mandate_type);
      if (key === 'entry_type') return mandate.entry_type === 'succession' ? 'Nachgerückt' : 'Bei der Wahl';
      if (key === 'starts_on' || key === 'ends_on') return <span title={formatMandateDateRange(mandate)}>{dateLabel(mandate[key])}</span>;
      return String(mandate[key as keyof HistoricalMandate] ?? '–');
    }
    const candidacy = row as ElectionCandidacy;
    if (key === 'person_id') return personName(candidacy.person_id);
    if (key === 'district_id') return districtName(candidacy.district_id);
    if (key === 'votes') return candidacy.votes?.toLocaleString('de-DE') ?? '–';
    if (key === 'result_origin') {
      const origin = candidacyResultOrigin(candidacy);
      return <span title={[candidacy.result_data_release, candidacy.result_notes].filter(Boolean).join(' · ')}>{({ automatic: 'Automatisch', mixed: 'Automatisch / persönlich erfasst', manual: 'Persönlich erfasst', missing: 'Ergebnis fehlt' })[origin]}{candidacy.result_origin === 'district_result' ? ` · ${candidacy.result_preliminary ? 'vorläufig' : 'als endgültig geführt'}` : ''}</span>;
    }
    if (key === 'vote_share') return candidacy.vote_share === null ? '–' : `${candidacy.vote_share.toLocaleString('de-DE', { maximumFractionDigits: 5 })} %`;
    if (key === 'outcome') return ({ direct: 'Direkt gewählt', list: 'Über Liste', not_elected: 'Nicht gewählt', unknown: 'Offen' })[candidacy.outcome];
    return String(candidacy[key as keyof ElectionCandidacy] ?? '–');
  };

  const fieldInput = (field: Field) => {
    const id = `grid-${entity}-${editing || 'new'}-${field.key}`;
    const common = { id, disabled: saving, 'aria-label': field.label };
    if (field.type === 'select') return <select {...common} className="h-9 min-w-0 w-full max-w-full rounded-md border border-input bg-background px-2 text-sm" required={field.required} value={String(values[field.key] ?? '')} onChange={event => changeField(field.key, event.target.value)}><option value="">Bitte auswählen / keine Zuordnung</option>{optionsFor(field.key, viewData, values).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
    if (field.type === 'textarea') return <Textarea {...common} className="min-h-20 min-w-0 max-w-full" value={String(values[field.key] ?? '')} onChange={event => changeField(field.key, event.target.value)} />;
    if (entity === 'periods' && field.type === 'date') return <Input {...common} type="text" inputMode="numeric" lang="de" placeholder="TT.MM.JJJJ" pattern="[0-9]{2}\.[0-9]{2}\.[0-9]{4}" title="Datum im Format TT.MM.JJJJ" maxLength={10} required={field.required} className="h-9 min-w-0 w-full max-w-full tabular-nums" value={formatHistoryDateInput(String(values[field.key] || ''))} onChange={event => changeField(field.key, event.target.value)} />;
    if (field.type === 'checkbox') return <input {...common} type="checkbox" className="h-4 w-4 accent-primary" checked={values[field.key] === true} onChange={event => changeField(field.key, event.target.checked)} />;
    return <Input {...common} type={field.type || 'text'} required={field.required} min={field.min} max={field.max} step={field.step || (field.type === 'number' ? '1' : undefined)} className="h-9 min-w-0 w-full max-w-full" value={String(values[field.key] ?? '')} onChange={event => changeField(field.key, event.target.value)} />;
  };
  const editorDetails = editing !== undefined ? <TableRow id={`history-editor-${entity}-${editing || 'new'}`} className="block scroll-mt-24 bg-muted/30 hover:bg-muted/30 xl:table-row"><TableCell colSpan={columns[entity].length + 1} className="block min-w-0 w-full p-3 xl:table-cell">
    <div className="min-w-0 space-y-3">
      {(entity === 'mandates' || entity === 'candidacies') && <div className="max-w-md"><Label htmlFor={`person-search-${entity}`}>Weitere zentrale Personen suchen</Label><Input id={`person-search-${entity}`} value={personSearch} disabled={saving} onChange={event => setPersonSearch(event.target.value)} placeholder="Mindestens 2 Anfangsbuchstaben · höchstens 20 Treffer" />{personMatches.error && <p role="alert" className="mt-1 text-caption text-destructive">Personensuche fehlgeschlagen.</p>}</div>}
      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">{editorFields.map(field => <div key={field.key} className={field.type === 'textarea' ? 'min-w-0 md:col-span-2 2xl:col-span-3' : 'min-w-0'}>
        <Label htmlFor={`grid-${entity}-${editing || 'new'}-${field.key}`} className={field.type === 'checkbox' ? 'flex items-center gap-2' : ''}>{field.type === 'checkbox' && fieldInput(field)}{field.label}{field.required ? ' *' : ''}</Label>
        {field.type !== 'checkbox' && fieldInput(field)}
        {entity === 'mandates' && (field.key === 'starts_on' || field.key === 'ends_on') && <p className="mt-1 text-caption text-muted-foreground">{values[field.key === 'starts_on' ? 'start_from_period' : 'end_from_period'] === true ? 'Aus der Legislaturperiode übernommen.' : field.key === 'starts_on' ? 'Nachrücker benötigen ihr eigenes Eintrittsdatum.' : 'Leer: Periodenende übernehmen, sofern kein vorzeitiger Austritt bekannt ist.'}</p>}
        {field.help && <p className="mt-1 text-caption text-muted-foreground">{field.help}</p>}
      </div>)}</div>
      {entity === 'periods' && <HistoricalGeometryNotice year={Number(values.election_year) || null} />}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2"><Button disabled={saving} onClick={() => void save()}><Save className="mr-2 h-4 w-4" aria-hidden="true" />{saving ? 'Speichert …' : 'Speichern'}</Button><Button variant="outline" disabled={saving} onClick={cancel}>Verwerfen</Button></div>
    </div>
  </TableCell></TableRow> : null;

  return <section className="min-w-0 w-full max-w-full space-y-3" aria-label={`${gridSections[entity]} bearbeiten`}>
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 w-full flex-1 sm:min-w-56"><Label htmlFor={`grid-search-${entity}`}>In {rows.length} Datensätzen suchen</Label><Input id={`grid-search-${entity}`} type="search" value={search} onChange={event => { setSearch(event.target.value); setPageSize(100); }} placeholder="Name, Partei, Wahlkreis oder Nummer …" /></div>
      <Button onClick={startNew} disabled={saving || (entity !== 'periods' && !selectedPeriodId)}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />Neu anlegen</Button>
    </div>
    {drafts.storageFailed && <p role="alert" className="text-sm text-destructive">Der Browser kann Eingaben nicht zwischenspeichern. Bitte zeitnah speichern.</p>}
    {drafts.drafts.filter(draft => draft.entity === entity && (entity === 'periods' || draft.periodId === selectedPeriodId)).length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-2 text-caption"><span>Browserentwürfe:</span>{drafts.drafts.filter(draft => draft.entity === entity && (entity === 'periods' || draft.periodId === selectedPeriodId)).map(draft => <Button key={`${draft.id}:${draft.periodId}`} size="sm" variant="outline" className="h-auto max-w-full whitespace-normal break-words" disabled={saving} onClick={() => { setValues(draft.values); setEditing(draft.id); setError(''); }}>{String(draft.values.name || draft.values.person_name || 'Datensatz')} wiederherstellen</Button>)}</div>}
    {error && editing === undefined && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {editing !== undefined && <div role="group" aria-label="Bearbeitung speichern oder verwerfen" className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card p-3 shadow-sm">
      <p className="text-sm font-medium">{editing === null ? 'Neuer Datensatz' : 'Datensatz bearbeiten'}</p>
      <div className="flex flex-wrap gap-2"><Button disabled={saving} onClick={() => void save()}><Save className="mr-2 h-4 w-4" aria-hidden="true" />{saving ? 'Speichert …' : 'Speichern'}</Button><Button variant="outline" disabled={saving} onClick={cancel}>Verwerfen</Button></div>
    </div>}
    <div className="min-w-0 w-full max-w-full overflow-hidden rounded-md border bg-card">
      <Table className="block w-full max-w-full table-fixed xl:table [&_td]:[overflow-wrap:anywhere] [&_th]:[overflow-wrap:anywhere]">
        <TableHeader className="hidden xl:table-header-group"><TableRow>{columns[entity].map(column => <TableHead key={column.key} className={`h-9 px-2 text-caption ${column.className || ''}`}>{column.label}</TableHead>)}<TableHead className="w-28 px-2 text-caption">Aktionen</TableHead></TableRow></TableHeader>
        <TableBody className="block xl:table-row-group">
          {editing === null && <><TableRow className="block bg-primary/5 hover:bg-primary/5 xl:table-row"><TableCell colSpan={columns[entity].length + 1} className="block p-3 font-medium xl:table-cell">Neuer Datensatz</TableCell></TableRow>{editorDetails}</>}
          {visibleRows.map(row => {
            const isEditing = editing === row.id;
            const issues = qualityIssues(row);
            return <Fragment key={row.id}>{<TableRow className={`grid min-w-0 grid-cols-1 sm:grid-cols-2 xl:table-row ${isEditing ? 'bg-primary/5 hover:bg-primary/5' : issues.length ? 'bg-warning/5' : ''}`}>{columns[entity].map(column => <TableCell key={column.key} className="block min-w-0 p-2 align-top xl:table-cell"><span className="mb-1 block text-caption font-medium text-muted-foreground xl:hidden">{column.label}</span>{displayCell(column.key, row)}</TableCell>)}<TableCell className="block min-w-0 p-2 align-top xl:table-cell"><span className="mb-1 block text-caption font-medium text-muted-foreground xl:hidden">Aktionen</span><div className="flex flex-wrap gap-1">
              {isEditing ? <><Button size="icon" className="h-8 w-8" aria-label="Änderungen speichern" disabled={saving} onClick={() => void save()}><Save className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Bearbeitung verwerfen" disabled={saving} onClick={cancel}><X className="h-4 w-4" /></Button></> : <>
                {entity === 'periods' && onOpenPeriod && <Button size="sm" variant="outline" className="h-8" onClick={() => onOpenPeriod(row.id)}>Öffnen</Button>}
                {entity === 'periods' && (row as ElectionPeriod).is_published && !(row as ElectionPeriod).is_current && <Button size="sm" variant="ghost" className="h-8" disabled={saving} onClick={() => void makeCurrent(row.id)}>Aktuell</Button>}
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Datensatz bearbeiten" disabled={saving} onClick={() => startEdit(row)}><Pencil className="h-4 w-4" /></Button>
              </>}
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Datensatz löschen" disabled={saving} onClick={() => void remove(row)}><Trash2 className="h-4 w-4" /></Button>
            </div></TableCell></TableRow>}{isEditing && editorDetails}</Fragment>;
          })}
        </TableBody>
      </Table>
      {!visibleRows.length && editing !== null && <EmptyState size="sm" title="Keine passenden Datensätze" description={search ? 'Suche anpassen oder einen neuen Datensatz anlegen.' : 'Für diese Auswahl sind noch keine Daten erfasst.'} />}
    </div>
    {rows.length > pageSize && <Button variant="outline" className="h-auto max-w-full whitespace-normal" onClick={() => setPageSize(size => size + 100)}>Weitere 100 anzeigen ({pageSize} von {rows.length})</Button>}
  </section>;

}
