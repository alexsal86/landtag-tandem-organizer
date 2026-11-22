import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DASHBOARD_GREETINGS_KEY, parseDashboardGreetings } from '@/utils/dashboard/greetings';

export const dashboardGreetingsQueryKey = (tenantId?: string) => [DASHBOARD_GREETINGS_KEY, tenantId];

export function useDashboardGreetings(tenantId?: string) {
  return useQuery({
    queryKey: dashboardGreetingsQueryKey(tenantId),
    enabled: Boolean(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('tenant_id', tenantId)
        .eq('setting_key', DASHBOARD_GREETINGS_KEY)
        .maybeSingle();

      if (error) throw error;
      return parseDashboardGreetings(data?.setting_value);
    },
  });
}
