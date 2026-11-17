import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AnalysisControls } from './AnalysisToolbar';
import { DataState, DataTable, StatusNote } from './shared';
import { ballotLabels, number, percent } from './model';
import { useAnalysisRows } from './useElectionAnalysis';
import { useStateTotal } from './useStateHistory';
import { stateTotalMetrics } from './stateHistoryModel';
import type { Ballot } from './types';
type PanelProps = { year: number; ballot: Ballot; party: string; gender: string };

export function TurnoutPanel({ year, ballot, party, gender }: PanelProps) {
  const query = useAnalysisRows('turnout', year, ballot, party, gender);
  const [search, setSearch] = useState('');
  const totalQuery = useStateTotal(year, ballot);
  const total = totalQuery.data ? stateTotalMetrics(totalQuery.data) : null;
  const all = (query.data || []).map(row => ({ ...row, invalid_votes: row.voters !== null && row.valid_votes !== null && row.voters >= row.valid_votes ? row.voters - row.valid_votes : null }));
  const complete = all.length === 70 && all.every(r => r.eligible !== null && r.voters !== null);
  const eligible = complete ? all.reduce((sum, r) => sum + (r.eligible || 0), 0) : null;
  const voters = complete ? all.reduce((sum, r) => sum + (r.voters || 0), 0) : null;
  const rows = all.filter(r => `${r.district_number} ${r.district_name}`.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))).sort((a, b) => (b.turnout ?? -1) - (a.turnout ?? -1));
  return <div className="space-y-4">
    <DataState loading={totalQuery.isLoading} error={totalQuery.error} empty={false} retry={() => void totalQuery.refetch()}>
      {total && <Card><CardHeader><CardTitle className="text-lg">Landesbezugsgrößen · {year} · {ballotLabels[ballot]}</CardTitle></CardHeader><CardContent><DataTable headers={['Wahlberechtigte', 'Wählende', 'Nichtwählende', 'Beteiligung', 'Gültige Stimmen', 'Ungültige Stimmen', 'Ungültige %']} rows={[[number(total.eligible), number(total.voters), number(total.nonvoters), percent(total.turnout), number(total.valid_votes), number(total.invalid_votes), percent(total.invalidShare)]]} /><p className="mt-3 text-sm"><a href={total.source_url} className="underline" target="_blank" rel="noreferrer">Quellenlink aus Arbeitsmappe</a> · {total.source_verified ? 'Original geprüft' : 'Originalprüfung offen'} · {total.source_sheet}, Zeile {total.source_row}</p></CardContent></Card>}
    </DataState>
    {year === 2026 && ballot === 'first' && <StatusNote>Die Arbeitsmappe ergänzt 2026 nur Landesbezugsgrößen für Zweitstimmen. Hier werden die vorhandenen Erststimmen-Wahlkreisdaten angezeigt.</StatusNote>}
    {year < 2006 && <StatusNote>Für diese Wahl wurden Landesbezugsgrößen ergänzt. Wahlkreisdaten liegen in der Wahlanalyse nicht vor. Die Landes-Zeitreihe steht oben.</StatusNote>}
    <StatusNote>Erst- und Zweitstimmenzeilen derselben Wahl enthalten dieselben Wahlberechtigten und Wählenden. Die Ansicht berücksichtigt nur die ausgewählte Stimmenart und zählt niemanden doppelt. {all.some(r => r.preliminary) && '2026: vorläufige Wahlkreiszahlen.'}</StatusNote>
    <h2 className="text-lg font-semibold">Wahlkreisdaten · {year}</h2>
    <DataState loading={query.isLoading} error={query.error} empty={false} retry={() => void query.refetch()}>
      {!all.length && <StatusNote>Für diese Wahl und Stimmenart sind keine Wahlkreisdaten vorhanden.</StatusNote>}
      {all.length > 0 && <>
      <div className="grid gap-3 sm:grid-cols-3">{[['Wahlberechtigte', number(eligible)], ['Wählende', number(voters)], ['Beteiligung aus 70 Wahlkreisen', eligible && voters !== null ? percent(voters / eligible * 100) : 'Nicht vollständig erfasst']].map(([label, value]) => <Card key={label}><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></CardContent></Card>)}</div>
      <AnalysisControls><Input className="max-w-sm" aria-label="Wahlkreis filtern" placeholder="Wahlkreisname oder Nummer …" value={search} onChange={event => setSearch(event.target.value)} /></AnalysisControls>
      <DataTable key={search} headers={['Nr.', 'Wahlkreis', 'Wahlberechtigte', 'Wählende', 'Beteiligung', 'Gültige Stimmen', 'Ungültige Stimmen']} sortableColumns={[0, 1, 2, 3, 4, 5, 6]} sortValues={rows.map(r => [r.district_number, r.district_name, r.eligible, r.voters, r.turnout, r.valid_votes, r.invalid_votes])} rows={rows.map(r => [number(r.district_number), r.district_name, number(r.eligible), number(r.voters), percent(r.turnout), number(r.valid_votes), number(r.invalid_votes)])} />
      </>}
    </DataState>
  </div>;
}

