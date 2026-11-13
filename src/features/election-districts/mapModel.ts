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
