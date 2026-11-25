import { useMemo } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { loadElectoralTopology } from '@/utils/electoralTopology';
import { ELECTORAL_TOPOLOGY_VERSION } from '@/utils/electoralTopologyAsset';
import { confirmedPeriodGeometryYear, withPeriodGeometry } from './periodGeometry';
import type { ElectionHistoryData } from './types';

export const periodGeometryQueryKey = (year: number | null) =>
  ['election-history', 'shared-geometry', ELECTORAL_TOPOLOGY_VERSION, year] as const;

/** Load a confirmed boundary state before it is shown, so the map can swap frames without a gap. */
export function prefetchPeriodGeometry(queryClient: QueryClient, year: number | null) {
  if (year === null) return Promise.resolve(null);
  return queryClient.fetchQuery({
    queryKey: periodGeometryQueryKey(year),
    queryFn: () => loadElectoralTopology(year),
    staleTime: Infinity, gcTime: 300_000,
  });
}

export function usePeriodGeometry(data: ElectionHistoryData | undefined, periodId: string | undefined) {
  const period = data?.periods.find(p => p.id === periodId);
  const year = confirmedPeriodGeometryYear(period);
  const geometry = useQuery({
    queryKey: periodGeometryQueryKey(year),
    enabled: !!data && year !== null,
    queryFn: () => loadElectoralTopology(year!),
    staleTime: Infinity, gcTime: 300_000, retry: false,
  });
  const resolved = useMemo(() => data && periodId ? withPeriodGeometry(data, periodId, geometry.data) : data,
    [data, periodId, geometry.data]);
  return { data: resolved, isLoading: geometry.isLoading, error: geometry.error, refetch: geometry.refetch };
}
