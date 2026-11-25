import type { GeoJsonFeature } from '@/utils/geoJsonLoader';

/** One SVG even-odd path: shared interiors cancel, changed areas remain.
 * This is rendering geometry only, never a redistribution of election results.
 */
type Position = number[];
type MultiPolygon = { type: 'MultiPolygon'; coordinates: Position[][][] };

export function boundaryDifferencePath(before: GeoJsonFeature['geometry'], after: GeoJsonFeature['geometry']): MultiPolygon {
  const polygons = (geometry: GeoJsonFeature['geometry']): Position[][][] =>
    geometry.type === 'Polygon'
      ? [geometry.coordinates as number[][][]]
      : geometry.coordinates as number[][][][];
  return { type: 'MultiPolygon', coordinates: [...polygons(before), ...polygons(after)] };
}
