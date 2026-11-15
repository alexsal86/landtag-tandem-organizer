import { normalizeElectoralGeoJson, type GeoJsonData } from './geoJsonLoader';
import { ELECTORAL_TOPOLOGY_ASSET } from './electoralTopologyAsset';

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
export const electoralGeometryYear = (year: number) =>
  year === 2006 || year === 2011 || year === 2016 ? year : year === 2021 || year === 2026 ? 2021 : null;

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

// Shared by all selected years; switching years reuses the downloaded topology.
let topologyPromise: Promise<unknown> | undefined;
async function fetchTopology(): Promise<unknown> {
  // Explicit gzip works even on static hosts without content negotiation.
  const url = `${ELECTORAL_TOPOLOGY_ASSET}.gz`;
  const cacheName = 'public-election-topology-v1';
  const lifetime = 157_680_000_000;
  let cache: Cache | undefined;
  let response: Response | undefined;
  try {
    cache = await caches.open(cacheName);
    const stored = await cache.match(url);
    const saved = Number(stored?.headers.get('X-Geometry-Cached-At') ?? 0);
    if (stored?.ok && saved > 0 && Date.now() - saved < lifetime) response = stored;
    // Retire old content hashes without affecting the application shell cache.
    for (const request of await cache.keys()) {
      if (new URL(request.url).pathname !== url) await cache.delete(request);
    }
  } catch { /* Cache Storage can be disabled or full. */ }
  if (!response) {
    response = await fetch(url, { cache: 'force-cache' });
    if (response.ok && cache) {
      const copy = response.clone();
      const headers = new Headers(copy.headers);
      headers.set('X-Geometry-Cached-At', String(Date.now()));
      // Cache the bytes as exposed by fetch (possibly already HTTP-decoded).
      headers.delete('Content-Encoding');
      headers.delete('Content-Length');
      await cache.put(url, new Response(copy.body, { headers })).catch(() => {});
    }
  }
  if (!response.ok || !response.body) throw new Error('Wahlkreisgeometrie nicht verfügbar');
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // Servers may already have decoded a Content-Encoding: gzip response.
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(buffer));
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json();
}
export async function loadElectoralTopology(year: number): Promise<GeoJsonData> {
  const geometryYear = electoralGeometryYear(year);
  if (!geometryYear) throw new Error('Kein hinterlegter Grenzstand für dieses Wahljahr');
  topologyPromise ??= fetchTopology().catch(error => { topologyPromise = undefined; throw error; });
  return decodeElectoralTopology(await topologyPromise, `year${geometryYear}`);
}
