import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ballotLabels, effectiveBallot, parties, percent } from './model';
import { chartColor, DataState } from './shared';
import type { Ballot, StateResult } from './types';

type SeriesRow = { year: number } & Record<string, number | null>;

export function StateShareChart({ year, ballot, rows, comparisonYears, series, loading, error, retry }: {
  year: number;
  ballot: Ballot;
  rows: StateResult[];
  comparisonYears: number[];
  series: SeriesRow[];
  loading: boolean;
  error: unknown;
  retry: () => void;
}) {
  const [mode, setMode] = useState('bar');
  const [barYear, setBarYear] = useState(year);
  const [hidden, setHidden] = useState<string[]>([]);
  const multiple = comparisonYears.length > 1;
  const showLine = multiple && mode === 'line';
  const selectedYear = multiple && comparisonYears.includes(barYear) ? barYear : year;
  const visibleParties = parties.filter(p => !hidden.includes(p));
  const selected = series.find(row => row.year === selectedYear);
  const bars = visibleParties.map(p => ({ party: p, share: multiple ? selected?.[p] ?? null : rows.find(row => row.party === p)?.share ?? null }))
    .sort((a, b) => (b.share ?? -1) - (a.share ?? -1));
  const maximum = Math.max(10, ...bars.map(row => row.share ?? 0)) * 1.2;
  return <Card className="min-w-0 rounded-2xl">
    <CardHeader className="gap-3 pb-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><CardTitle className="text-lg">Parteianteile</CardTitle><p className="mt-1 text-xs text-muted-foreground">Landtagswahl Baden-Württemberg · {showLine && comparisonYears.some(value => effectiveBallot(value, ballot) !== ballot) ? `Einzelstimme / ${ballotLabels[ballot]}` : ballotLabels[effectiveBallot(selectedYear, ballot)]}</p></div>
        {multiple && <div className="inline-flex rounded-lg bg-muted p-1" role="group" aria-label="Darstellung">
          {[['bar', 'Balken'], ['line', 'Verlauf']].map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${mode === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>{label}</button>)}
        </div>}
      </div>
      {multiple && !showLine && <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Wahljahr im Balkendiagramm">
        <span className="mr-1 text-xs text-muted-foreground">Wahljahr</span>
        {comparisonYears.map(value => <button key={value} type="button" aria-pressed={selectedYear === value} onClick={() => setBarYear(value)} className={`rounded-full border px-3 py-0.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedYear === value ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground'}`}>{value}</button>)}
      </div>}
    </CardHeader>
    <CardContent>
      <DataState loading={multiple && loading} error={multiple ? error : null} empty={multiple && !series.length} retry={retry}>
        {!visibleParties.length ? <p className="py-12 text-center text-sm text-muted-foreground">Bitte mindestens eine Partei einblenden.</p> : showLine ? <div className="h-80" role="img" aria-label="Parteianteile über alle Wahlen im gewählten Zeitraum; genaue Werte per Tooltip">
          <ResponsiveContainer><LineChart data={series} margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} ticks={comparisonYears} allowDecimals={false} padding={{ left: 12, right: 12 }} />
            <YAxis unit=" %" domain={[0, (max: number) => Math.ceil((max + 5) / 5) * 5]} />
            <Tooltip labelFormatter={value => `Landtagswahl ${value}`} formatter={value => percent(typeof value === 'number' ? value : null)} />
            <ReferenceLine y={5} stroke="#b91c1c" strokeDasharray="4 4" />
            {visibleParties.map(p => <Line key={p} dataKey={p} name={p} stroke={chartColor(p)} strokeWidth={2.5} dot={{ r: 3.5 }} activeDot={{ r: 5 }} connectNulls={false} />)}
          </LineChart></ResponsiveContainer>
        </div> : <div className="space-y-4 py-3" aria-label="Parteianteile in Prozent">
          {bars.map(row => <div key={row.party} className="grid grid-cols-[3.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-sm">
            <span className="font-medium">{row.party}</span>
            <div className="relative h-6 rounded-md bg-muted" aria-hidden="true">
              <div className="h-full rounded-md" style={{ width: `${(row.share ?? 0) / maximum * 100}%`, backgroundColor: chartColor(row.party) }} />
              <div className="absolute -top-1 -bottom-1 border-l border-dashed border-red-700/60" style={{ left: `${5 / maximum * 100}%` }} />
            </div>
            <span className="text-right font-semibold tabular-nums">{percent(row.share)}</span>
          </div>)}
        </div>}
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Parteien ein- oder ausblenden">
          {parties.map(p => <button key={p} type="button" aria-pressed={!hidden.includes(p)} onClick={() => setHidden(current => current.includes(p) ? current.filter(item => item !== p) : [...current, p])} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${hidden.includes(p) ? 'text-muted-foreground line-through opacity-50' : ''}`}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColor(p) }} aria-hidden="true" />{p}</button>)}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Gestrichelte Linie: 5-%-Hürde. Parteien lassen sich über die Legende ein- und ausblenden. Fehlende Werte bleiben unbekannt.</p>
      </DataState>
    </CardContent>
  </Card>;
}
