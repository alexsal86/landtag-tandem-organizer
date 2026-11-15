import { boundaryYearCandidate } from './electoralGeometryCatalog';
import { normalizeElectoralGeoJson, type GeoJsonData } from './geoJsonLoader';
import { ELECTORAL_TOPOLOGY_MANIFESTS } from './electoralTopologyAsset';

type DistrictGeometry = {
  type: 'Polygon' | 'MultiPolygon';
  arcs: number[][] | number[][][];
  properties?: Record<string, unknown>;
};
type DistrictTopology = {
  type: 'Topology';
  arcs: number[][][];
  transform?: { scale: [number, number]; translate: [number, number] };
  objects: Record<string, { type: 'GeometryCollection'; geometries: DistrictGeometry[] }>;
};
export const electoralGeometryYear = (year: number): number | null => {
  const boundaryYear = boundaryYearCandidate(year);
  return Object.prototype.hasOwnProperty.call(ELECTORAL_TOPOLOGY_MANIFESTS, boundaryYear) ? boundaryYear : null;
};

/** Polygon-only TopoJSON adapter; preserves every supplied coordinate. */
export function decodeElectoralTopology(input: unknown, objectName: string): GeoJsonData {
  const topology = input as DistrictTopology;
  if (topology?.type !== 'Topology' || !Array.isArray(topology.arcs))
    throw new Error('Ungültige TopoJSON-Geometrie');
  const object = topology.objects?.[objectName];
  if (object?.type !== 'GeometryCollection' || !Array.isArray(object.geometries))
    throw new Error('Grenzstand fehlt in TopoJSON');
  const arc = (reference: number): number[][] => {
    if (!Number.isInteger(reference)) throw new Error('Ungültiger Grenzverweis');
    const source = topology.arcs[reference < 0 ? ~reference : reference];
    if (!Array.isArray(source)) throw new Error('Grenzlinie fehlt');
    let x = 0, y = 0;
    const result = source.map(point => {
      if (!Array.isArray(point) || point.length < 2 || !point.every(Number.isFinite))
        throw new Error('Ungültige Grenzkoordinate');
      if (!topology.transform) return [...point];
      x += point[0]; y += point[1];
      const { scale, translate } = topology.transform;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
    return reference < 0 ? result.reverse() : result;
  };
  const ring = (references: number[]) => {
    const points: number[][] = [];
    for (const reference of references) {
      const segment = arc(reference);
      if (points.length) points.pop();
      for (const point of segment) points.push(point);
    }
    if (points.length < 4) throw new Error('Ungültiger Grenzring');
    return points;
  };
  return normalizeElectoralGeoJson({ type: 'FeatureCollection', features: object.geometries.map(g => {
    if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') throw new Error('Nicht unterstützte Wahlkreisform');
    return { type: 'Feature', properties: g.properties ?? {}, geometry: {
      type: g.type,
      coordinates: g.type === 'Polygon' ? (g.arcs as number[][]).map(ring)
        : (g.arcs as number[][][]).map(polygon => polygon.map(ring)),
    } };
  }) });
}

type ManifestDistrict = {
  shape: string;
  package: string;
  properties: GeoJsonData['features'][number]['properties'];
};
export interface ElectoralGeometryManifest {
  version: 1;
  year: number;
  districts: ManifestDistrict[];
}

export function parseElectoralManifest(input: unknown, year: number): ElectoralGeometryManifest {
  const manifest = input as ElectoralGeometryManifest;
  if (manifest?.version !== 1 || manifest.year !== year || !Array.isArray(manifest.districts)
      || manifest.districts.length !== 70) throw new Error('Ungültige Wahlkreiszuordnung');
  const numbers = new Set<number>();
  for (const district of manifest.districts) {
    const number = Number(district?.properties?.Nummer);
    if (!Number.isInteger(number) || number < 1 || number > 70 || numbers.has(number)
        || !/^[a-f0-9]{64}$/.test(district.shape)
        || !/^\/data\/geometry\/shapes-[a-f0-9]{64}\.topojson$/.test(district.package))
      throw new Error('Ungültige Wahlkreisform oder Paketadresse');
    numbers.add(number);
  }
  return manifest;
}

/** Only packages containing still-missing forms for this selected year. */
export function requiredElectoralPackages(manifest: ElectoralGeometryManifest, available: ReadonlySet<string>): string[] {
  return [...new Set(manifest.districts.filter(district => !available.has(district.shape)).map(district => district.package))];
}

const requests = new Map<string, Promise<unknown>>();
const shapes = new Map<string, GeoJsonData['features'][number]['geometry']>();
const years = new Map<number, Promise<GeoJsonData>>();
const CACHE_NAME = 'public-election-shapes-v2';
const CACHE_LIFETIME = 157_680_000_000;
let retiredLegacyCache = false;

async function fetchGeometryJson(path: string): Promise<unknown> {
  // Gzip is explicit, so it also works without server content negotiation.
  const url = `${path}.gz`;
  let cache: Cache | undefined;
  let response: Response | undefined;
  try {
    cache = await caches.open(CACHE_NAME);
    if (!retiredLegacyCache) {
      retiredLegacyCache = true;
      await caches.delete('public-election-topology-v1');
    }
    const stored = await cache.match(url);
    const saved = Number(stored?.headers.get('X-Geometry-Cached-At') ?? 0);
    if (stored?.ok && saved > 0 && Date.now() - saved < CACHE_LIFETIME) response = stored;
    else if (stored) await cache.delete(url);
  } catch { /* Cache Storage can be disabled or full. */ }
  if (!response) {
    response = await fetch(url, { cache: 'force-cache' });
    if (response.ok && cache) {
      const copy = response.clone();
      const headers = new Headers(copy.headers);
      headers.set('X-Geometry-Cached-At', String(Date.now()));
      // Fetch may already have decoded Content-Encoding: gzip.
      headers.delete('Content-Encoding');
      headers.delete('Content-Length');
      await cache.put(url, new Response(copy.body, { headers })).catch(() => {});
    }
  }
  if (!response.ok || !response.body) throw new Error('Wahlkreisgeometrie nicht verfügbar');
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(buffer));
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json();
}
function loadGeometryJson(path: string): Promise<unknown> {
  let request = requests.get(path);
  if (!request) {
    request = fetchGeometryJson(path).catch(async error => {
      requests.delete(path);
      try { await (await caches.open(CACHE_NAME)).delete(`${path}.gz`); } catch { /* Optional cache. */ }
      throw error;
    });
    requests.set(path, request);
  }
  return request;
}

/** Resolve a year's small manifest; load each required package only once.
 * Shared forms retain their cache entries when switching years. */
export async function loadElectoralTopology(year: number): Promise<GeoJsonData> {
  const geometryYear = electoralGeometryYear(year);
  const path = geometryYear === null ? undefined : ELECTORAL_TOPOLOGY_MANIFESTS[geometryYear];
  if (geometryYear === null || !path) throw new Error('Kein hinterlegter Grenzstand für dieses Wahljahr');
  let result = years.get(geometryYear);
  if (!result) {
    result = (async (): Promise<GeoJsonData> => {
      const manifest = parseElectoralManifest(await loadGeometryJson(path), geometryYear);
      const packagePaths = requiredElectoralPackages(manifest, new Set(shapes.keys()));
      const packages = new Map(await Promise.all(packagePaths.map(async packagePath =>
        [packagePath, await loadGeometryJson(packagePath)] as const)));
      return { type: 'FeatureCollection', features: manifest.districts.map(district => {
        let geometry = shapes.get(district.shape);
        if (!geometry) {
          const decoded = decodeElectoralTopology(packages.get(district.package), district.shape);
          if (decoded.features.length !== 1) throw new Error('Wahlkreisform ist nicht eindeutig');
          geometry = decoded.features[0].geometry;
          shapes.set(district.shape, geometry);
        }
        return { type: 'Feature', properties: district.properties, geometry };
      }) };
    })().catch(error => { years.delete(geometryYear); throw error; });
    years.set(geometryYear, result);
  }
  return result;
}
