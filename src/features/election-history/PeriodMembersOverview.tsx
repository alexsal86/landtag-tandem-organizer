import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ElectionHistoryData } from './types';
import { historicalDistrictLabel } from './DistrictElectionHistory';

/** All data belongs to this one selected legislature; render only 25 rows. */
export function PeriodMembersOverview({ data, onSelectDistrict }: { data: ElectionHistoryData; onSelectDistrict: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(25);
  const name = (personId: string | null, fallback: string | null) => data.people.find(p => p.id === personId)?.name || fallback || '';
  const rows = data.mandates.filter(m => {
    const district = data.districts.find(d => d.id === m.district_id);
    return `${name(m.person_id, m.person_name)} ${m.party} ${district?.name || 'Landesliste'}`.toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de'));
  }).sort((a, b) => name(a.person_id, a.person_name).localeCompare(name(b.person_id, b.person_name), 'de'));
  return <details className="rounded-xl border bg-card p-3 shadow-sm"><summary className="cursor-pointer text-sm font-medium">Abgeordnete dieser Legislatur ({data.mandates.length})</summary>
    <Input className="mt-3" aria-label="Abgeordnete dieser Legislatur filtern" placeholder="Name, Partei, Wahlkreis …" value={search} onChange={event => { setSearch(event.target.value); setLimit(25); }} />
    <div className="mt-2 space-y-2">{rows.slice(0, limit).map(m => {
      const district = data.districts.find(d => d.id === m.district_id);
      return <div key={m.id} className="border-t pt-2 text-sm"><span className="font-medium">{name(m.person_id, m.person_name)}</span><span className="ml-2 text-xs text-muted-foreground">{m.party}</span>{district ? <button type="button" className="block text-left text-xs underline" onClick={() => onSelectDistrict(district.id)}>{historicalDistrictLabel(district)}</button> : <p className="text-xs text-muted-foreground">Landesliste ohne Wahlkreis</p>}</div>;
    })}</div>
    {rows.length > limit && <Button className="mt-3" size="sm" variant="outline" onClick={() => setLimit(value => value + 25)}>Weitere 25 anzeigen</Button>}
    {!rows.length && <p className="mt-2 text-xs text-muted-foreground">Keine passenden Einträge.</p>}
  </details>;
}
