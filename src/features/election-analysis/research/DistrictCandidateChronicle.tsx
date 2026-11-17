import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type Row = {
  id: string; party: string; outcome: string; vote_share: number | null; votes: number | null; district_rank: number | null;
  person: { name: string } | null;
  district: { name: string; district_number: number | null; period: { election_year: number | null; is_published: boolean } | null } | null;
};

const pct = (v: number | null) => v === null ? '–' : `${v.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`;

/** Sieger- und Bewerberchronik je Wahl. Gleiche Nummer belegt keine gleiche Gebietsidentität über Jahre. */
export function DistrictCandidateChronicle({ district }: { district: number }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['election-analysis', user?.id, 'district-chronicle', district],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('election_history_candidacies')
        .select('id,party,outcome,vote_share,votes,district_rank,person:election_history_people(name),district:election_history_districts!inner(name,district_number,period:election_history_periods!inner(election_year,is_published))')
        .eq('district.district_number', district)
        .eq('district.period.is_published', true)
        .limit(500)
        .abortSignal(signal);
      if (error) throw error;
      return (data || []) as unknown as Row[];
    },
  });
  const byYear = new Map<number, Row[]>();
  for (const r of query.data || []) {
    const y = r.district?.period?.election_year;
    if (!y) continue;
    byYear.set(y, [...(byYear.get(y) || []), r]);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  return <section className="space-y-2 border-t pt-3">
    <h3 className="text-sm font-medium">Sieger- und Bewerberchronik (Wahlkreisnummer {district})</h3>
    {query.isLoading && <p role="status" className="text-xs">Lade Chronik …</p>}
    {query.error && <p role="alert" className="text-xs">Chronik konnte nicht geladen werden.</p>}
    {query.data && years.length === 0 && <p className="text-xs text-muted-foreground">Keine Kandidaturen für diese Wahlkreisnummer erfasst.</p>}
    <div className="overflow-x-auto"><table className="w-full text-xs">
      <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2">Wahl</th><th className="pr-2">Wahlkreis</th><th className="pr-2">Sieger</th><th className="pr-2">Anteil</th><th>Weitere Bewerber</th></tr></thead>
      <tbody>{years.map(y => {
        const rows = byYear.get(y)!.slice().sort((a, b) => (b.vote_share ?? -1) - (a.vote_share ?? -1));
        const winner = rows.find(r => r.district_rank === 1) || rows.find(r => r.outcome === 'direct') || rows[0];
        const others = rows.filter(r => r !== winner);
        return <tr key={y} className="border-t align-top">
          <td className="py-1 pr-2 tabular-nums">{y}</td>
          <td className="pr-2">{winner.district?.name}</td>
          <td className="pr-2 font-medium">{winner.person?.name || '–'} · {winner.party}</td>
          <td className="pr-2 tabular-nums">{pct(winner.vote_share)}</td>
          <td>{others.map(o => `${o.person?.name || '–'} (${o.party}, ${pct(o.vote_share)}${o.outcome === 'list' ? ', über Liste' : ''})`).join('; ') || '–'}</td>
        </tr>;
      })}</tbody>
    </table></div>
    <p className="text-xs text-muted-foreground">Jede Zeile zeigt den Wahlkreis mit dieser Nummer im jeweiligen Wahljahr. Zuschnitt und Name können sich geändert haben; eine gleiche Nummer belegt kein gleiches Gebiet. Fehlende Werte bleiben leer.</p>
  </section>;
}
