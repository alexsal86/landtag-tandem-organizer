import { Portal } from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { candidateOutcomeLabel, type LinkedCandidateResult } from '@/features/election-history/candidateResults';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type Row = {
  id: string; party: string; outcome: LinkedCandidateResult['outcome']; ballot_type: LinkedCandidateResult['ballot_type']; vote_share: number | null; votes: number | null; district_rank: number | null;
  person: { name: string } | null;
  district: { id: string; name: string; period: { id: string; election_year: number | null; is_published: boolean } | null } | null;
};

const pct = (v: number | null) => v === null ? '–' : `${v.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`;

function VoteCount({ votes, children }: { votes: number | null; children: ReactNode }) {
  if (votes === null) return <>{children}</>;

  return <Tooltip>
    <TooltipTrigger asChild>
      <span tabIndex={0} className="cursor-help rounded-sm focus-visible:outline focus-visible:outline-ring">{children}</span>
    </TooltipTrigger>
    <Portal>
      <TooltipContent>{votes.toLocaleString('de-DE')} Stimmen</TooltipContent>
    </Portal>
  </Tooltip>;
}

function CandidateName({ candidate }: { candidate: Row }) {
  const name = candidate.person?.name || '–';
  return <VoteCount votes={candidate.votes}>
    {candidate.outcome === 'list' ? <strong>{name}</strong> : name}
  </VoteCount>;
}

function ListMandate({ candidate }: { candidate: Row }) {
  return candidate.outcome === 'list' ? <>, {candidateOutcomeLabel(candidate)}</> : null;
}

/** Sieger- und Bewerberchronik je Wahl. Gleiche Nummer belegt keine gleiche Gebietsidentität über Jahre. */
export function DistrictCandidateChronicle({
  district, selectedYear, linkedDistrictId,
}: { district: number; selectedYear: number; linkedDistrictId?: string | null }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['election-analysis', user?.id, 'district-chronicle', district],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('election_history_candidacies')
        .select('id,party,outcome,ballot_type,vote_share,votes,district_rank,person:election_history_people(name),district:election_history_districts!inner(id,name,period:election_history_periods!inner(id,election_year,is_published))')
        .eq('district.district_number', district)
        .eq('district.period.is_published', true)
        .limit(500)
        .abortSignal(signal);
      if (error) throw error;
      return (data || []) as unknown as Row[];
    },
  });
  const selectedPeriodId = linkedDistrictId ? query.data?.find(
    (row) => row.district?.id === linkedDistrictId && row.district.period?.election_year === selectedYear,
  )?.district?.period?.id : undefined;
  const linkedResults = useQuery({
    queryKey: ['election-history', user?.id, 'candidate-results', selectedPeriodId, linkedDistrictId],
    enabled: !!user && !!selectedPeriodId && !!linkedDistrictId,
    staleTime: 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!selectedPeriodId || !linkedDistrictId) throw new Error('Wahlkreiszuordnung fehlt.');
      const { data, error } = await supabase.rpc('get_election_candidate_results', {
        selected_period: selectedPeriodId,
        selected_district: linkedDistrictId,
      }).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Ungültige Kandidaturergebnisse.');
      return data as unknown as LinkedCandidateResult[];
    },
  });
  const officialVotes = new Map((linkedResults.data || [])
    .filter((row) => row.link_status === 'linked')
    .map((row) => [row.candidacy_id, row.district_result?.votes ?? null]));

  const byYear = new Map<number, Row[]>();
  for (const r of query.data || []) {
    const y = r.district?.period?.election_year;
    if (!y) continue;
    const votes = r.votes ?? officialVotes.get(r.id) ?? null;
    byYear.set(y, [...(byYear.get(y) || []), { ...r, votes }]);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  return <section className="space-y-2 border-t pt-3">
    <h3 className="text-sm font-medium">Sieger- und Bewerberchronik (Wahlkreisnummer {district})</h3>
    {query.isLoading && <p role="status" className="text-xs">Lade Chronik …</p>}
    {query.error && <p role="alert" className="text-xs">Chronik konnte nicht geladen werden.</p>}
    {query.data && years.length === 0 && <p className="text-xs text-muted-foreground">Keine Kandidaturen für diese Wahlkreisnummer erfasst.</p>}
    {linkedResults.error && <p role="status" className="text-xs text-muted-foreground">
      Zugeordnete Stimmenzahlen konnten nicht geladen werden.{' '}
      <button type="button" className="underline" onClick={() => void linkedResults.refetch()}>Erneut laden</button>
    </p>}
    <TooltipProvider>
      <div className="overflow-x-auto"><table className="w-full min-w-[40rem] text-xs [&_th]:px-2 [&_th]:py-2 [&_th]:align-top [&_td]:px-2 [&_td]:py-2 [&_td]:align-top">
        <thead><tr className="text-left text-muted-foreground"><th className="whitespace-nowrap">Wahl</th><th className="whitespace-nowrap">Wahlkreis</th><th className="whitespace-nowrap">Sieger</th><th className="whitespace-nowrap">Anteil</th><th>Weitere Bewerber</th></tr></thead>
        <tbody>{years.map(y => {
          const rows = byYear.get(y)!.slice().sort((a, b) => (b.vote_share ?? -1) - (a.vote_share ?? -1));
          const winner = rows.find(r => r.outcome === 'direct') ?? rows.find(r => r.district_rank === 1 && r.outcome === 'unknown');
          const others = rows.filter(r => r !== winner);
          const selected = y === selectedYear;
          return <tr key={y} className={selected ? 'border-t align-top bg-primary/10' : 'border-t align-top'}>
            <td className="whitespace-nowrap tabular-nums" aria-current={selected ? 'true' : undefined}>{y}</td>
            <td className="whitespace-nowrap">{rows[0].district?.name}</td>
            <td className="font-medium">
              {winner ? <><CandidateName candidate={winner} /> · {winner.party}</> : '–'}
            </td>
            <td className="whitespace-nowrap tabular-nums">
              {winner ? <VoteCount votes={winner.votes}>{pct(winner.vote_share)}</VoteCount> : '–'}
            </td>
            <td>{others.length ? <ul className="space-y-2">
              {others.map(candidate => <li key={candidate.id} className="grid grid-cols-[minmax(8rem,1fr)_auto] items-baseline gap-x-3">
                <span>
                  <CandidateName candidate={candidate} /> <span className="text-muted-foreground">({candidate.party}<ListMandate candidate={candidate} />)</span>
                </span>
                <span className="whitespace-nowrap tabular-nums">{pct(candidate.vote_share)}</span>
              </li>)}
            </ul> : '–'}</td>
          </tr>;
        })}</tbody>
      </table></div>
    </TooltipProvider>
    <p className="text-xs text-muted-foreground">Jede Zeile zeigt den Wahlkreis mit dieser Nummer im jeweiligen Wahljahr. Zuschnitt und Name können sich geändert haben; eine gleiche Nummer belegt kein gleiches Gebiet. Fehlende Werte bleiben leer.</p>
  </section>;
}
