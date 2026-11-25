import { useMemo } from 'react';
import type { ElectionDistrict } from '@/hooks/useElectionDistricts';
import { directMandateParty, electionDistrictNumberLabel } from '../mapModel';
import { getPartyColor, getPartyTextColor } from '../partyColors';
import { cartogramLayout } from '../cartogramLayout';

/**
 * Equal-area tile cartogram: every district gets the same tile, ordered roughly
 * by latitude bands and longitude. It removes the area bias of the geographic
 * map without inventing vote or seat figures the map does not hold. The layout
 * itself lives in ../cartogramLayout so the PNG export shows the same order.
 */
export function DistrictCartogram({
  districts,
  selectedDistrictId,
  onSelect,
}: {
  districts: ElectionDistrict[];
  selectedDistrictId?: string;
  onSelect: (district: ElectionDistrict) => void;
}) {
  const { tiles, columns } = useMemo(() => cartogramLayout(districts), [districts]);

  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      role="group"
      aria-label="Kartogramm der Wahlkreise, gleiche Fläche je Wahlkreis"
    >
      {tiles.map(({ district, row, column }) => {
        const party = directMandateParty(district);
        const selected = selectedDistrictId === district.id;
        return (
          <button
            key={district.id}
            type="button"
            aria-pressed={selected}
            aria-label={`Wahlkreis ${electionDistrictNumberLabel(district)}: ${district.district_name}, ${party}`}
            onClick={() => onSelect(district)}
            style={{
              gridRow: row + 1,
              gridColumn: column + 1,
              backgroundColor: getPartyColor(party) || '#9ca3af',
              color: getPartyTextColor(party),
            }}
            className={`flex min-h-[2.75rem] aspect-square flex-col items-center justify-center gap-0.5 rounded-sm border p-1 text-center leading-tight transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'border-2 border-foreground' : 'border-white/60'}`}
          >
            <span className="text-xs font-bold tabular-nums">{electionDistrictNumberLabel(district)}</span>
            <span className="w-full truncate text-[9px] uppercase tracking-wide opacity-90">{party}</span>
          </button>
        );
      })}
    </div>
  );
}
