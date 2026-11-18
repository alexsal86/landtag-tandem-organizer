import { AnalysisInfo } from './AnalysisInfo';
import { TurnoutPanel } from './TurnoutPanel';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalysisControls } from './AnalysisToolbar';
import { DataState, DataTable, Selection, StatusNote, chartColor } from './shared';
import { ballotLabels, ballotsForYear, effectiveBallot, number, percent } from './model';
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
    const totals = (query.data?.totals || []).map(stateTotalMetrics).sort((a, b) => b.year - a.year);
    const state = query.data?.state || [];
    const totalsByYear = new Map(totals.map(total => [total.year, total]));
    const resultsByYear = new Map<number, typeof state>();
    for (const result of state) {
      const results = resultsByYear.get(result.year);
      if (results) results.push(result);
      else resultsByYear.set(result.year, [result]);
    }
    const chartYears = [...new Set([...totalsByYear.keys(), ...resultsByYear.keys()])].sort((a, b) => a - b);
    const rows = chartYears.map(electionYear => ({
      year: electionYear,
      turnout: totalsByYear.get(electionYear)?.turnout ?? null,
      invalidShare: totalsByYear.get(electionYear)?.invalidShare ?? null,
      parties: Object.fromEntries((resultsByYear.get(electionYear) || []).map(result => [result.party, result.share])),
    }));
    const [hiddenMetrics, setHiddenMetrics] = useState<string[]>([]);
    const charts = [
      {
        title: 'Parteien',
        metrics: [...new Set(state.map(result => result.party))].map(party => ({
          key: party, label: party, color: chartColor(party),
          value: (row: typeof rows[number]) => row.parties[party] ?? null,
        })),
      },
      {
        title: 'Wahlbeteiligung und ungültige Stimmen',
        metrics: [
          { key: 'turnout', label: 'Wahlbeteiligung', color: '#4b8b39', value: (row: typeof rows[number]) => row.turnout },
          { key: 'invalidShare', label: 'Ungültige Stimmen', color: '#b65c55', value: (row: typeof rows[number]) => row.invalidShare },
        ],
      },
    ];
    const ranks = ['1. Platz', '2. Platz', '3. Platz', '4. Platz', '5. Platz'];
    return <div className="space-y-4 [&_tbody]:bg-white [&_tbody]:text-slate-900">
    <AnalysisControls>
      <Selection id="history-from" label="Zeitreihe ab Wahl" value={String(from)} onChange={v => setParams(old => { const next = new URLSearchParams(old); next.set('historyFrom', v); return next; })}>{ordered.filter(y => y <= year).map(y => <option key={y} value={y}>{y}</option>)}</Selection>
    </AnalysisControls>
    <DataState loading={query.isLoading} error={query.error} empty={!rows.length} retry={() => void query.refetch()}>
      <h2 className="text-lg font-semibold">Vergangene Wahlen · {from}–{year}</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {charts.map(({ title, metrics }) => {
          const visible = metrics.filter(metric => !hiddenMetrics.includes(metric.key));
          const maximum = Math.ceil((Math.max(10, ...rows.flatMap(row => visible.map(metric => metric.value(row) ?? 0))) + 5) / 5) * 5;
          return <Card key={title} className="min-w-0">
            <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {visible.length ? <div className="h-96" role="img" aria-label={`${title} in Prozent, ${from} bis ${year}`}>
                <ResponsiveContainer><LineChart data={rows} margin={{ top: 24, left: 0, right: 26, bottom: 10 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3"/>
                  <XAxis dataKey="year"/>
                  <YAxis unit=" %" domain={[0, maximum]} tickFormatter={v => number(Number(v))}/>
                  <Tooltip formatter={v => percent(typeof v === 'number' ? v : null)}/>
                  {visible.map(metric => <Line key={metric.key} dataKey={metric.value} name={metric.label} stroke={metric.color} strokeWidth={2} connectNulls={false}/>)}
                  {chartYears.includes(2026) && <ReferenceLine x={2026} stroke="currentColor" strokeDasharray="5 4" label={{ value: 'Zweitstimme ab 2026', position: 'insideTopRight', fill: 'currentColor', fontSize: 12 }}/>}
                </LineChart></ResponsiveContainer>
              </div> : <p className="py-12 text-center text-sm text-muted-foreground">Keine Datenreihe ausgewählt.</p>}
              {metrics.length > 0 && <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
                <legend className="sr-only">{title} im Diagramm anzeigen</legend>
                {metrics.map(metric => <label key={metric.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!hiddenMetrics.includes(metric.key)} onChange={event => {
                    const checked = event.target.checked;
                    setHiddenMetrics(current => checked ? current.filter(key => key !== metric.key) : [...current, metric.key]);
                  }}/>
                  <span style={{ color: metric.color }} aria-hidden="true">●</span>{metric.label}
                </label>)}
              </fieldset>}
            </CardContent>
          </Card>;
        })}
      </div>
      <StatusNote>Bis 2021 zeigt die Übersicht die Einzelstimme und ab 2026 die Zweitstimme. 1952 war die Wahl zur Verfassunggebenden Landesversammlung. Die Übersicht zeigt die vorhandenen Parteiergebnisse. Lücken in den Linien stehen für fehlende Werte.</StatusNote>
      <h2 className="text-lg font-semibold">Parteiergebnisse nach Wahl</h2>
      <div className="overflow-x-auto"><DataTable headers={['Wahl', 'Stimmenart', ...ranks]} rows={[...chartYears].reverse().map(electionYear => {
        const ballot = electionYear >= 2026 ? 'second' : 'single';
        const ranked = (resultsByYear.get(electionYear) || []).slice().sort((a, b) =>
          (b.share ?? -1) - (a.share ?? -1) || (b.votes ?? -1) - (a.votes ?? -1));
        return [electionYear, ballotLabels[ballot], ...ranks.map((rank, index) => {
          const result = ranked[index];
          if (!result) return '–';
          return <div key={rank} className="space-y-1">
            <div className="flex items-center gap-1">{result.party}
              <AnalysisInfo label={`Hinweis und Quelle für ${result.party} bei der Wahl ${electionYear}`}><p>{result.notes || 'Bestehender Datensatz; Quellenprotokoll wird zentral im Super-Admin-Bereich gepflegt.'}</p></AnalysisInfo>
            </div>
            <div>{number(result.votes)} · {index === 0 ? <strong>{percent(result.share)}</strong> : percent(result.share)}</div>
          </div>;
        })];
      })}/></div>
      <h2 className="text-lg font-semibold">Wahlberechtigte und weitere Bezugsgrößen</h2>
      <div className="overflow-x-auto"><DataTable headers={['Wahl', 'Wahltag', 'Wahlberechtigte', 'Wählende', 'Nichtwählende', 'Beteiligung', 'Gültige Stimmen', 'Ungültige Stimmen', 'Ungültige %', 'Info']} rows={totals.map(t => [t.year, t.election_date.split('-').reverse().join('.'), number(t.eligible), number(t.voters), number(t.nonvoters), percent(t.turnout), number(t.valid_votes), number(t.invalid_votes), percent(t.invalidShare), <AnalysisInfo label={`Quelle und Prüfstatus für die Wahl ${t.year}`}><p><SourceLink url={t.source_url}/></p><p>{t.source_verified ? 'Original geprüft' : 'Originalprüfung offen'}</p><p>{t.source_sheet}, Zeile {t.source_row}</p></AnalysisInfo>])}/></div>
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
