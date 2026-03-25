import proj4 from 'proj4';
import JSZip from 'jszip';
import { debugConsole } from '@/utils/debugConsole';
import { hasOwnProperty, isRecord } from '@/utils/typeSafety';

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

type GeoJsonFeatureInput = {
  type: unknown;
  properties: unknown;
  geometry: unknown;
};

interface GeoJsonFeatureCollectionInput {
  type: unknown;
  features: unknown;
  crs?: unknown;
}

export function isGeoJsonFeatureCollection(value: unknown): value is GeoJsonData {
  if (!isRecord(value)) return false;
  if (!hasOwnProperty(value, 'type') || value.type !== 'FeatureCollection') return false;
  if (!hasOwnProperty(value, 'features') || !Array.isArray(value.features)) return false;

  return value.features.every((feature: unknown): feature is GeoJsonFeature => {
    if (!isRecord(feature)) return false;
    const candidate = feature as GeoJsonFeatureInput;
    if (candidate.type !== 'Feature') return false;
    if (!isRecord(candidate.properties)) return false;
    if (!isRecord(candidate.geometry)) return false;
    if (!hasOwnProperty(candidate.geometry, 'type')) return false;
    if (candidate.geometry.type !== 'Polygon' && candidate.geometry.type !== 'MultiPolygon') return false;
    if (!hasOwnProperty(candidate.geometry, 'coordinates') || !Array.isArray(candidate.geometry.coordinates)) return false;
    return true;
  });
}

// Reprojection helpers for German datasets (ETRS89 / UTM32 -> WGS84)
const etrs89Utm32 = '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs';
const wgs84 = 'WGS84';

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
  } catch {
    return null;
  }
  return null;
}

function isProjectedCoord(coord: [number, number] | null): boolean {
  if (!coord) return false;
  const [x, y] = coord;
  // Heuristic: UTM meters are much larger than lon/lat degrees
  return Math.abs(x) > 180 || Math.abs(y) > 90;
}

function reprojectGeometry(geometry: GeoJsonFeature['geometry'], sourceDef: string): GeoJsonFeature['geometry'] {
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates as number[][][];
    const newRings = rings.map(ring => ring.map((coord) => {
      // Only take X,Y coordinates (ignore Z if present)
      const [x, y] = coord.slice(0, 2) as [number, number];
      try {
        const [lon, lat] = proj4(sourceDef, wgs84, [x, y]);
        return [lon, lat];
      } catch (e) {
        debugConsole.warn('Failed to transform coordinate:', [x, y], e);
        return [0, 0]; // fallback
      }
    }));
    return { type: 'Polygon', coordinates: newRings };
  }
  if (geometry.type === 'MultiPolygon') {
    const polys = geometry.coordinates as number[][][][];
    const newPolys = polys.map(rings => rings.map(ring => ring.map((coord) => {
      // Only take X,Y coordinates (ignore Z if present)
      const [x, y] = coord.slice(0, 2) as [number, number];
      try {
        const [lon, lat] = proj4(sourceDef, wgs84, [x, y]);
        return [lon, lat];
      } catch (e) {
        debugConsole.warn('Failed to transform coordinate:', [x, y], e);
        return [0, 0]; // fallback
      }
    })));
    return { type: 'MultiPolygon', coordinates: newPolys };
  }
  return geometry;
}

// Improved German CRS definitions
const projDefs: Record<string, string> = {
  // ETRS89 / UTM zone 32N  
  'EPSG:25832': '+proj=utm +zone=32 +ellps=GRS80 +datum=WGS84 +units=m +no_defs',
  // DHDN / Gauss-Krüger (correct Bessel parameters for Germany)
  'EPSG:31466': '+proj=tmerc +lat_0=0 +lon_0=6 +k=1 +x_0=2500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs',
  'EPSG:31467': '+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=3500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs',
  'EPSG:31468': '+proj=tmerc +lat_0=0 +lon_0=12 +k=1 +x_0=4500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs',
  'EPSG:31469': '+proj=tmerc +lat_0=0 +lon_0=15 +k=1 +x_0=5500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs',
};

function getCrsEpsg(fc: GeoJsonFeatureCollectionInput): string | null {
  if (!isRecord(fc.crs)) return null;
  if (!hasOwnProperty(fc.crs, 'properties') || !isRecord(fc.crs.properties)) return null;
  const name = hasOwnProperty(fc.crs.properties, 'name') ? fc.crs.properties.name : undefined;
  if (typeof name !== 'string') return null;
  if (!name) return null;
  const m = name.match(/EPSG::(\d+)/i) || name.match(/EPSG:(\d+)/i);
  return m ? `EPSG:${m[1]}` : null;
}

function getProjDefForEpsg(epsg: string | null): string | null {
  if (!epsg) return null;
  return projDefs[epsg] || null;
}

function guessGaussKruegerFromX(x: number): string | null {
  // Heuristic for Gauss-Krüger zones based on false easting
  if (x >= 2000000 && x < 3000000) return projDefs['EPSG:31466']; // GK Zone 2
  if (x >= 3000000 && x < 4000000) return projDefs['EPSG:31467']; // GK Zone 3  
  if (x >= 4000000 && x < 5000000) return projDefs['EPSG:31468']; // GK Zone 4
  if (x >= 5000000 && x < 6000000) return projDefs['EPSG:31469']; // GK Zone 5
  return null;
}

function reprojectIfNeeded(fc: GeoJsonData): GeoJsonData {
  // 1) Try to get CRS from metadata
  const epsg = getCrsEpsg(fc);
  let sourceDef = getProjDefForEpsg(epsg);

  // 2) Sample first coordinate to detect projection
  const first = fc.features.find(f => !!f.geometry);
  const sample = first ? sampleFirstCoord(first.geometry) : null;
  const projected = isProjectedCoord(sample);

  if (!sourceDef && projected && sample) {
    // Try to guess projection from coordinate values
    sourceDef = guessGaussKruegerFromX(sample[0]);
    
  }

  if (!projected || !sourceDef) {
    
    return fc;
  }

  
  
  // Test transformation with sample coordinate
  if (sample) {
    try {
      const [testLon, testLat] = proj4(sourceDef, wgs84, [sample[0], sample[1]]);
      
      
      // Sanity check: longitude should be around 8-10 for Baden-Württemberg
      if (testLon < 7 || testLon > 11 || testLat < 47 || testLat > 50) {
        debugConsole.warn('Transformation result seems incorrect, using fallback');
        return fc; // Don't transform if result looks wrong
      }
    } catch (e) {
      debugConsole.error('Test transformation failed:', e);
      return fc;
    }
  }

  const newFeatures = fc.features.map(f => ({
    ...f,
    geometry: reprojectGeometry(f.geometry, sourceDef as string)
  }));
  
  return { ...fc, features: newFeatures };
}

// Try multiple property keys to find the district number
const getDistrictNumberFromProps = (props: Record<string, unknown>): number | undefined => {
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

  let lastError: unknown = null;

  for (const path of candidates) {
    try {
      
      const res = await fetch(path);
      if (!res.ok) {
        debugConsole.warn('Fetch failed for', path, res.status, res.statusText);
        continue;
      }

      const contentType = res.headers.get('content-type') || '';

      let parsedData: unknown = null;

      if (path.endsWith('.zip') || contentType.includes('zip')) {
        const buf = await res.arrayBuffer();
        try {
          const zip = await JSZip.loadAsync(buf);
          const entries = Object.values(zip.files) as Array<{ name: string; async: (type: 'text') => Promise<string> }>;
          const entry = entries.find(f => f.name.endsWith('.geojson') || f.name.endsWith('.json'));
          if (!entry) throw new Error('No .geojson in ZIP');
          const text = await entry.async('text');
          parsedData = JSON.parse(text);
        } catch (e) {
          debugConsole.warn('ZIP parsing failed for', path, e);
          continue;
        }
      } else if (contentType.includes('application/json') || path.endsWith('.geojson') || path.endsWith('.json')) {
        parsedData = await res.json();
      } else if (contentType.includes('text/html')) {
        debugConsole.warn('Received HTML for', path, 'skipping');
        continue;
      } else {
        // Try as text then JSON
        try {
          const txt = await res.text();
          parsedData = JSON.parse(txt);
        } catch {
          debugConsole.warn('Unknown content-type for', path, 'skipping');
          continue;
        }
      }

      if (!isGeoJsonFeatureCollection(parsedData)) {
        debugConsole.warn('Invalid GeoJSON structure from', path);
        continue;
      }

      
      const data = reprojectIfNeeded(parsedData);
      return data;
    } catch (e) {
      lastError = e;
      debugConsole.warn('Failed to load from', path, e);
      continue;
    }
  }

  debugConsole.error('All GeoJSON sources failed');
  if (lastError) throw lastError;
  throw new Error('Unable to load any GeoJSON source');
};
