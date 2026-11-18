import { Portal as HoverCardPortal } from '@radix-ui/react-hover-card';
import { Info } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { TurnoutPanel } from './TurnoutPanel';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalysisControls } from './AnalysisToolbar';
import { DataState, DataTable, Selection, StatusNote, chartColor } from './shared';
import { ballotLabels, ballotsForYear, effectiveBallot, number, parties, percent } from './model';
import { matrixAxes, matrixCell, stateTotalMetrics } from './stateHistoryModel';
import { useFlowMatrix, useStateHistory } from './useStateHistory';
const SourceLink = ({ url }: {
    url: string;
}) => <a href={url} target="_blank" rel="noreferrer" className="underline">Quellenlink aus Arbeitsmappe</a>;
export function StateHistoryPanel({ year, years, initiallyShowTurnout = false }: {
    year: number;
    years: number[];
    initiallyShowTurnout?: boolean;
}) {
    const [params, setParams] = useSearchParams();
    const showTurnout = initiallyShowTurnout || params.get('historyDetails') === 'turnout';
    const turnoutBallot = effectiveBallot(year, params.get('analysisBallot') === 'first' ? 'first' : 'second');
    const ordered = years.slice().sort((a, b) => a - b);
    const requestedFrom = Number(params.get('historyFrom'));
    const from = ordered.includes(requestedFrom) && requestedFrom <= year ? requestedFrom : ordered[0] || year;
    const query = useStateHistory(from, year);
    const totals = (query.data?.totals || []).map(stateTotalMetrics);
    const rows = totals.map(t => ({ ...t, ...Object.fromEntries(parties.map(p => [p, query.data?.state.find(s => s.year === t.year && s.party === p)?.share ?? null])) }));
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['turnout', ...parties]);
    const metrics = [
      { key: 'turnout', label: 'Wahlbeteiligung', color: '#4b8b39' },
      { key: 'invalidShare', label: 'Ungültige Stimmen', color: '#b65c55' },
      ...parties.map(p => ({ key: p, label: p, color: chartColor(p) })),
    ];
    const showParties = parties.some(p => selectedMetrics.includes(p));
    const maximum = Math.ceil((Math.max(10, ...rows.flatMap(row => selectedMetrics.map(key => { const value = row[key as keyof typeof row]; return typeof value === 'number' ? value : 0; }))) + 5) / 5) * 5;
    const percentageDomain: [number, number] = [0, maximum];
    return <div className="space-y-4 [&_tbody]:bg-white [&_tbody]:text-slate-900">
    <AnalysisControls>
      <Selection id="history-from" label="Zeitreihe ab Wahl" value={String(from)} onChange={v => setParams(old => { const next = new URLSearchParams(old); next.set('historyFrom', v); return next; })}>{ordered.filter(y => y <= year).map(y => <option key={y} value={y}>{y}</option>)}</Selection>
    </AnalysisControls>
    <fieldset className="flex flex-wrap gap-x-5 gap-y-3 rounded-lg border p-4">
      <legend className="px-1 text-sm font-medium">Im Diagramm anzeigen (%)</legend>
      {metrics.map(metric => <label key={metric.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedMetrics.includes(metric.key)} onChange={event => setSelectedMetrics(current => event.target.checked ? [...current, metric.key] : current.filter(key => key !== metric.key))} /><span style={{ color: metric.color }} aria-hidden="true">●</span>{metric.label}</label>)}
    </fieldset>
    <DataState loading={query.isLoading} error={query.error} empty={!totals.length} retry={() => void query.refetch()}>
      <Card><CardHeader><CardTitle className="text-lg">Vergangene Wahlen · {from}–{year}</CardTitle></CardHeader><CardContent>
        {selectedMetrics.length ? <div className="h-96" role="img" aria-label="Gemeinsame Zeitreihe der ausgewählten Prozentwerte; genaue Werte folgen in den Tabellen"><ResponsiveContainer><LineChart data={rows} margin={{ top: 24, left: 10, right: 24, bottom: 10 }}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="year"/><YAxis unit=" %" domain={percentageDomain} tickFormatter={v => number(Number(v))}/><Tooltip formatter={v => percent(typeof v === 'number' ? v : null)}/><Legend />
          {metrics.filter(metric => selectedMetrics.includes(metric.key)).map(metric => <Line key={metric.key} dataKey={metric.key} name={metric.label} stroke={metric.color} strokeWidth={2} connectNulls={false}/>)}
        </LineChart></ResponsiveContainer></div> : <p className="py-12 text-center text-sm text-muted-foreground">Bitte mindestens eine Datenreihe auswählen.</p>}
      </CardContent></Card>
    <StatusNote>Vergangene Wahlen {from}–{year}. Die oben ausgewählte Wahl ist das Ende der Zeitreihe. Bis 2021 wird die Einzelstimme, ab 2026 die Zweitstimme verwendet; 2026 beginnt ein neues Wahlsystem. 1952 war die Wahl zur Verfassunggebenden Landesversammlung. Weitere historische Parteien werden nicht ergänzt. Fehlende Parteieinträge bleiben unbekannt und werden nicht als 0 dargestellt. Quellenlinks stammen aus der Arbeitsmappe; eine unabhängige Originalprüfung wird nur bei ausdrücklicher Kennzeichnung behauptet.</StatusNote>
      <h2 className="text-lg font-semibold">Wahlberechtigte und weitere Bezugsgrößen</h2>
      <div className="overflow-x-auto"><DataTable headers={['Wahl', 'Wahltag', 'Wahlberechtigte', 'Wählende', 'Nichtwählende', 'Beteiligung', 'Gültige Stimmen', 'Ungültige Stimmen', 'Ungültige %', 'Info']} rows={totals.map(t => [t.year, t.election_date.split('-').reverse().join('.'), number(t.eligible), number(t.voters), number(t.nonvoters), percent(t.turnout), number(t.valid_votes), number(t.invalid_votes), percent(t.invalidShare), <HoverCard openDelay={150}><HoverCardTrigger asChild><button type="button" aria-label={`Quelle und Prüfstatus für die Wahl ${t.year}`} className="inline-flex rounded-full p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Info className="h-4 w-4" aria-hidden="true" /></button></HoverCardTrigger><HoverCardPortal><HoverCardContent className="space-y-2 text-sm font-sans" align="end"><p><SourceLink url={t.source_url}/></p><p>{t.source_verified ? 'Original geprüft' : 'Originalprüfung offen'}</p><p>{t.source_sheet}, Zeile {t.source_row}</p></HoverCardContent></HoverCardPortal></HoverCard>])}/></div>
      {showParties && <DataTable headers={['Wahl', 'Stimmenart', 'Partei', 'Stimmen', 'Anteil', 'Hinweis / Quelle']} rows={(query.data?.state || []).map(s => [s.year, ballotLabels[s.year >= 2026 ? 'second' : 'single'], s.party, number(s.votes), percent(s.share), s.notes || 'Bestehender Datensatz; Quellenprotokoll wird zentral im Super-Admin-Bereich gepflegt.'])}/>}
    </DataState>
    <section aria-labelledby="history-turnout-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="history-turnout-heading" className="text-lg font-semibold">Wahlbeteiligung und Wahlkreise · {year}</h2>
        <Button variant="outline" aria-expanded={showTurnout} aria-controls="history-turnout-details" onClick={() => setParams(previous => { const next = new URLSearchParams(previous); if (showTurnout) next.delete('historyDetails'); else next.set('historyDetails', 'turnout'); return next; })}>{showTurnout ? 'Details ausblenden' : 'Landes- und Wahlkreisdaten anzeigen'}</Button>
      </div>
      {showTurnout && <div id="history-turnout-details" className="space-y-4">
        {ballotsForYear(year).length > 1 && <AnalysisControls><Selection id="history-turnout-ballot" label="Stimmenart der Beteiligungsdetails" value={turnoutBallot} onChange={value => setParams(old => { const next = new URLSearchParams(old); next.set('analysisBallot', value); return next; })}>{ballotsForYear(year).map(ballot => <option key={ballot} value={ballot}>{ballotLabels[ballot]}</option>)}</Selection></AnalysisControls>}
        <TurnoutPanel key={`${year}:${turnoutBallot}`} year={year} ballot={turnoutBallot} party="GRÜNE" gender="Insgesamt" />
      </div>}
    </section>
  </div>;
}
export function FlowMatrixPanel({ year }: {
    year: number;
}) {
    const query = useFlowMatrix(year);
    const cells = query.data || [];
    const { origins, destinations } = matrixAxes(cells);
    const previous = cells[0]?.previous_year;
    return <div className="space-y-4">

    <StatusNote>Die vollständige Wanderungsmatrix liegt aus dieser Arbeitsmappe für 2001 → 2006 vor. Alle Werte sind gerundete landesweite Modellschätzungen von Infratest dimap. Zeilen zeigen das Ziel, Spalten die Herkunft. Diagonalwerte zeigen Parteibindung beziehungsweise fortgesetzte Nichtwahl. Erstwählende und Zugezogene stehen auf der Herkunftsseite, Gestorbene und Weggezogene auf der Zielseite. Keine beobachteten individuellen Wechsel, keine Wahlkreisdaten und keine amtlich ausgezählten Parteiergebnisse.</StatusNote>
    <DataState loading={query.isLoading} error={query.error} empty={!cells.length} retry={() => void query.refetch()}>
      <h2 className="text-lg font-semibold">Wählerwanderung {previous} → {year} · Personen</h2>
      <div className="overflow-x-auto"><DataTable headers={[`Ziel ${year} / Herkunft ${previous}`, ...origins]} rows={destinations.map(destination => [destination, ...origins.map(origin => <span key={origin} className={origin === destination ? 'font-semibold' : ''}>{number(matrixCell(cells, origin, destination))}</span>)])}/></div>
      {cells[0] && <p className="text-sm"><SourceLink url={cells[0].source_url}/> · Wahlreport 2006, S. 33 · {cells.every(c => c.source_verified) ? 'Original unabhängig geprüft.' : 'Aus Arbeitsmappe übernommen; Originalprüfung offen.'} Der Zustrom von den Grünen zur CDU beträgt in der Arbeitsmappe 11.000 Personen.</p>}
    </DataState>
  </div>;
}
