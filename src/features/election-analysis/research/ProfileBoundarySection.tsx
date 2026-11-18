import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { electoralGeometryYear } from '@/utils/electoralTopology';
import type { HistoricalDistrict } from '@/features/election-history/types';

const DistrictBoundaryMap = lazy(() => import('@/features/election-history/DistrictBoundaryMap'));

/** Select the map source for this election without changing comparison identities. */
export function ProfileBoundarySection(props: {
  year: number;
  number: number;
  name: string;
  historicalDistrictId?: string | null;
}) {
  const { user } = useAuth();
  const { year, historicalDistrictId } = props;
  const historical = useQuery({
    queryKey: ['election-analysis', user?.id, 'profile-boundary', year, historicalDistrictId],
    enabled: !!user && !!historicalDistrictId,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('election_history_districts')
        .select('boundaries,geometry_source_key,period:election_history_periods!inner(election_year,is_published)')
        .eq('id', historicalDistrictId!)
        .eq('period.election_year', year)
        .eq('period.is_published', true)
        .abortSignal(signal)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const bundledYear = electoralGeometryYear(year);
  return <section className="min-w-0 rounded-lg border bg-card text-card-foreground">
    <div className="space-y-1.5 p-6">
      <h3 className="text-lg font-semibold leading-none tracking-tight">Wahlkreiskarte</h3>
      <p className="text-xs text-muted-foreground">Wahljahr {props.year} · Wahlkreis {props.number}{props.name && `: ${props.name}`}</p>
    </div>
    <div className="px-6 pb-6">
      {historical.isLoading && <p role="status">Lade Karte …</p>}
      {historical.error && <p role="alert" className="text-sm">
        Individuelle Wahlkreisgrenzen konnten nicht geladen werden.{' '}
        <button type="button" className="underline" onClick={() => void historical.refetch()}>Erneut laden</button>
      </p>}
      {!historical.isLoading && !historical.error && <Suspense fallback={<p role="status">Lade Karte …</p>}>
        <DistrictBoundaryMap key={`${year}:${props.number}`} analysis={{
          year,
          number: props.number,
          name: props.name || `Wahlkreis ${props.number}`,
          bundledYear,
          boundaries: historical.data?.boundaries as HistoricalDistrict['boundaries'] ?? null,
          geometrySourceKey: historical.data?.geometry_source_key,
        }} />
      </Suspense>}
    </div>
  </section>;
}
