import { sourceHistoricalDistrictName } from '@/utils/electoralGeometryCatalog';
import type { ElectionHistoryData } from './types';

/** Normalize only explicitly sourced same-year labels. No district numbers,
 * IDs, personal identities or mandate/candidacy links are changed. */
export function withHistoricalDistrictNames(data: ElectionHistoryData): ElectionHistoryData {
  const years = new Map(data.periods.map(period => [period.id, period.election_year]));
  return { ...data, districts: data.districts.map(district => {
    const name = sourceHistoricalDistrictName(years.get(district.period_id), district.district_number);
    return name && name !== district.name ? { ...district, name } : district;
  }) };
}
