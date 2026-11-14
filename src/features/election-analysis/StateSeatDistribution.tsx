import { useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPartyColor } from '@/features/election-districts/partyColors';
import { number } from './model';
import type { Ballot, StateResult } from './types';

const parliamentOrder = ['SPD', 'GRÜNE', 'FDP', 'CDU', 'AfD'];

/** Place exactly one dot per recorded seat, with padding on every SVG edge. */
function seatPositions(total: number) {
  const rowCount = Math.max(1, Math.min(8, Math.round(Math.sqrt(total) / 2)));
  const radii = Array.from({ length: rowCount }, (_, row) =>
    rowCount === 1 ? 240 : 110 + row * 130 / (rowCount - 1)
  );
  const radiusSum = radii.reduce((sum, radius) => sum + radius, 0);
  const allocations = radii.map((radius, row) => {
    const ideal = total * radius / radiusSum;
    return { row, count: Math.floor(ideal), remainder: ideal % 1 };
  });
  const remaining = total - allocations.reduce((sum, row) => sum + row.count, 0);
  [...allocations].sort((a, b) => b.remainder - a.remainder || a.row - b.row)
    .slice(0, remaining).forEach(row => { row.count += 1; });

  return allocations.flatMap(({ row, count }) =>
    Array.from({ length: count }, (_, seat) => {
      const angle = count === 1 ? Math.PI / 2 : Math.PI * (1 - seat / (count - 1));
      return {
        angle,
        radius: radii[row],
        x: 260 + radii[row] * Math.cos(angle),
        y: 260 - radii[row] * Math.sin(angle),
      };
    })
  ).sort((a, b) => b.angle - a.angle || b.radius - a.radius);
}

export function StateSeatDistribution({ rows, year, ballot }: {
  rows: StateResult[];
  year: number;
  ballot: Ballot;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const represented = rows
    .filter((row): row is StateResult & { seats: number } =>
      row.seats !== null && Number.isSafeInteger(row.seats) && row.seats > 0
    )
    .sort((a, b) => {
      const aIndex = parliamentOrder.indexOf(a.party);
      const bIndex = parliamentOrder.indexOf(b.party);
      return (aIndex < 0 ? parliamentOrder.length : aIndex)
        - (bIndex < 0 ? parliamentOrder.length : bIndex)
        || a.party.localeCompare(b.party, 'de');
    });
  const seatParties = represented.flatMap(row => Array.from({ length: row.seats }, () => row.party));
  const total = seatParties.length;
  const positions = seatPositions(total);

  return <Card className="min-w-0 bg-white text-slate-900">
    <CardHeader className="pb-2">
      <CardTitle id={titleId} className="text-lg">Sitzverteilung · {year}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {total > 0 ? <>
        <svg viewBox="0 0 520 280" className="mx-auto block h-auto w-full max-w-2xl" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
          <desc id={descriptionId}>{represented.map(row => `${row.party}: ${number(row.seats)} Sitze`).join(', ')}. Von links nach rechts angeordnet.</desc>
          {positions.map((position, index) => <circle
            key={index}
            cx={position.x}
            cy={position.y}
            r={7}
            fill={getPartyColor(seatParties[index])}
            stroke="white"
            strokeWidth={0.75}
          ><title>{seatParties[index]}</title></circle>)}
          <text x="260" y="222" textAnchor="middle" fill="currentColor" fontSize="40" fontWeight="700">{number(total)}</text>
          <text x="260" y="246" textAnchor="middle" fill="#64748b" fontSize="14">Sitze dargestellt</text>
        </svg>
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm" aria-label="Sitze nach Partei, von links nach rechts">
          {represented.map(row => <li key={row.party} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: getPartyColor(row.party) }} aria-hidden="true" />
            <span>{row.party} <strong className="tabular-nums">{number(row.seats)}</strong></span>
          </li>)}
        </ul>
        <p className="text-xs leading-relaxed text-slate-500">Ein Punkt entspricht einem hinterlegten Sitz. Schematische Anordnung der erfassten Parteien, keine einzelnen Sitzplätze.</p>
      </> : <p className="text-sm text-slate-500">
        {year >= 2026 && ballot === 'first'
          ? 'Die Sitzverteilung steht bei den Zweitstimmen. Bitte oben die Stimmenart wechseln.'
          : 'Für diese Auswahl sind keine Sitzanzahlen hinterlegt.'}
      </p>}
    </CardContent>
  </Card>;
}
