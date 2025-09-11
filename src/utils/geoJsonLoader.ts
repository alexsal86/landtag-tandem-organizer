import proj4 from 'proj4';
import JSZip from 'jszip';

export interface GeoJsonFeature {
  type: 'Feature';
  properties: {
    WKR_NR?: number;
    WKR_NAME?: string;
    [key: string]: any;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

type Coordinate = [number, number];
type LinearRing = Coordinate[];
type Polygon = LinearRing[];
type MultiPolygon = Polygon[];

export interface GeoJsonData {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

// Reprojection helpers for German datasets (ETRS89 / UTM32 -> WGS84)
const etrs89Utm32 = '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs';
const wgs84 = 'WGS84';

type AnyCoords = any;

function sampleFirstCoord(geometry: GeoJsonFeature['geometry']): [number, number] | null {
  try {
    if (geometry.type === 'Polygon') {
      const ring = geometry.coordinates[0] as number[][];
      if (ring && ring[0]) return [ring[0][0] as number, ring[0][1] as number];
    } else if (geometry.type === 'MultiPolygon') {
      const poly = geometry.coordinates[0] as number[][][];
      const ring = poly && poly[0];
      if (ring && ring[0]) return [ring[0][0] as number, ring[0][1] as number];
    }
  } catch {}
  return null;
}

function isProjectedCoord([x, y]: [number, number] | null): boolean {
  if (!x && x !== 0) return false;
  if (!y && y !== 0) return false;
  // Heuristic: UTM meters are much larger than lon/lat degrees
  return Math.abs(x as number) > 180 || Math.abs(y as number) > 90;
}

function reprojectGeometry(geometry: GeoJsonFeature['geometry']): GeoJsonFeature['geometry'] {
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates as number[][][];
    const newRings = rings.map(ring => ring.map(([x, y]) => {
      const [lon, lat] = proj4(etrs89Utm32, wgs84, [x, y]);
      return [lon, lat];
    })) as AnyCoords;
    return { type: 'Polygon', coordinates: newRings } as any;
  }
  if (geometry.type === 'MultiPolygon') {
    const polys = geometry.coordinates as number[][][][];
    const newPolys = polys.map(rings => rings.map(ring => ring.map(([x, y]) => {
      const [lon, lat] = proj4(etrs89Utm32, wgs84, [x, y]);
      return [lon, lat];
    }))) as AnyCoords;
    return { type: 'MultiPolygon', coordinates: newPolys } as any;
  }
  return geometry;
}

function reprojectIfNeeded(fc: GeoJsonData): GeoJsonData {
  const first = fc.features.find(f => !!f.geometry);
  const sample = first ? sampleFirstCoord(first.geometry) : null;
  const projected = isProjectedCoord(sample);
  if (!projected) return fc; // already WGS84

  console.log('GeoJSON appears projected (UTM). Reprojecting to WGS84...');
  const newFeatures = fc.features.map(f => ({
    ...f,
    geometry: reprojectGeometry(f.geometry)
  }));
  return { ...fc, features: newFeatures };
}

// Try multiple property keys to find the district number
const getDistrictNumberFromProps = (props: Record<string, any>): number | undefined => {
  const candidates = [
    'WKR_NR', 'WKRNR', 'WK_NR', 'NR', 'WKR', 'WKR_NR_2021', 'WKR_NR21', 'WKRNR21', 'Wahlkreis_Nr'
  ];
  for (const key of candidates) {
    if (props[key] !== undefined && props[key] !== null) {
      const n = typeof props[key] === 'string' ? parseInt(props[key], 10) : Number(props[key]);
      if (!Number.isNaN(n)) return n;
    }
  }
  // Also scan any numeric-looking property
  for (const [k, v] of Object.entries(props)) {
    if (/wkr.?nr/i.test(k) || /wahlkreis.?nr/i.test(k)) {
      const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
};
export const loadElectoralDistrictsGeoJson = async (): Promise<GeoJsonData> => {
  const candidates = [
    '/data/LTWahlkreise2021-BW.geojson',
    '/data/LTWahlkreise2021-BW_GEOJSON.geojson',
    '/data/LTWahlkreise2021-BW_GEOJSON.zip',
    '/data/sample-wahlkreise.geojson',
  ];

  let lastError: any = null;

  for (const path of candidates) {
    try {
      console.log('Attempting to load GeoJSON from', path);
      const res = await fetch(path);
      if (!res.ok) {
        console.warn('Fetch failed for', path, res.status, res.statusText);
        continue;
      }

      const contentType = res.headers.get('content-type') || '';

      let fc: GeoJsonData | null = null;

      if (path.endsWith('.zip') || contentType.includes('zip')) {
        const buf = await res.arrayBuffer();
        try {
          const zip = await JSZip.loadAsync(buf);
          const entry = Object.values(zip.files).find(f => f.name.endsWith('.geojson') || f.name.endsWith('.json'));
          if (!entry) throw new Error('No .geojson in ZIP');
          const text = await entry.async('text');
          fc = JSON.parse(text);
        } catch (e) {
          console.warn('ZIP parsing failed for', path, e);
          continue;
        }
      } else if (contentType.includes('application/json') || path.endsWith('.geojson') || path.endsWith('.json')) {
        fc = await res.json();
      } else if (contentType.includes('text/html')) {
        console.warn('Received HTML for', path, 'skipping');
        continue;
      } else {
        // Try as text then JSON
        try {
          const txt = await res.text();
          fc = JSON.parse(txt);
        } catch {
          console.warn('Unknown content-type for', path, 'skipping');
          continue;
        }
      }

      if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
        console.warn('Invalid GeoJSON structure from', path);
        continue;
      }

      console.log('Loaded FeatureCollection from', path, 'features:', fc.features.length);
      const data = reprojectIfNeeded(fc as GeoJsonData);
      return data;
    } catch (e) {
      lastError = e;
      console.warn('Failed to load from', path, e);
      continue;
    }
  }

  console.error('All GeoJSON sources failed');
  if (lastError) throw lastError;
  throw new Error('Unable to load any GeoJSON source');
};