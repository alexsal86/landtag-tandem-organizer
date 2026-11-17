import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { historyError } from '../useElectionHistory';
import type { ElectionPeriod } from '../types';
import type { GridEntity } from './historyFields';
export type HistoryIssue = { entity: GridEntity | 'state_lists'; record_id: string | null; period_id: string; period_number: number; period_name: string; label: string; issue_code: string; issue_label: string; list_id: string | null };
type Result = { rows: HistoryIssue[]; total: number; counts: { issue_code: string; label: string; count: number }[] };
const sections: Record<HistoryIssue['entity'], string> = { periods: 'Legislaturperioden', districts: 'Wahlkreise', mandates: 'Mandate', candidacies: 'Kandidaturen', state_lists: 'Landeslisten' };
const selectClass = 'h-10 w-full min-w-0 rounded-md border bg-background px-2 text-sm';
export function HistoryIssueOverview({ periods, onOpen, active = true }: { active?: boolean; periods: ElectionPeriod[]; onOpen: (issue: HistoryIssue) => void }) {
  const { user } = useAuth();
  const [entity, setEntity] = useState(''); const [issue, setIssue] = useState(''); const [period, setPeriod] = useState('');
  const [sort, setSort] = useState('problem'); const [search, setSearch] = useState(''); const [term, setTerm] = useState(''); const [offset, setOffset] = useState(0);
  useEffect(() => { const timer = window.setTimeout(() => { setTerm(search.trim()); setOffset(0); }, 300); return () => window.clearTimeout(timer); }, [search]);
  const query = useQuery({ queryKey: ['election-history', user?.id, 'issues', entity, issue, period, sort, term, offset], enabled: !!user && active,
    queryFn: async ({ signal }): Promise<Result> => {
      const { data, error } = await supabase.rpc('get_election_history_issues', { entity_filter: entity, issue_filter: issue, period_filter: period || undefined, search_text: term, sort_by: sort, page_offset: offset }).abortSignal(signal);
      if (error) throw error;
      if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.rows) || !Array.isArray(data.counts) || typeof data.total !== 'number') throw new Error('Ungültige Problemübersicht.');
      return data as unknown as Result;
    }, retry: false, staleTime: 30_000,
  });
  const totalIssues = query.data?.total;
  useEffect(() => { if (totalIssues !== undefined && offset > 0 && offset >= totalIssues) setOffset(Math.max(0, Math.floor((totalIssues - 1) / 50) * 50)); }, [totalIssues, offset]);
  return <section className="min-w-0 space-y-4">
    <div><h3 className="text-xl font-semibold">Problemfälle über alle Legislaturperioden</h3><p className="text-sm text-muted-foreground">Fehlende Quellen, Daten, Zuordnungen und vollständig leere Datenbereiche. Ein Datensatz kann mehrere Hinweise haben.</p></div>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="min-w-0"><Label htmlFor="issue-entity">Bereich</Label><select id="issue-entity" className={selectClass} value={entity} onChange={event => { setEntity(event.target.value); setIssue(''); setOffset(0); }}><option value="">Alle Bereiche</option>{Object.entries(sections).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      <div className="min-w-0"><Label htmlFor="issue-period">Legislaturperiode</Label><select id="issue-period" className={selectClass} value={period} onChange={event => { setPeriod(event.target.value); setOffset(0); }}><option value="">Alle Legislaturperioden</option>{periods.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="min-w-0"><Label htmlFor="issue-kind">Problemart</Label><select id="issue-kind" className={selectClass} value={issue} onChange={event => { setIssue(event.target.value); setOffset(0); }}><option value="">Alle Problemarten</option>{issue && !query.data?.counts.some(item => item.issue_code === issue) && <option value={issue}>Gewählte Problemart (0)</option>}{query.data?.counts.map(item => <option key={item.issue_code} value={item.issue_code}>{item.label} ({item.count})</option>)}</select></div>
      <div className="min-w-0"><Label htmlFor="issue-sort">Sortierung</Label><select id="issue-sort" className={selectClass} value={sort} onChange={event => { setSort(event.target.value); setOffset(0); }}><option value="problem">Problemart</option><option value="period">Legislaturperiode, neueste zuerst</option><option value="name">Name / Bezeichnung</option></select></div>
    </div>
    <div><Label htmlFor="issue-search">Name, Wahlkreis oder Periode suchen</Label><Input id="issue-search" type="search" value={search} onChange={event => setSearch(event.target.value)} /></div>
    {query.isLoading && <p role="status">Problemfälle werden geladen …</p>}
    {query.error && <div role="alert"><p>{historyError(query.error)}</p><Button variant="outline" onClick={() => void query.refetch()}>Erneut laden</Button></div>}
    {query.data && <><p className="text-sm text-muted-foreground">{query.data.total} Problemhinweise</p><ul className="space-y-2">{query.data.rows.map(row => <li key={`${row.entity}:${row.record_id || row.period_id}:${row.issue_code}`} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3">
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]"><p className="font-medium">{row.issue_label}</p><p className="text-sm">{row.label}</p><p className="text-xs text-muted-foreground">{sections[row.entity]} · {row.period_name}</p></div><Button size="sm" variant="outline" onClick={() => onOpen(row)}>{row.record_id ? 'Bearbeiten' : 'Datenbereich öffnen'}</Button>
    </li>)}</ul>{!query.data.total && <p>Keine passenden Problemhinweise gefunden.</p>}
    <div className="flex flex-wrap items-center gap-2"><Button variant="outline" disabled={query.isFetching || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>Zurück</Button><span className="text-sm">Seite {offset / 50 + 1}</span><Button variant="outline" disabled={query.isFetching || offset + 50 >= query.data.total} onClick={() => setOffset(value => value + 50)}>Weitere 50</Button></div></>}
  </section>;
}
