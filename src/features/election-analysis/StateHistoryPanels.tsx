import { AnalysisInfo } from './AnalysisInfo';
import { TurnoutPanel } from './TurnoutPanel';
import { PartyEndLabels } from './StateShareChart';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Portal } from '@radix-ui/react-tooltip';
import { Tooltip as VotesTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalysisControls } from './AnalysisToolbar';
import { DataState, DataTable, Selection, StatusNote, chartColor } from './shared';
import { ballotLabels, ballotsForYear, effectiveBallot, number, parties, percent } from './model';
import { matrixAxes, matrixCell, stateTotalMetrics } from './stateHistoryModel';
import { useFlowMatrix, useStateHistory } from './useStateHistory';
const partyHeaders = parties.map(party => party === 'GRÜNE' ? 'Grüne' : party);
const partyHeaderColors = Object.fromEntries(parties.map((party, index) => [partyHeaders[index], chartColor(party)]));

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
    const totalsByYear = new Map<number, (typeof totals)[number]>(totals.map(total => [Number(total.year), total]));
    const resultsByYear = new Map<number, typeof state>();
    for (const result of state) {
      const results = resultsByYear.get(result.year);
      if (results) results.push(result);
      else resultsByYear.set(result.year, [result]);
    }
    const chartYears = [...new Set<number>([...totalsByYear.keys(), ...resultsByYear.keys()])].sort((a, b) => a - b);
    const rows: ({ year: number; turnout: number | null } & Record<string, number | null>)[] = chartYears.map(electionYear => {
      const results = resultsByYear.get(electionYear) || [];
      return {
        ...Object.fromEntries(parties.map(party => [party, results.find(result => result.party === party)?.share ?? null])),
        year: electionYear,
        turnout: totalsByYear.get(electionYear)?.turnout ?? null,
      };
    });
    const [hiddenParties, setHiddenParties] = useState<string[]>([]);
    const availableParties = parties.filter(party => rows.some(row => row[party] != null));
    const visibleParties = availableParties.filter(party => !hiddenParties.includes(party));
    const maximum = Math.ceil((Math.max(10, ...rows.flatMap(row => availableParties.map(party => row[party] ?? 0))) + 5) / 5) * 5;
    const turnoutMinimum = Math.floor(Math.min(40, ...rows.map(row => row.turnout ?? 40)) / 10) * 10;
    const secondVoteMarker = chartYears.includes(2026) &&
      <ReferenceLine x={2026} stroke="currentColor" strokeDasharray="5 4" label={{ value: 'Zweitstimme ab 2026', position: 'insideTopRight', fill: 'currentColor', fontSize: 12 }}/>;
    return <div className="space-y-4 [&_tbody]:bg-white [&_tbody]:text-slate-900">
    <AnalysisControls>
      <Selection id="history-from" label="Zeitreihe ab Wahl" value={String(from)} onChange={v => setParams(old => { const next = new URLSearchParams(old); next.set('historyFrom', v); return next; })}>{ordered.filter(y => y <= year).map(y => <option key={y} value={y}>{y}</option>)}</Selection>
    </AnalysisControls>
    <DataState loading={query.isLoading} error={query.error} empty={!rows.length} retry={() => void query.refetch()}>
      <h2 className="text-lg font-semibold">Vergangene Wahlen · {from}–{year}</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader><CardTitle className="text-lg">Parteien</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {visibleParties.length ? <div className="h-96" role="img" aria-label={`Parteianteile in Prozent, ${from} bis ${year}`}>
              <ResponsiveContainer><LineChart data={rows} margin={{ top: 24, left: 0, right: 110, bottom: 10 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3"/>
                <XAxis dataKey="year"/>
                <YAxis unit=" %" domain={[0, maximum]} tickFormatter={v => number(Number(v))}/>
                <Tooltip formatter={v => percent(typeof v === 'number' ? v : null)}/>
                {visibleParties.map(party => <Line key={party} dataKey={party} name={party} stroke={chartColor(party)} strokeWidth={2} connectNulls={false}/>)}
                {secondVoteMarker}
                <PartyEndLabels result={rows[rows.length - 1]} visibleParties={visibleParties} maximum={maximum}/>
              </LineChart></ResponsiveContainer>
            </div> : <p className="py-12 text-center text-sm text-muted-foreground">{availableParties.length ? 'Keine Partei ausgewählt.' : 'Keine Parteianteile verfügbar.'}</p>}
            {availableParties.length > 0 && <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
              <legend className="sr-only">Parteien im Diagramm anzeigen</legend>
              {availableParties.map(party => <label key={party} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!hiddenParties.includes(party)} onChange={event => {
                  const checked = event.target.checked;
                  setHiddenParties(current => checked ? current.filter(value => value !== party) : [...current, party]);
                }}/>
                <span style={{ color: chartColor(party) }} aria-hidden="true">●</span>{party}
              </label>)}
            </fieldset>}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader><CardTitle className="text-lg">Wahlbeteiligung</CardTitle></CardHeader>
          <CardContent>
            <div className="h-96" role="img" aria-label={`Wahlbeteiligung in Prozent, ${from} bis ${year}`}>
              <ResponsiveContainer><LineChart data={rows} margin={{ top: 24, left: 0, right: 26, bottom: 10 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3"/>
                <XAxis dataKey="year"/>
                <YAxis unit=" %" domain={[turnoutMinimum, 100]} tickFormatter={v => number(Number(v))}/>
                <Tooltip formatter={v => percent(typeof v === 'number' ? v : null)}/>
                <Line dataKey="turnout" name="Wahlbeteiligung" stroke="#4b8b39" strokeWidth={2} connectNulls={false}/>
                {secondVoteMarker}
              </LineChart></ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      <StatusNote>Bis 2021 zeigt die Übersicht die Einzelstimme und ab 2026 die Zweitstimme. 1952 war die Wahl zur Verfassunggebenden Landesversammlung. Die Übersicht zeigt die vorhandenen Parteiergebnisse. Lücken in den Linien stehen für fehlende Werte.</StatusNote>
      <h2 className="text-lg font-semibold">Parteiergebnisse nach Wahl</h2>
      <TooltipProvider>
        <DataTable headers={['Wahl', 'Stimmenart', ...partyHeaders]} headerColors={partyHeaderColors} rows={[...chartYears].reverse().map(electionYear => {
          const ballot = electionYear >= 2026 ? 'second' : 'single';
          const results = resultsByYear.get(electionYear) || [];
          const winner = results.slice().sort((a, b) =>
            (b.share ?? -1) - (a.share ?? -1) || (b.votes ?? -1) - (a.votes ?? -1))[0];
          return [electionYear, ballotLabels[ballot], ...parties.map(party => {
            const result = results.find(entry => entry.party === party);
            if (!result) return '–';

            const share = percent(result.share);
            const value = result === winner && result.share != null ? <strong>{share}</strong> : share;
            if (result.votes == null) return value;

            return <VotesTooltip key={party}>
              <TooltipTrigger asChild><span tabIndex={0} className="cursor-help whitespace-nowrap rounded-sm focus-visible:outline focus-visible:outline-2">{value}</span></TooltipTrigger>
              <Portal><TooltipContent>{number(result.votes)} Stimmen</TooltipContent></Portal>
            </VotesTooltip>;
          })];
        })}/>
      </TooltipProvider>
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
