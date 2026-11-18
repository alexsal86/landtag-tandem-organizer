import { StateHistoryPanel, FlowMatrixPanel } from './StateHistoryPanels';
import { StateShareChart } from './StateShareChart';
import { StateSeatDistribution } from './StateSeatDistribution';
import { AnalysisInfo } from './AnalysisInfo';
import { AnalysisControls, AnalysisToolbarLayout } from './AnalysisToolbar';
import { Selection, DataState, DataTable, StatusNote, PartyLabel, chartColor } from './shared';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAnalysisRows, useAnalysisYears, useStateComparisonSeries } from './useElectionAnalysis';
import { ballotLabels, ballotsForYear, effectiveBallot, parties, sectionLabels, percent, number, stateComparison, compareAnalysisValues } from './model';
import type { Ballot } from './types';
import { analysisDestination, dataPillars, normalizeAnalysisParams, resolveAnalysisNavigation, type PrimaryView } from './navigation';

const DeputyDirectory = lazy(() => import('./DeputyDirectory'));
const ResearchWorkbench = lazy(() => import('./research/ResearchWorkbench'));
export default function ElectionAnalysis() {
  const [params, setParams] = useSearchParams();
  const { section, pillar, researchTool, showTurnout, flowMatrix } = resolveAnalysisNavigation(params);
  useEffect(() => {
    const canonical = normalizeAnalysisParams(params);
    if (canonical.toString() !== params.toString()) setParams(canonical, { replace: true });
  }, [params, setParams]);
  const navigate = (view: PrimaryView) => setParams(previous => {
    const next = analysisDestination(previous, view);
    if (view !== section) next.delete('savedScenario');
    return next;
  });
  const years = useAnalysisYears(section !== 'deputies');
  const availableYears = years.data?.filter(y => ['state', 'history', 'profile', 'districts'].includes(section) || y.year >= 2006);
  const requestedYear = Number(params.get('analysisYear') || (flowMatrix ? 2006 : 0));
  const year = ['split', 'seats'].includes(section) && years.data?.some(y => y.year === 2026) ? 2026 : availableYears?.some(y => y.year === requestedYear) ? requestedYear : availableYears?.[0]?.year || 0;
  const requestedBallot = params.get('analysisBallot');
  const ballot = section === 'history' ? effectiveBallot(year, 'second') : section === 'demographics' && year >= 2026 ? 'second' : effectiveBallot(year, requestedBallot === 'first' || requestedBallot === 'single' ? requestedBallot : 'second');
  const party = parties.find(p => p === params.get('analysisParty')) || 'GRÜNE';
  const gender = ['Insgesamt', 'Frauen', 'Männer'].find(g => g === params.get('analysisGender')) || 'Insgesamt';
  const change = (key: string, value: string) => setParams(previous => { const next = new URLSearchParams(previous); next.set(key, value); return next; });
  const selection = { year, ballot, party, gender };
  return <div className="space-y-5 font-sans">
    <header><h1 className="text-2xl font-semibold">Wahlanalyse Baden-Württemberg</h1><p className="mt-1 text-sm text-muted-foreground">Wahlergebnisse, Beteiligung und Wahlverhalten vergleichen. Es wird nur die gewählte Auswertung geladen.</p></header>
    <nav aria-label="Datenbereiche" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {dataPillars.map(item => <Button key={item.id} className="h-auto min-h-11 whitespace-normal" variant={pillar.id === item.id ? 'default' : 'outline'} aria-pressed={pillar.id === item.id} onClick={() => navigate(item.sections[0])}>{item.label}</Button>)}
    </nav>
    <nav aria-label={`${pillar.label}: Auswertung auswählen`} className="flex flex-wrap gap-2 border-b pb-3">
      {pillar.sections.map(view => <Button key={view} variant={section === view ? 'default' : 'ghost'} aria-pressed={section === view} onClick={() => navigate(view)}>{sectionLabels[view]}</Button>)}
    </nav>
    {section === 'deputies' ? <Suspense fallback={<p role="status">Abgeordnetenübersicht lädt …</p>}><DeputyDirectory /></Suspense> : <>
    <DataState loading={years.isLoading} error={years.error} empty={!years.data?.length} retry={() => void years.refetch()}>
      <AnalysisToolbarLayout filters={section === 'mandates' || (section === 'research' && researchTool === 'saved') ? null : <>
        {<Selection id="analysis-year" label="Wahl / Legislaturperiode" value={String(year)} onChange={value => change('analysisYear', value)}>{availableYears?.filter(y => !['split', 'seats'].includes(section) || y.year === 2026).map(y => <option key={y.year} value={y.year}>{y.year} · {y.period_number}. Legislaturperiode</option>)}</Selection>}
        {!['flows','split','history','seats'].includes(section) && !(section === 'research' && ['saved','flows'].includes(researchTool)) && <Selection id="analysis-ballot" label="Stimmenart" value={ballot} onChange={value => change('analysisBallot', value)}>{(section === 'demographics' && year >= 2026 ? ['second'] as Ballot[] : ballotsForYear(year)).map(b => <option key={b} value={b}>{ballotLabels[b]}</option>)}</Selection>}
        {(section === 'flows' || section === 'districts') && <Selection id="analysis-party" label={section === 'flows' ? 'Zielpartei' : 'Partei'} value={party} onChange={value => change('analysisParty', value)}>{parties.map(p => <option key={p}>{p}</option>)}</Selection>}
        {section === 'demographics' && <Selection id="analysis-gender" label="Geschlecht" value={gender} onChange={value => change('analysisGender', value)}>{['Insgesamt', 'Frauen', 'Männer'].map(g => <option key={g}>{g}</option>)}</Selection>}
      </>}>
      {year > 0 && <div key={`${section}:${year}:${ballot}:${party}:${gender}`}>
        {section === 'history' && <StateHistoryPanel year={year} years={availableYears?.map(y => y.year) || []} initiallyShowTurnout={showTurnout} />}
        {section === 'state' && <StatePanel {...selection} years={availableYears?.map(y => y.year) || []} />}
        {section === 'districts' && <DistrictPanel {...selection} />}
        {section === 'flows' && <div className="space-y-6">
          <section aria-labelledby="flow-party-heading"><h2 id="flow-party-heading" className="mb-3 text-lg font-semibold">Wanderung nach Zielpartei</h2><FlowPanel {...selection} /></section>
          <section aria-labelledby="flow-matrix-heading"><h2 id="flow-matrix-heading" className="mb-3 text-lg font-semibold">Vollständige Wanderungsmatrix</h2>{year === 2006 ? <FlowMatrixPanel year={year} /> : <StatusNote>Für die Wahl {year} liegt keine vollständige Wanderungsmatrix vor. Für die Wahl 2006 kann hier zusätzlich die Matrix für 2001 → 2006 angezeigt werden.</StatusNote>}</section>
          <StatusNote>Modellierte Wählerwanderung auf Landesebene, keine gezählten individuellen Wechsel und keine Wahlkreisdaten. Positive Salden bedeuten Nettozugewinne für {party}. Nicht ausgewiesene Zu- und Abströme bleiben leer. Die Beziehungen verschiedener Zielparteien dürfen nicht zu einer Gesamtwanderung addiert werden.</StatusNote>
        </div>}
        {section === 'demographics' && <DemographicPanel {...selection} />}
        {(['profile','swing','split','mandates','research','seats'] as string[]).includes(section) && <Suspense fallback={<p role="status">Analysemodul lädt …</p>}><ResearchWorkbench section={section as 'profile'|'swing'|'split'|'mandates'|'research'|'seats'} {...selection} years={availableYears?.map(y => y.year) || []} /></Suspense>}
      </div>}
      </AnalysisToolbarLayout>
    </DataState>
    </>}

  </div>;
}
type PanelProps = { year: number; ballot: Ballot; party: string; gender: string };

function StatePanel({ year, ballot, party, gender, years }: PanelProps & { years: number[] }) {
  const query = useAnalysisRows('state', year, ballot, party, gender);
  const [previousYear, setPreviousYear] = useState(0);
  const [hiddenParties, setHiddenParties] = useState<string[]>([]);
  const toggleParty = (party: string) => setHiddenParties(current => current.includes(party) ? current.filter(p => p !== party) : [...current, party]);
  const previousBallot = effectiveBallot(previousYear, ballot);
  const previous = useAnalysisRows('state', previousYear, previousBallot, party, gender, previousYear > 0);
  const rows = stateComparison(query.data || [], previous.data || []).sort((a, b) =>
    compareAnalysisValues(a.share, b.share, 'desc') || compareAnalysisValues(a.votes, b.votes, 'desc') || a.party.localeCompare(b.party, 'de')
  );
  const comparisonYears = previousYear > 0 ? years.filter(y => y >= Math.min(year, previousYear) && y <= Math.max(year, previousYear)).sort((a, b) => a - b) : [];
  const series = useStateComparisonSeries(comparisonYears, ballot, previousYear > 0);
  const comparisonRows = series.data || [];
  const visibleRows = rows.filter(row => !hiddenParties.includes(row.party));
  const visibleParties = parties.filter(p => !hiddenParties.includes(p));
  const comparisonStart = comparisonYears[0];
  const comparisonEnd = comparisonYears[comparisonYears.length - 1];
  return <div className="space-y-4">
    <AnalysisControls><Selection id="analysis-compare" label="Mit Wahl vergleichen" value={String(previousYear)} onChange={value => setPreviousYear(Number(value))}><option value="0">Kein Vergleich</option>{years.filter(y => y !== year).map(y => <option key={y} value={y}>{y} · {ballotLabels[effectiveBallot(y, ballot)]}</option>)}</Selection></AnalysisControls>
    {previousYear > 0 && previous.isLoading && <p role="status" className="text-sm">Lade Vergleichswahl …</p>}
    {previous.error && <p role="alert" className="text-sm">Die Vergleichswahl konnte nicht geladen werden.</p>}
    <DataState loading={query.isLoading} error={query.error} empty={!rows.length} retry={() => void query.refetch()}>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <StateShareChart key={previousYear} year={year} ballot={ballot} rows={rows} hidden={hiddenParties} onToggleParty={toggleParty} comparisonYears={comparisonYears} series={comparisonRows} loading={series.isLoading} error={series.error} retry={() => void series.refetch()} />
        <div className="min-w-0 space-y-4"><div className="[&_tbody]:bg-card">
          {previousYear > 0 ? <DataState loading={series.isLoading} error={series.error} empty={!comparisonRows.length} retry={() => void series.refetch()}>
            <DataTable headers={['Partei', ...comparisonYears.map(String), `Δ ${comparisonStart}–${comparisonEnd} (%)`]} rows={visibleParties.map(p => {
              const start = comparisonRows.find(row => row.year === comparisonStart)?.[p] ?? null;
              const end = comparisonRows.find(row => row.year === comparisonEnd)?.[p] ?? null;
              const delta = start !== null && end !== null ? Math.round((end - start) * 1000) / 1000 : null;
              return [<PartyLabel party={p} />, ...comparisonYears.map(y => percent(comparisonRows.find(row => row.year === y)?.[p] ?? null)), <span className={delta === null || delta === 0 ? '' : delta > 0 ? 'text-success' : 'text-destructive'}>{delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`}</span>];
            })} />
            <p className="mt-2 text-xs text-muted-foreground">Δ: Veränderung von {comparisonStart} bis {comparisonEnd} (%).</p>
          </DataState> : <DataTable headers={['Partei', 'Stimmen', 'Anteil']} rows={visibleRows.map(r => [<PartyLabel party={r.party} />, number(r.votes), percent(r.share)])} />}
        </div>
          <StateSeatDistribution rows={rows} year={year} ballot={ballot} />
        </div>
      </div>
      {rows.map(r => r.notes && <p key={r.party} className="text-xs text-muted-foreground">{r.party}: {r.notes}</p>)}
    </DataState>
    <StatusNote>Ausgewählte Parteien, kein vollständiges Landesergebnis. Historische Ergänzungen stammen aus der Arbeitsmappe; die Originalprüfung ist offen. Leere Felder werden nicht als null Stimmen oder null Sitze interpretiert. {year === 2026 && 'Die Sitzverteilung steht bei den Zweitstimmen.'}{previousYear > 0 && previousBallot !== ballot && ' Der Vergleich umfasst unterschiedliche Wahlsysteme: Einzelstimme und Erst-/Zweitstimme.'}</StatusNote>
  </div>;
}

function DistrictPanel({ year, ballot, party, gender }: PanelProps) {
  const query = useAnalysisRows('districts', year, ballot, party, gender);
  const [search, setSearch] = useState('');
  const rows = (query.data || []).filter(r => `${r.district_number} ${r.district_name}`.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'))).sort((a, b) => (b.share ?? -1) - (a.share ?? -1));
  return <div className="space-y-4">
    <AnalysisControls><Input className="max-w-sm" aria-label="Wahlkreis filtern" placeholder="Wahlkreisname oder Nummer …" value={search} onChange={event => setSearch(event.target.value)} /></AnalysisControls>
    <DataState loading={query.isLoading} error={query.error} empty={!rows.length || rows.every(r => r.share === null && r.votes === null)} retry={() => void query.refetch()}>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="min-w-0">
          <DataTable
            key={search}
            headers={['Nr.', 'Wahlkreis', 'Stimmen', 'Anteil', 'Datenstatus / Hinweis']}
            sortableColumns={[0, 1, 2, 3]}
            sortValues={rows.map(r => [r.district_number, r.district_name, r.votes, r.share])}
            rows={rows.map(r => [
              number(r.district_number), r.district_name, number(r.votes), percent(r.share),
              <AnalysisInfo label={`Datenstatus und Hinweise für ${r.district_name}`}>
                <p>{r.notes || (r.preliminary ? 'Vorläufiges amtliches Endergebnis' : 'Endgültig')}</p>
              </AnalysisInfo>,
            ])}
          />
        </div>
        <Card className="min-w-0">
          <CardHeader><CardTitle className="text-lg">{party}: zehn stärkste Wahlkreise dieser Auswahl</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[26rem]" role="img" aria-label="Zehn stärkste Wahlkreise nach Parteianteil. Genaue Werte stehen auch in der Tabelle.">
              <ResponsiveContainer>
                <BarChart data={rows.filter(r => r.share !== null).slice(0, 10)} layout="vertical" margin={{ right: 60 }}>
                  <XAxis type="number" unit=" %" />
                  <YAxis type="category" dataKey="district_name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={value => percent(typeof value === 'number' ? value : null)} />
                  <Bar dataKey="share" fill={chartColor(party)} name="Anteil" maxBarSize={20}>
                    <LabelList
                      dataKey="share"
                      position="right"
                      offset={6}
                      fill="currentColor"
                      fontSize={12}
                      fontWeight={700}
                      formatter={value => percent(typeof value === 'number' ? value : null)}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </DataState>
    <StatusNote>{query.data?.some(r => r.preliminary) ? 'Vorläufige Wahlkreiswerte aus dem Wahlnachtsbericht; Abweichungen von endgültigen Landeswerten sind möglich.' : 'Wahlkreiswerte laut Datensatz endgültig.'} Wahlkreiszuschnitte können sich zwischen Wahlen ändern. Ergebnisse beziehen sich auf die ausgewählte Stimmenart und werden keinen einzelnen Mandatsträgern zugeschrieben.</StatusNote>
  </div>;
}


function FlowPanel({ year, ballot, party, gender }: PanelProps) {
  const query = useAnalysisRows('flows', year, ballot, party, gender);
  const rows = (query.data || []).slice().sort((a, b) => (b.balance ?? -Infinity) - (a.balance ?? -Infinity));
  return <div className="space-y-4">
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
  return <div className="space-y-4 [&_tbody]:bg-white [&_tbody]:text-slate-900">
    <DataState loading={query.isLoading} error={query.error} empty={!rows.length} retry={() => void query.refetch()}>
      <Card><CardHeader><CardTitle className="text-lg">Parteianteile nach Alter · {gender}</CardTitle></CardHeader><CardContent><div className="h-80" role="img" aria-label="Parteianteile nach Altersgruppe; auswählbare genaue Werte stehen darunter"><ResponsiveContainer><LineChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="age" /><YAxis unit=" %" /><Tooltip formatter={value => percent(typeof value === 'number' ? value : null)} /><Legend />{parties.map(p => <Line key={p} dataKey={p} stroke={chartColor(p)} strokeWidth={2} connectNulls={false} />)}</LineChart></ResponsiveContainer></div></CardContent></Card>
      <AnalysisControls placement="filters"><Selection id="analysis-age" label="Altersgruppe für die Tabelle" value={selectedAge} onChange={setAge}>{ages.map(a => <option key={a}>{a}</option>)}</Selection></AnalysisControls>
      <DataTable key={selectedAge} headers={['Partei', 'Altersgruppe', 'Geschlecht', 'Anteil', 'Hinweis']} rows={selected.map(r => [<PartyLabel party={r.party} />, r.age_group, r.gender, percent(r.share), r.notes || '—'])} />
    </DataState>
    <StatusNote>Repräsentative Wahlstatistik: Parteianteile innerhalb der jeweiligen Alters- und Geschlechtsgruppe. Keine individuellen Personenprofile und keine absoluten Wählerzahlen. {year >= 2026 ? '2026: Zweitstimmen; jüngste Gruppe 16–24 Jahre.' : 'Bis 2021: Einzelstimme; jüngste Gruppe 18–24 Jahre.'} Die Altersgruppen verschiedener Jahre sind daher nicht durchgehend vergleichbar. „Insgesamt“ wird nicht aus den Gruppen gemittelt.</StatusNote>
  </div>;
}
