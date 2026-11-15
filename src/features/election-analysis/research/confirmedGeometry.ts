import { supabase } from '@/integrations/supabase/client';
import { electoralGeometryYear, loadElectoralTopology } from '@/utils/electoralTopology';
import type { DistrictVersion } from './types';

// Canonicalize ring direction/start and polygon order; never round coordinates.
function canonicalGeometry(geometry: { type: string; coordinates: number[][][] | number[][][][] }): string {
  const ring = (points: number[][]) => {
    const open = points.slice();
    if (JSON.stringify(open[0]) === JSON.stringify(open[open.length - 1])) open.pop();
    const candidates = [open, [...open].reverse()].flatMap(direction => {
      const minimum = direction.map(p => JSON.stringify(p)).sort()[0];
      return direction.flatMap((p, i) => JSON.stringify(p) === minimum
        ? [JSON.stringify([...direction.slice(i), ...direction.slice(0, i)])] : []);
    });
    return candidates.sort()[0];
  };
  const polygon = (rings: number[][][]) => [ring(rings[0]), rings.slice(1).map(ring).sort()];
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates as number[][][]] : geometry.coordinates as number[][][][];
  return JSON.stringify(polygons.map(p => JSON.stringify(polygon(p))).sort());
}

/** Reuse explicit period attestations without persisting or guessing analysis identities. */
export async function withConfirmedGeometry(versions: DistrictVersion[], signal: AbortSignal): Promise<DistrictVersion[]> {
  const years = [...new Set(versions.map(v => v.year))].filter(y => electoralGeometryYear(y) !== null);
  if (!years.length) return versions;
  const { data: periods, error } = await supabase.from('election_history_periods')
    .select('id,election_year,boundary_geometry_year,boundary_geometry_confirmed')
    .in('election_year', years).eq('is_published', true).eq('boundary_geometry_confirmed', true).abortSignal(signal);
  if (error) throw error;
  const confirmed = (periods ?? []).filter(p => typeof p.election_year === 'number'
    && typeof p.boundary_geometry_year === 'number'
    && p.boundary_geometry_year === electoralGeometryYear(p.election_year));
  if (!confirmed.length) return versions;
  const { data: districts, error: districtError } = await supabase.from('election_history_districts')
    .select('id,period_id,district_number').in('period_id', confirmed.map(p => p.id)).is('boundaries', null).limit(700).abortSignal(signal);
  if (districtError) throw districtError;
  const geometryYears = [...new Set(confirmed.map(p => p.boundary_geometry_year))]
    .filter((year): year is number => typeof year === 'number');
  const geometries = new Map(await Promise.all(geometryYears
    .map(async year => [year, await loadElectoralTopology(year)] as const)));
  return Promise.all(versions.map(async version => {
    // An explicit analysis assignment retains precedence.
    if (version.geography_id || version.identity_key) return version;
    const matches = confirmed.filter(p => p.election_year === version.year);
    if (matches.length !== 1) return version;
    const period = matches[0];
    if (typeof period.boundary_geometry_year !== 'number') return version;
    const district = districts?.find(d => d.period_id === period.id && d.district_number === version.district_number);
    // Individual historical shapes cannot be silently replaced by the shared asset.
    if (!district || (version.historical_district_id && version.historical_district_id !== district.id)) return version;
    const geometry = geometries.get(period.boundary_geometry_year)?.features
      .find(f => Number(f.properties.Nummer) === version.district_number)?.geometry;
    if (!geometry) return version;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalGeometry(geometry)));
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    return { ...version, bundled_geometry_year: period.boundary_geometry_year, identity_key: `confirmed-shape-${hash}` };
  }));
}
