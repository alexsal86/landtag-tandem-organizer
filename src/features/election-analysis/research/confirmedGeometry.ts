import { isReconstructedBoundary } from '@/utils/electoralGeometryCatalog';
import { supabase } from '@/integrations/supabase/client';
import { electoralGeometryYear, loadElectoralManifest } from '@/utils/electoralTopology';
import type { DistrictVersion } from './types';

/** Reuse explicit period attestations without persisting or guessing analysis identities. */
export async function withConfirmedGeometry(versions: DistrictVersion[], signal: AbortSignal): Promise<DistrictVersion[]> {
  const years = [...new Set(versions.map(v => v.year))].filter(y => electoralGeometryYear(y) !== null && !isReconstructedBoundary(y));
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
  const manifests = new Map(await Promise.all(geometryYears
    .map(async year => [year, await loadElectoralManifest(year)] as const)));
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
    // The packer uses the same exact canonical coordinate hash as the former
    // runtime canonicalGeometry implementation. No polygon download is needed.
    const shape = manifests.get(period.boundary_geometry_year)?.districts
      .find(d => Number(d.properties.Nummer) === version.district_number)?.shape;
    if (!shape) return version;
    return { ...version, bundled_geometry_year: period.boundary_geometry_year, identity_key: `confirmed-shape-${shape}` };
  }));
}
