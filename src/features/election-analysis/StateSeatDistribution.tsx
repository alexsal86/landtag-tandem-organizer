import { type ReactNode } from 'react';
import { ParliamentHemicycle } from './ParliamentHemicycle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Ballot, StateResult } from './types';

export function StateSeatDistribution({ rows, year, ballot, title, compact = false, highlightParty, sourceNote }: {
  rows: StateResult[];
  year: number;
  ballot: Ballot;
  title?: ReactNode; compact?: boolean; highlightParty?: string; sourceNote?: string;
}) {
  const groups = rows
    .filter((row): row is StateResult & { seats: number } =>
      row.seats !== null && Number.isSafeInteger(row.seats) && row.seats > 0
    )
    .map(row => ({ id: row.party, name: row.party, count: row.seats }));

  return <Card className={`min-w-0 ${compact ? 'bg-white text-slate-900 deputy-seat-card' : 'bg-card text-card-foreground'}`}>
    <CardHeader className="pb-2">
      <CardTitle className={compact ? "text-[11px] leading-[1.6]" : "text-lg"}>{title || `Sitzverteilung · ${year}`}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {groups.length > 0 ? <>
        <ParliamentHemicycle groups={groups} highlightParty={highlightParty} />
        {sourceNote && <p className="text-xs leading-relaxed text-slate-600">{sourceNote}</p>}
        {!compact && <p className="text-xs leading-relaxed text-slate-500">Ein Punkt entspricht einem hinterlegten Sitz. Schematische Anordnung der erfassten Parteien, keine einzelnen Sitzplätze.</p>}
      </> : <p className="text-sm text-slate-500">
        {year >= 2026 && ballot === 'first'
          ? 'Die Sitzverteilung steht bei den Zweitstimmen. Bitte oben die Stimmenart wechseln.'
          : 'Für diese Auswahl sind keine Sitzanzahlen hinterlegt.'}
      </p>}
    </CardContent>
  </Card>;
}
