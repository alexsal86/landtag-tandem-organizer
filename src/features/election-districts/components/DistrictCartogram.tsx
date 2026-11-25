import { useMemo } from 'react';
import type { ElectionDistrict } from '@/hooks/useElectionDistricts';
import { directMandateParty, electionDistrictNumberLabel } from '../mapModel';
import { getPartyColor, getPartyTextColor } from '../partyColors';

/**
 * Equal-area tile cartogram: every district gets the same tile, ordered roughly
 * by latitude bands and longitude. It removes the area bias of the geographic
 * map without inventing vote or seat figures the map does not hold.
 */
const BANDS = 7;

type Tile = { district: ElectionDistrict; row: number; column: number };

const layout = (districts: ElectionDistrict[]): { tiles: Tile[]; columns: number } => {
  const located = districts
    .filter(district => district.district_type !== 'verwaltungsgrenze')
    .map(district => {
      const center = district.center_coordinates as { lat?: number; lng?: number } | null | undefined;
      return {
        district,
        lat: typeof center?.lat === 'number' ? center.lat : null,
        lng: typeof center?.lng === 'number' ? center.lng : null,
      };
    });

  const latitudes = located.map(item => item.lat).filter((lat): lat is number => lat != null);
  if (latitudes.length === 0) return { tiles: [], columns: 1 };
  const maxLat = Math.max(...latitudes);
  const minLat = Math.min(...latitudes);
  const span = Math.max(maxLat - minLat, 0.0001);
  const bands: { district: ElectionDistrict; lng: number }[][] = Array.from({ length: BANDS }, () => []);
  const unlocated: ElectionDistrict[] = [];

  for (const item of located) {
    if (item.lat == null || item.lng == null) {
      unlocated.push(item.district);
      continue;
    }
    const band = Math.min(BANDS - 1, Math.max(0, Math.floor(((maxLat - item.lat) / span) * BANDS)));
    bands[band].push({ district: item.district, lng: item.lng });
  }

  const tiles: Tile[] = [];
  let columns = 1;
  bands.forEach((band, row) => {
    const sorted = [...band].sort((a, b) => a.lng - b.lng);
    columns = Math.max(columns, sorted.length);
    sorted.forEach((entry, column) => tiles.push({ district: entry.district, row, column }));
  });

  unlocated.forEach((district, index) => {
    tiles.push({ district, row: BANDS - 1, column: bands[BANDS - 1].length + index });
  });
  columns = Math.max(columns, bands[BANDS - 1].length + unlocated.length);

  return { tiles, columns };
};

export function DistrictCartogram({
  districts,
  selectedDistrictId,
  onSelect,
}: {
  districts: ElectionDistrict[];
  selectedDistrictId?: string;
  onSelect: (district: ElectionDistrict) => void;
}) {
  const { tiles, columns } = useMemo(() => layout(districts), [districts]);

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
