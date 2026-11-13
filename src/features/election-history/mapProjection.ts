import type { ElectionDistrict } from '@/hooks/useElectionDistricts';
import { hasRenderableBoundary } from '@/features/election-districts/mapModel';
import type { ElectionHistoryData } from './types';

/** Only genuine historical geometry is drawn. Neither numbers nor names prove
 * that the current boundaries describe the same historical constituency. */
export function projectHistoricalDistricts(base: ElectionDistrict[], data: ElectionHistoryData, periodId: string): ElectionDistrict[] {
  const period = data.periods.find(p => p.id === periodId);
  return [
    ...base.filter(d => d.district_type === 'verwaltungsgrenze'),
    ...data.districts.filter(d => d.period_id === periodId && hasRenderableBoundary(d.boundaries)).map(d => {
      const mandates = data.mandates.filter(m => m.district_id === d.id && m.period_id === periodId)
        .sort((a, b) => Number(a.entry_type === 'succession') - Number(b.entry_type === 'succession') || (a.starts_on || '').localeCompare(b.starts_on || ''));
      const points: number[][] = [];
      const collect = (value: unknown): void => {
        if (!Array.isArray(value)) return;
        if (typeof value[0] === 'number' && typeof value[1] === 'number') points.push(value as number[]);
        else value.forEach(collect);
      };
      collect(d.boundaries?.coordinates);
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      for (const point of points) {
        minLng = Math.min(minLng, point[0]); maxLng = Math.max(maxLng, point[0]);
        minLat = Math.min(minLat, point[1]); maxLat = Math.max(maxLat, point[1]);
      }
      return {
        id: d.id, district_number: d.district_number || 0, district_name: d.name, region: 'Baden-Württemberg',
        boundaries: d.boundaries, district_type: 'wahlkreis', created_at: '', updated_at: '',
        center_coordinates: points.length ? {
          lng: (minLng + maxLng) / 2,
          lat: (minLat + maxLat) / 2,
        } : null,
        representatives: mandates.map((m, index) => ({ id: m.id, name: data.people.find(p => p.id === m.person_id)?.name || m.person_name || 'Name nicht erfasst', party: m.party, mandate_type: m.mandate_type, order_index: index, legislature_period: period?.name })),
      } satisfies ElectionDistrict;
    }),
  ];
}
