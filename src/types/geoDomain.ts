import { hasOwnProperty, isRecord } from '@/utils/typeSafety';

export type GeoJsonGeometry = {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: unknown;
};

export type GeoProperties = Record<string, unknown>;

export interface Feature<TProperties extends GeoProperties = GeoProperties> {
  type: 'Feature';
  properties: TProperties;
  geometry: GeoJsonGeometry;
}

export interface FeatureCollection<TProperties extends GeoProperties = GeoProperties> {
  type: 'FeatureCollection';
  features: Feature<TProperties>[];
}

export interface LayerConfig<TFeature extends Feature = Feature> {
  id: string;
  label: string;
  visible: boolean;
  features: TFeature[];
}

export function hasProperties<TProperties extends GeoProperties = GeoProperties>(
  value: unknown,
): value is Feature<TProperties> {
  if (!isRecord(value)) return false;
  if (!hasOwnProperty(value, 'type') || value.type !== 'Feature') return false;
  if (!hasOwnProperty(value, 'properties') || !isRecord(value.properties)) return false;
  if (!hasOwnProperty(value, 'geometry') || !isRecord(value.geometry)) return false;
  if (!hasOwnProperty(value.geometry, 'type')) return false;

  return value.geometry.type === 'Polygon' || value.geometry.type === 'MultiPolygon';
}

export function isFeatureCollection<TProperties extends GeoProperties = GeoProperties>(
  value: unknown,
): value is FeatureCollection<TProperties> {
  if (!isRecord(value)) return false;
  if (!hasOwnProperty(value, 'type') || value.type !== 'FeatureCollection') return false;
  if (!hasOwnProperty(value, 'features') || !Array.isArray(value.features)) return false;

  return value.features.every((feature) => hasProperties<TProperties>(feature));
}
