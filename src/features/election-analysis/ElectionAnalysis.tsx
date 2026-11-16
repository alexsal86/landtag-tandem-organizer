import { StateHistoryPanel, FlowMatrixPanel, WorkbookAuditPanel, WorkbookSourceNotice } from './StateHistoryPanels';
import { useStateTotal } from './useStateHistory';
import { stateTotalMetrics } from './stateHistoryModel';
import { StateShareChart } from './StateShareChart';
import { StateSeatDistribution } from './StateSeatDistribution';
import { AnalysisControls, AnalysisToolbarLayout } from './AnalysisToolbar';
import { Selection, DataState, DataTable, StatusNote, PartyLabel, chartColor } from './shared';
import { lazy, Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAnalysisRows, useAnalysisYears, useStateComparisonSeries } from './useElectionAnalysis';
import { ballotLabels, ballotsForYear, effectiveBallot, parties, sectionLabels, percent, number, difference, stateComparison, compareAnalysisValues } from './model';
import type { AnalysisSection, Ballot } from './types';

const ResearchWorkbench = lazy(() => import('./research/ResearchWorkbench'));
type AnalysisView = AnalysisSection | 'history' | 'sources' | 'profile' | 'swing' | 'split' | 'quality' | 'turnout-trend' | 'mandates' | 'research';
export default function ElectionAnalysis() {
  const years = useAnalysisYears();
  const [params, setParams] = useSearchParams();
  const legacyMatrix = params.get('analysisSection') === 'flow-matrix';
  const rawSection = legacyMatrix ? 'flows' : params.get('analysisSection') || 'state';
  const section: AnalysisView = Object.prototype.hasOwnProperty.call(sectionLabels, rawSection) ? rawSection as AnalysisView : 'state';
  const availableYears = years.data?.filter(y => ['state', 'history', 'sources', 'turnout'].includes(section) || y.year >= 2006);
  const requestedYear = Number(params.get('analysisYear') || (legacyMatrix ? 2006 : 0));
  const year = section === 'split' && years.data?.some(y => y.year === 2026) ? 2026 : availableYears?.some(y => y.year === requestedYear) ? requestedYear : availableYears?.[0]?.year || 0;
  const requestedBallot = params.get('analysisBallot');
  const ballot = section === 'history' ? effectiveBallot(year, 'second') : section === 'demographics' && year >= 2026 ? 'second' : effectiveBallot(year, requestedBallot === 'first' || requestedBallot === 'single' ? requestedBallot : 'second');
  const party = parties.find(p => p === params.get('analysisParty')) || 'GRÜNE';
  const gender = ['Insgesamt', 'Frauen', 'Männer'].find(g => g === params.get('analysisGender')) || 'Insgesamt';
  const change = (key: string, value: string) => setParams(previous => { const next = new URLSearchParams(previous); next.set(key, value); return next; });
  const selection = { year, ballot, party, gender };
  return <div className="space-y-5">
    <header><h1 className="text-2xl font-semibold">Wahlanalyse Baden-Württemberg</h1><p className="mt-1 text-sm text-muted-foreground">Wahlergebnisse, Beteiligung und Wahlverhalten vergleichen. Es wird nur die gewählte Auswertung geladen.</p></header>
    <DataState loading={years.isLoading} error={years.error} empty={!years.data?.length} retry={() => void years.refetch()}>
      <nav aria-label="Auswertung auswählen" className="flex flex-wrap gap-2 border-b pb-3">{(Object.keys(sectionLabels) as AnalysisView[]).map(key => <Button key={key} variant={section === key ? 'default' : 'outline'} aria-pressed={section === key} onClick={() => change('analysisSection', key)}>{sectionLabels[key]}</Button>)}</nav>
      <AnalysisToolbarLayout filters={section === 'mandates' || (section === 'research' && params.get('researchTool') === 'saved') ? null : <>
        {<Selection id="analysis-year" label="Wahl / Legislaturperiode" value={String(year)} onChange={value => change('analysisYear', value)}>{availableYears?.filter(y => section !== 'split' || y.year === 2026).map(y => <option key={y.year} value={y.year}>{y.year} · {y.period_number}. Legislaturperiode</option>)}</Selection>}
        {!['flows','split','quality','history','flow-matrix','sources'].includes(section) && !(section === 'research' && ['seats','saved','flows'].includes(params.get('researchTool') || '')) && <Selection id="analysis-ballot" label="Stimmenart" value={ballot} onChange={value => change('analysisBallot', value)}>{(section === 'demographics' && year >= 2026 ? ['second'] as Ballot[] : ballotsForYear(year)).map(b => <option key={b} value={b}>{ballotLabels[b]}</option>)}</Selection>}
        {(section === 'flows' || section === 'districts') && <Selection id="analysis-party" label={section === 'flows' ? 'Zielpartei' : 'Partei'} value={party} onChange={value => change('analysisParty', value)}>{parties.map(p => <option key={p}>{p}</option>)}</Selection>}
        {section === 'demographics' && <Selection id="analysis-gender" label="Geschlecht" value={gender} onChange={value => change('analysisGender', value)}>{['Insgesamt', 'Frauen', 'Männer'].map(g => <option key={g}>{g}</option>)}</Selection>}
      </>}>
      {section !== 'history' && }
      {year > 0 && <div key={`${section}:${year}:${ballot}:${party}:${gender}`}>
        {section === 'history' && <StateHistoryPanel year={year} years={availableYears?.map(y => y.year) || []} />}
        {section === 'sources' && <WorkbookAuditPanel year={year} />}
        {section === 'state' && <StatePanel {...selection} years={availableYears?.map(y => y.year) || []} />}
        {section === 'districts' && <DistrictPanel {...selection} />}
        {section === 'turnout' && <TurnoutPanel {...selection} />}
        {section === 'flows' && <div className="space-y-6">
          <section aria-labelledby="flow-party-heading"><h2 id="flow-party-heading" className="mb-3 text-lg font-semibold">Wanderung nach Zielpartei</h2><FlowPanel {...selection} /></section>
          <section aria-labelledby="flow-matrix-heading"><h2 id="flow-matrix-heading" className="mb-3 text-lg font-semibold">Vollständige Wanderungsmatrix</h2>{year === 2006 ? <FlowMatrixPanel year={year} /> : <StatusNote>Für die Wahl {year} liegt keine vollständige Wanderungsmatrix vor. Für die Wahl 2006 kann hier zusätzlich die Matrix für 2001 → 2006 angezeigt werden.</StatusNote>}</section>
        </div>}
        {section === 'demographics' && <DemographicPanel {...selection} />}
        {(['profile','swing','split','quality','turnout-trend','mandates','research'] as string[]).includes(section) && <Suspense fallback={<p role="status">Analysemodul lädt …</p>}><ResearchWorkbench section={section as 'profile'|'swing'|'split'|'quality'|'turnout-trend'|'mandates'|'research'} {...selection} years={availableYears?.map(y => y.year) || []} /></Suspense>}
      </div>}
      </AnalysisToolbarLayout>
    </DataState>
  </div>;
}
type PanelProps = { year: number; ballot: Ballot; party: string; gender: string };

function StatePanel({ year, ballot, party, gender, years }: PanelProps & { years: number[] }) {
  const query = useAnalysisRows('state', year, ballot, party, gender);
  const [previousYear, setPreviousYear] = useState(0);
  const previousBallot = effectiveBallot(previousYear, ballot);
  const previous = useAnalysisRows('state', previousYear, previousBallot, party, gender, previousYear > 0);
  const rows = stateComparison(query.data || [], previous.data || []).sort((a, b) =>
    compareAnalysisValues(a.share, b.share, 'desc') || compareAnalysisValues(a.votes, b.votes, 'desc') || a.party.localeCompare(b.party, 'de')
  );
  const comparisonYears = previousYear > 0 ? years.filter(y => y >= Math.min(year, previousYear) && y <= Math.max(year, previousYear)).sort((a, b) => a - b) : [];
  const series = useStateComparisonSeries(comparisonYears, ballot, previousYear > 0);
  const comparisonRows = series.data || [];
  return <div className="space-y-4">
    <AnalysisControls><Selection id="analysis-compare" label="Mit Wahl vergleichen" value={String(previousYear)} onChange={value => setPreviousYear(Number(value))}><option value="0">Kein Vergleich</option>{years.filter(y => y !== year).map(y => <option key={y} value={y}>{y} · {ballotLabels[effectiveBallot(y, ballot)]}</option>)}</Selection></AnalysisControls>
    {previousYear > 0 && previous.isLoading && <p role="status" className="text-sm">Lade Vergleichswahl …</p>}
    {previous.error && <p role="alert" className="text-sm">Die Vergleichswahl konnte nicht geladen werden.</p>}
    <DataState loading={query.isLoading} error={query.error} empty={!rows.length} retry={() => void query.refetch()}>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <StateShareChart key={previousYear} year={year} ballot={ballot} rows={rows} comparisonYears={comparisonYears} series={comparisonRows} loading={series.isLoading} error={series.error} retry={() => void series.refetch()} />
        <div className="min-w-0 space-y-4"><div className="[&_tbody]:bg-white"><DataTable headers={['Partei', 'Stimmen', 'Anteil', 'Sitze', ...(previousYear ? ['Vergleichsanteil', 'Änderung'] : [])]} rows={rows.map(r => [<PartyLabel party={r.party} />, number(r.votes), percent(r.share), number(r.seats), ...(previousYear ? [percent(r.previousShare), difference(r.share, r.previousShare)] : [])])} /></div>
          <StateSeatDistribution rows={rows} year={year} ballot={ballot} />
        </div>
      </div>
      {rows.map(r => r.notes && <p key={r.party} className="text-xs text-muted-foreground">{r.party}: {r.notes}</p>)}
    </DataState>
    {ballot !== 'first' && <WorkbookSourceNotice year={year} section="state" />}
    <StatusNote>Ausgewählte Parteien, kein vollständiges Landesergebnis. Historische Ergänzungen stammen aus der Arbeitsmappe; die Originalprüfung ist offen. Leere Felder werden nicht als null Stimmen oder null Sitze interpretiert. {year === 2026 && 'Die Sitzverteilung steht bei den Zweitstimmen.'}{previousYear > 0 && previousBallot !== ballot && ' Der Vergleich umfasst unterschiedliche Wahlsysteme: Einzelstimme und Erst-/Zweitstimme.'}</StatusNote>
  </div>;
}

function DistrictPanel({ year, ballot, party, gender }: PanelProps) {
  const query = useAnalysisRows('districts', year, ballot, party, gender);
  const [search, setSearch] = useState('');
  const rows = (query.data || []).filter(r => `${r.district_number} ${r.district_name}`.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))).sort((a, b) => (b.share ?? -1) - (a.share ?? -1));
  return <div className="space-y-4">
    <AnalysisControls><Input className="max-w-sm" aria-label="Wahlkreis filtern" placeholder="Wahlkreisname oder Nummer …" value={search} onChange={event => setSearch(event.target.value)} /></AnalysisControls>
    <StatusNote>{query.data?.some(r => r.preliminary) ? 'Vorläufige Wahlkreiswerte aus dem Wahlnachtsbericht; Abweichungen von endgültigen Landeswerten sind möglich.' : 'Wahlkreiswerte laut Datensatz endgültig.'} Wahlkreiszuschnitte können sich zwischen Wahlen ändern. Ergebnisse beziehen sich auf die ausgewählte Stimmenart und werden keinen einzelnen Mandatsträgern zugeschrieben.</StatusNote>
    <DataState loading={query.isLoading} error={query.error} empty={!rows.length || rows.every(r => r.share === null && r.votes === null)} retry={() => void query.refetch()}>
      <Card><CardHeader><CardTitle className="text-lg">{party}: zehn stärkste Wahlkreise dieser Auswahl</CardTitle></CardHeader><CardContent><div className="h-80" role="img" aria-label="Wahlkreise nach Parteianteil; Werte folgen in der Tabelle"><ResponsiveContainer><BarChart data={rows.filter(r => r.share !== null).slice(0, 10)} layout="vertical" margin={{ left: 30 }}><XAxis type="number" unit=" %" /><YAxis type="category" dataKey="district_name" width={130} tick={{ fontSize: 11 }} /><Tooltip formatter={value => percent(typeof value === 'number' ? value : null)} /><Bar dataKey="share" fill={chartColor(party)} name="Anteil" /></BarChart></ResponsiveContainer></div></CardContent></Card>
      <DataTable key={search} headers={['Nr.', 'Wahlkreis', 'Stimmen', 'Anteil', 'Datenstatus / Hinweis']} sortableColumns={[0, 1, 2, 3]} sortValues={rows.map(r => [r.district_number, r.district_name, r.votes, r.share])} rows={rows.map(r => [number(r.district_number), r.district_name, number(r.votes), percent(r.share), r.notes || (r.preliminary ? 'Vorläufig' : 'Endgültig')])} />
    </DataState>
  </div>;
}

function TurnoutPanel({ year, ballot, party, gender }: PanelProps) {
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
    {year < 2006 && <StatusNote>Für diese Wahl wurden Landesbezugsgrößen ergänzt. Wahlkreisdaten liegen in der Wahlanalyse nicht vor. Die vollständige Landes-Zeitreihe steht unter „Vergangene Wahlen“.</StatusNote>}
    <StatusNote>Erst- und Zweitstimmenzeilen derselben Wahl enthalten dieselben Wahlberechtigten und Wählenden. Die Ansicht berücksichtigt nur die ausgewählte Stimmenart und zählt niemanden doppelt. {all.some(r => r.preliminary) && '2026: vorläufige Wahlkreiszahlen.'}</StatusNote>
    <h2 className="text-lg font-semibold">Wahlkreisdaten · {year}</h2>
    <DataState loading={query.isLoading} error={query.error} empty={!all.length} retry={() => void query.refetch()}>
      <div className="grid gap-3 sm:grid-cols-3">{[['Wahlberechtigte', number(eligible)], ['Wählende', number(voters)], ['Beteiligung aus 70 Wahlkreisen', eligible && voters !== null ? percent(voters / eligible * 100) : 'Nicht vollständig erfasst']].map(([label, value]) => <Card key={label}><CardContent className="pt-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></CardContent></Card>)}</div>
      <AnalysisControls><Input className="max-w-sm" aria-label="Wahlkreis filtern" placeholder="Wahlkreisname oder Nummer …" value={search} onChange={event => setSearch(event.target.value)} /></AnalysisControls>
      <DataTable key={search} headers={['Nr.', 'Wahlkreis', 'Wahlberechtigte', 'Wählende', 'Beteiligung', 'Gültige Stimmen', 'Ungültige Stimmen']} sortableColumns={[0, 1, 2, 3, 4, 5, 6]} sortValues={rows.map(r => [r.district_number, r.district_name, r.eligible, r.voters, r.turnout, r.valid_votes, r.invalid_votes])} rows={rows.map(r => [number(r.district_number), r.district_name, number(r.eligible), number(r.voters), percent(r.turnout), number(r.valid_votes), number(r.invalid_votes)])} />
    </DataState>
  </div>;
}

function FlowPanel({ year, ballot, party, gender }: PanelProps) {
  const query = useAnalysisRows('flows', year, ballot, party, gender);
  const rows = (query.data || []).slice().sort((a, b) => (b.balance ?? -Infinity) - (a.balance ?? -Infinity));
  return <div className="space-y-4">
    <WorkbookSourceNotice year={year} section="flows" />
    <StatusNote>Modellierte Wählerwanderung auf Landesebene, keine gezählten individuellen Wechsel und keine Wahlkreisdaten. Positive Salden bedeuten Nettozugewinne für {party}. Nicht ausgewiesene Zu- und Abströme bleiben leer. Die Beziehungen verschiedener Zielparteien dürfen nicht zu einer Gesamtwanderung addiert werden.</StatusNote>
    <DataState loading={query.isLoading} error={query.error} empty={!rows.length} retry={() => void query.refetch()}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{party}: {rows[0]?.previous_year} → {year}</h2></div>
      <Card><CardContent className="pt-5"><div className="h-96" role="img" aria-label="Geschätzte Wanderungssalden; genaue Werte und Hinweise folgen in der Tabelle"><ResponsiveContainer><BarChart data={rows.filter(r => r.balance !== null)} layout="vertical" margin={{ left: 20, right: 20 }}><XAxis type="number" tickFormatter={value => number(typeof value === 'number' ? value : null)} /><YAxis type="category" dataKey="partner" width={190} tick={{ fontSize: 10 }} /><Tooltip formatter={value => number(typeof value === 'number' ? value : null)} /><ReferenceLine x={0} stroke="#8b9381" /><Bar dataKey="balance" name="Geschätzter Saldo">{rows.filter(r => r.balance !== null).map(r => <Cell key={r.partner} fill={(r.balance || 0) >= 0 ? '#4b8b39' : '#b65c55'} />)}</Bar></BarChart></ResponsiveContainer></div></CardContent></Card>
      <DataTable headers={['Austausch mit', 'Zustrom', 'Abstrom', 'Saldo', 'Methodischer Hinweis']} rows={rows.map(r => [r.partner, number(r.inflow), number(r.outflow), number(r.balance), r.notes || 'Modellschätzung'])} />
    </DataState>
  </div>;
}

function DemographicPanel({ year, ballot, party, gender }: PanelProps) {
  const query = useAnalysisRows('demographics', year, ballot, party, gender);
  const rows = query.data || [];
  const ages = Array.from(new Set(rows.map(r => r.age_group))).sort((a, b) => a === 'Insgesamt' ? -1 : b === 'Insgesamt' ? 1 : a.localeCompare(b, 'de', { numeric: true }));
  const [age, setAge] = useState('Insgesamt');
  const selectedAge = ages.includes(age) ? age : ages[0] || '';
  const selected = rows.filter(r => r.age_group === selectedAge);
  const chart = ages.filter(a => a !== 'Insgesamt').map(a => Object.fromEntries([['age', a], ...parties.map(p => [p, rows.find(r => r.age_group === a && r.party === p)?.share ?? null])]));
  return <div className="space-y-4">
    <StatusNote>Repräsentative Wahlstatistik: Parteianteile innerhalb der jeweiligen Alters- und Geschlechtsgruppe. Keine individuellen Personenprofile und keine absoluten Wählerzahlen. {year >= 2026 ? '2026: Zweitstimmen; jüngste Gruppe 16–24 Jahre.' : 'Bis 2021: Einzelstimme; jüngste Gruppe 18–24 Jahre.'} Die Altersgruppen verschiedener Jahre sind daher nicht durchgehend vergleichbar. „Insgesamt“ wird nicht aus den Gruppen gemittelt.</StatusNote>
    <DataState loading={query.isLoading} error={query.error} empty={!rows.length} retry={() => void query.refetch()}>
      <Card><CardHeader><CardTitle className="text-lg">Parteianteile nach Alter · {gender}</CardTitle></CardHeader><CardContent><div className="h-80" role="img" aria-label="Parteianteile nach Altersgruppe; auswählbare genaue Werte stehen darunter"><ResponsiveContainer><LineChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="age" /><YAxis unit=" %" /><Tooltip formatter={value => percent(typeof value === 'number' ? value : null)} /><Legend />{parties.map(p => <Line key={p} dataKey={p} stroke={chartColor(p)} strokeWidth={2} connectNulls={false} />)}</LineChart></ResponsiveContainer></div></CardContent></Card>
      <div className="flex flex-wrap items-end justify-between gap-3"><Selection id="analysis-age" label="Altersgruppe für die Tabelle" value={selectedAge} onChange={setAge}>{ages.map(a => <option key={a}>{a}</option>)}</Selection></div>
      <DataTable key={selectedAge} headers={['Partei', 'Altersgruppe', 'Geschlecht', 'Anteil', 'Hinweis']} rows={selected.map(r => [<PartyLabel party={r.party} />, r.age_group, r.gender, percent(r.share), r.notes || '—'])} />
    </DataState>
  </div>;
}
