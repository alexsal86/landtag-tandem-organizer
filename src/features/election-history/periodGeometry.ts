import { electoralGeometryYear } from '@/utils/electoralTopology';
import type { GeoJsonData } from '@/utils/geoJsonLoader';
import type { ElectionHistoryData, ElectionPeriod } from './types';

export function confirmedPeriodGeometryYear(period: ElectionPeriod | undefined): number | null {
  if (!period?.boundary_geometry_confirmed || period.election_year == null) return null;
  const year = electoralGeometryYear(period.election_year);
  return year !== null && year === period.boundary_geometry_year ? year : null;
}

/** Number matching is authorized only by the explicit period-level confirmation.
 * Individual historical geometries take precedence and are never overwritten. */
export function withPeriodGeometry(data: ElectionHistoryData, periodId: string, geometry?: GeoJsonData): ElectionHistoryData {
  const period = data.periods.find(p => p.id === periodId);
  if (!geometry || confirmedPeriodGeometryYear(period) === null) return data;
  const shapes = new Map(geometry.features.map(feature => [Number(feature.properties.Nummer), feature.geometry]));
  return { ...data, districts: data.districts.map(district =>
    district.period_id === periodId && district.boundaries == null && district.district_number !== null
      ? { ...district, boundaries: shapes.get(district.district_number) ?? null }
      : district),
  };
}
