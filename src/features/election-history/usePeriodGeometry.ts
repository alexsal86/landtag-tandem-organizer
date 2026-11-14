import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadElectoralTopology } from '@/utils/electoralTopology';
import { ELECTORAL_TOPOLOGY_ASSET } from '@/utils/electoralTopologyAsset';
import { confirmedPeriodGeometryYear, withPeriodGeometry } from './periodGeometry';
import type { ElectionHistoryData } from './types';

export function usePeriodGeometry(data: ElectionHistoryData | undefined, periodId: string | undefined) {
  const period = data?.periods.find(p => p.id === periodId);
  const year = confirmedPeriodGeometryYear(period);
  const geometry = useQuery({
    queryKey: ['election-history', 'shared-geometry', ELECTORAL_TOPOLOGY_ASSET, year],
    enabled: !!data && year !== null,
    queryFn: () => loadElectoralTopology(year!),
    staleTime: Infinity, gcTime: 300_000, retry: false,
  });
  const resolved = useMemo(() => data && periodId ? withPeriodGeometry(data, periodId, geometry.data) : data,
    [data, periodId, geometry.data]);
  return { data: resolved, isLoading: geometry.isLoading, error: geometry.error, refetch: geometry.refetch };
}
