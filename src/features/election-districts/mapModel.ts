import type { GeoJsonGeometry } from '@/types/geoDomain';

/** Leaflet expects WGS84 polygons. Reject broken geometry per district rather
 * than letting one invalid import abort the entire map rendering effect. */
export function hasRenderableBoundary(geometry: GeoJsonGeometry | null | undefined): boolean {
  if (!geometry) return false;
  const isRing = (ring: unknown): boolean => Array.isArray(ring) && ring.length >= 4
    && ring.every(point => Array.isArray(point) && point.length >= 2
      && typeof point[0] === 'number' && Number.isFinite(point[0]) && Math.abs(point[0]) <= 180
      && typeof point[1] === 'number' && Number.isFinite(point[1]) && Math.abs(point[1]) <= 90);
  const isPolygon = (polygon: unknown): boolean => Array.isArray(polygon)
    && polygon.length > 0 && polygon.every(isRing);
  if (geometry.type === 'Polygon') return isPolygon(geometry.coordinates);
  return geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)
    && geometry.coordinates.length > 0 && geometry.coordinates.every(isPolygon);
}

export function searchElectionDistricts<T extends { district_number: number; district_name: string; district_type?: string | null }>(districts: T[], query: string): T[] {
  const text = query.trim().toLocaleLowerCase('de-DE');
  if (!text) return [];
  return districts.filter(district => district.district_type !== 'verwaltungsgrenze'
    && (district.district_name.toLocaleLowerCase('de-DE').includes(text)
      || String(district.district_number) === text));
}


export { partyColors } from './partyColors';

export function directMandateParty(district: { representatives?: { mandate_type: string; party: string }[] | null }): string {
  const party = district.representatives?.find(rep => rep.mandate_type === 'direct')?.party?.trim().toUpperCase();
  if (party === 'DIE LINKE') return 'LINKE';
  if (party === 'FDP/DVP' || party === 'DVP') return 'FDP';
  if (party === 'BÜNDNIS 90/DIE GRÜNEN') return 'GRÜNE';
  return party || 'Ohne Direktmandat';
}

/** Spherical polygon area in km²; interior rings subtract holes. */
export function boundaryAreaKm2(geometry: GeoJsonGeometry | null | undefined): number | null {
  if (!hasRenderableBoundary(geometry)) return null;
  const polygons = (geometry!.type === 'Polygon' ? [geometry!.coordinates] : geometry!.coordinates) as number[][][][];
  const radians = Math.PI / 180;
  const ringArea = (ring: number[][]) => {
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      sum += (b[0] - a[0]) * radians * (2 + Math.sin(a[1] * radians) + Math.sin(b[1] * radians));
    }
    return Math.abs(sum * 6371.0088 ** 2 / 2);
  };
  return polygons.reduce((total, rings) => total + Math.max(0, ringArea(rings[0]) - rings.slice(1).reduce((holes, ring) => holes + ringArea(ring), 0)), 0);
}
