import type { ElectionDistrict } from '@/hooks/useElectionDistricts';
import type { ElectionHistoryData } from './types';

/** Historical names and mandates are central; geometry stays the imported map
 * geometry, explicitly labelled in the view. Never invent historical borders. */
export function projectHistoricalDistricts(base: ElectionDistrict[], data: ElectionHistoryData, periodId: string): ElectionDistrict[] {
  const period = data.periods.find(p => p.id === periodId);
  return base.map(district => {
    if (district.district_type === 'verwaltungsgrenze') return district;
    const historical = data.districts.find(d => d.period_id === periodId && d.district_number === district.district_number);
    const mandates = historical ? data.mandates.filter(m => m.district_id === historical.id && m.period_id === periodId)
      .sort((a, b) => Number(a.entry_type === 'succession') - Number(b.entry_type === 'succession') || a.starts_on.localeCompare(b.starts_on)) : [];
    return { ...district, district_name: historical?.name || district.district_name,
      representatives: mandates.map((m, index) => ({ id: m.id, name: data.people.find(p => p.id === m.person_id)?.name || 'Person nicht verfügbar', party: m.party, mandate_type: m.mandate_type, order_index: index, legislature_period: period?.name })) };
  });
}
