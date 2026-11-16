import { useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';
import { historyError, useElectionPersonSearch } from '../useElectionHistory';
import type { ElectionHistoryData } from '../types';
import { parseCandidacyImport, type CandidacyImportRow } from './candidacyImport';

const template = 'Wahlkreis-Nr\tName\tPartei\tStimmen\tProzent\tPlatz\tListenplatz\tGewählt\tStimmenart';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ElectionHistoryData;
  periodId: string;
  onImported: () => Promise<void>;
}

export function CandidacyImportDialog({ open, onOpenChange, data, periodId, onImported }: Props) {
  const period = data.periods.find(item => item.id === periodId);
  const [text, setText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [rows, setRows] = useState<CandidacyImportRow[]>([]);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [personSearch, setPersonSearch] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const personMatches = useElectionPersonSearch(personSearch, open);
  const people = [...new Map([...data.people, ...(personMatches.data || [])].map(person => [person.id, person])).values()];
  const errorCount = rows.reduce((sum, row) => sum + row.errors.length, 0);

  const reset = () => { setText(''); setSourceUrl(''); setRows([]); setAssignments({}); setPersonSearch(''); setError(''); };
  const close = (next: boolean) => { if (!next && !importing) { reset(); onOpenChange(false); } };
  const preview = () => {
    setError('');
    try {
      const parsed = parseCandidacyImport(text, data.districts, (period?.election_year || 0) >= 2026 ? 'first_vote' : 'candidate');
      setRows(parsed); setAssignments({});
      if (sourceUrl && !/^https:\/\/[^\s]+$/.test(sourceUrl)) setError('Bitte eine vollständige HTTPS-Quellenadresse angeben oder das Feld leer lassen.');
    } catch (failure) { setRows([]); setError(historyError(failure)); }
  };
  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (file.size > 2 * 1024 * 1024) { setError('Bitte eine CSV-, TSV- oder Textdatei mit höchstens 2 MB auswählen.'); return; }
    try { setText(await file.text()); setRows([]); }
    catch { setError('Die Datei konnte nicht gelesen werden.'); }
  };
  const importRows = async () => {
    if (importing || !rows.length || errorCount || (sourceUrl && !/^https:\/\/[^\s]+$/.test(sourceUrl))) return;
    setImporting(true); setError('');
    try {
      const entries = rows.map(row => ({
        person_id: assignments[row.line] || null,
        new_person_name: assignments[row.line] ? null : row.personName,
        district_id: row.districtId,
        party: row.party,
        votes: row.votes,
        vote_share: row.voteShare,
        district_rank: row.districtRank,
        list_position: row.listPosition,
        ballot_type: row.ballotType,
        outcome: row.outcome,
      }));
      const { data: imported, error: rpcError } = await supabase.rpc('import_election_history_candidacies', {
        period: periodId, import_source_url: sourceUrl, entries,
      });
      if (rpcError) throw rpcError;
      await onImported();
      notify.success(`${imported ?? rows.length} Kandidaturen importiert`);
      reset(); onOpenChange(false);
    } catch (failure) { setError(historyError(failure)); }
    finally { setImporting(false); }
  };

  return <Dialog open={open} onOpenChange={close}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-7xl">
    <DialogHeader><DialogTitle>Kandidaturen und Ergebnisse importieren</DialogTitle><DialogDescription>Excel- oder CSV-Zeilen für {period?.name} einfügen, prüfen und anschließend gemeinsam speichern.</DialogDescription></DialogHeader>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div><div className="mb-2 flex items-center justify-between gap-2"><Label htmlFor="candidacy-import-text">Tabellendaten</Label><Button type="button" size="sm" variant="ghost" onClick={() => { setText(template); setRows([]); }}>Kopfzeile einfügen</Button></div><Textarea id="candidacy-import-text" className="min-h-56 font-mono text-caption" placeholder={template} value={text} disabled={importing} onChange={event => { setText(event.target.value); setRows([]); }} /><p className="mt-1 text-caption text-muted-foreground">Tabulator, Semikolon oder Komma; Kopfzeile erforderlich. Wahlausgang: direkt, liste, nein oder offen.</p></div>
      <div className="space-y-3"><div><Label htmlFor="candidacy-import-file">CSV-/TSV-Datei</Label><Input id="candidacy-import-file" type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" disabled={importing} onChange={event => void readFile(event.target.files?.[0])} /></div>
        <div><Label htmlFor="candidacy-import-source">Amtliche HTTPS-Quelle</Label><Input id="candidacy-import-source" type="url" placeholder="https://…" value={sourceUrl} disabled={importing} onChange={event => { setSourceUrl(event.target.value); setError(''); }} />{!sourceUrl && <p className="mt-1 text-caption text-warning-foreground">Ohne Quelle wird jede importierte Zeile in der Qualitätsprüfung markiert.</p>}</div>
        <div><Label htmlFor="candidacy-person-search">Vorhandene Personen suchen</Label><Input id="candidacy-person-search" value={personSearch} disabled={importing} onChange={event => setPersonSearch(event.target.value)} placeholder="Mindestens 2 Anfangsbuchstaben" /><p className="mt-1 text-caption text-muted-foreground">Die Treffer stehen anschließend in jeder Personenauswahl der Vorschau.</p></div>
        <Button type="button" variant="outline" className="w-full" disabled={!text.trim() || importing} onClick={preview}><FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />Zeilen prüfen</Button>
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {rows.length > 0 && <section className="space-y-2" aria-label="Importvorschau"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-body font-medium">{rows.length} Zeilen in der Vorschau</h3><p className={errorCount ? 'text-sm text-destructive' : 'text-sm text-success'} role="status">{errorCount ? `${errorCount} Probleme müssen korrigiert werden` : 'Alle Zeilen formal geprüft'}</p></div>
      <p className="text-caption text-muted-foreground">Personen werden nicht anhand ihres Namens automatisch verknüpft. Standard ist „Neue Person“. Eine vorhandene zentrale Person nur nach inhaltlicher Prüfung auswählen.</p>
      <div className="max-h-[45vh] rounded-md border"><Table className="min-w-[1050px]"><TableHeader><TableRow><TableHead>Zeile</TableHead><TableHead>Name / Personenwahl</TableHead><TableHead>Partei</TableHead><TableHead>Wahlkreis</TableHead><TableHead>Ergebnis</TableHead><TableHead>Ausgang</TableHead><TableHead>Prüfung</TableHead></TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={row.line} className={row.errors.length ? 'bg-destructive/5' : ''}>
        <TableCell>{row.line}</TableCell><TableCell><p className="mb-1 font-medium">{row.personName || 'Name fehlt'}</p><select aria-label={`Person für Importzeile ${row.line}`} className="h-8 min-w-56 rounded-md border border-input bg-background px-2 text-caption" value={assignments[row.line] || ''} disabled={importing || !row.personName} onChange={event => setAssignments(previous => ({ ...previous, [row.line]: event.target.value }))}><option value="">Neue Person ausdrücklich anlegen</option>{people.map(person => <option key={person.id} value={person.id}>Vorhandene Person: {person.name}</option>)}</select></TableCell>
        <TableCell>{row.party || '–'}</TableCell><TableCell>{row.districtLabel}</TableCell><TableCell>{row.votes?.toLocaleString('de-DE') ?? '–'} · {row.voteShare === null ? '–' : `${row.voteShare.toLocaleString('de-DE')} %`}{row.districtRank ? ` · Platz ${row.districtRank}` : ''}</TableCell><TableCell>{({ direct: 'Direkt', list: 'Liste', not_elected: 'Nicht gewählt', unknown: 'Offen' })[row.outcome]}{row.listPosition ? ` · Listenplatz ${row.listPosition}` : ''}</TableCell><TableCell>{row.errors.length ? <ul className="max-w-72 list-disc pl-4 text-caption text-destructive">{row.errors.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}</ul> : <span className="text-success">Bereit</span>}</TableCell>
      </TableRow>)}</TableBody></Table></div>
    </section>}
    <DialogFooter><Button variant="outline" disabled={importing} onClick={() => close(false)}>Abbrechen</Button><Button disabled={importing || !rows.length || errorCount > 0 || !!error} onClick={() => void importRows()}><Upload className="mr-2 h-4 w-4" aria-hidden="true" />{importing ? 'Import läuft …' : `${rows.length || 0} Zeilen verbindlich importieren`}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
