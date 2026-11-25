import type { ElectionDistrict } from '@/hooks/useElectionDistricts';

/**
 * Equal-area tile layout: every district gets the same tile, ordered by
 * latitude bands and then by longitude. The map view and the PNG export share
 * this layout so both show the cartogram in the same order.
 */
export const CARTOGRAM_BANDS = 7;

export type CartogramTile = { district: ElectionDistrict; row: number; column: number };

export const cartogramLayout = (districts: ElectionDistrict[]): { tiles: CartogramTile[]; columns: number } => {
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
  const bands: { district: ElectionDistrict; lng: number }[][] = Array.from({ length: CARTOGRAM_BANDS }, () => []);
  const unlocated: ElectionDistrict[] = [];

  for (const item of located) {
    if (item.lat == null || item.lng == null) {
      unlocated.push(item.district);
      continue;
    }
    const band = Math.min(CARTOGRAM_BANDS - 1, Math.max(0, Math.floor(((maxLat - item.lat) / span) * CARTOGRAM_BANDS)));
    bands[band].push({ district: item.district, lng: item.lng });
  }

  const tiles: CartogramTile[] = [];
  let columns = 1;
  bands.forEach((band, row) => {
    const sorted = [...band].sort((a, b) => a.lng - b.lng);
    columns = Math.max(columns, sorted.length);
    sorted.forEach((entry, column) => tiles.push({ district: entry.district, row, column }));
  });

  unlocated.forEach((district, index) => {
    tiles.push({ district, row: CARTOGRAM_BANDS - 1, column: bands[CARTOGRAM_BANDS - 1].length + index });
  });
  columns = Math.max(columns, bands[CARTOGRAM_BANDS - 1].length + unlocated.length);

  return { tiles, columns };
};
