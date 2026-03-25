import type { Feature, GeoJsonGeometry } from '@/types/geoDomain';
import { hasOwnProperty, isRecord } from '@/utils/typeSafety';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoContactInfo {
  phone?: string;
  email?: string;
  website?: string;
  [key: string]: unknown;
}

export interface ElectionDistrictFeatureProperties {
  district_number?: number;
  district_name?: string;
  region?: string;
  [key: string]: unknown;
}

export interface AssociationFeatureProperties {
  association_id?: string;
  association_name?: string;
  district_id?: string;
  district_name?: string;
  [key: string]: unknown;
}

export type ElectionDistrictFeature = Feature<ElectionDistrictFeatureProperties>;
export type AssociationFeature = Feature<AssociationFeatureProperties>;

export function normalizeGeoPoint(value: unknown): GeoPoint | null {
  if (!isRecord(value)) {
    return null;
  }

  const lat = value.lat;
  const lng = value.lng;
  return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;
}

export function normalizeGeoJsonGeometry(value: unknown): GeoJsonGeometry | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = value.type;
  if (type !== 'Polygon' && type !== 'MultiPolygon') {
    return null;
  }

  if (!hasOwnProperty(value, 'coordinates')) {
    return null;
  }

  return {
    type,
    coordinates: value.coordinates,
  };
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

export function normalizeContactInfo(value: unknown): GeoContactInfo | null {
  return isRecord(value) ? value : null;
}

