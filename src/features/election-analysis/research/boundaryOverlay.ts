import type { GeoJsonFeature } from '@/utils/geoJsonLoader';

/** One SVG even-odd path: shared interiors cancel, changed areas remain.
 * This is rendering geometry only, never a redistribution of election results.
 */
export function boundaryDifferencePath(before: GeoJsonFeature['geometry'], after: GeoJsonFeature['geometry']): GeoJSON.MultiPolygon {
  const polygons = (geometry: GeoJsonFeature['geometry']): GeoJSON.Position[][][] =>
    geometry.type === 'Polygon'
      ? [geometry.coordinates as number[][][]]
      : geometry.coordinates as number[][][][];
  return { type: 'MultiPolygon', coordinates: [...polygons(before), ...polygons(after)] };
}
