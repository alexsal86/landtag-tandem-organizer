import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ThemenspeicherPanel } from "./ThemenspeicherPanel";
import { SocialMediaPlannerPanel } from "./SocialMediaPlannerPanel";
import { DEFAULT_SPECIAL_DAYS, parseSpecialDaysSetting } from "@/utils/dashboard/specialDays";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

export function MyWorkRedaktionTab() {
  const { currentTenant } = useTenant();

  const { data: specialDays = DEFAULT_SPECIAL_DAYS } = useQuery({
    queryKey: ['dashboard-special-days', currentTenant?.id],
    queryFn: async () => {
      try {
        let query = supabase.from('app_settings').select('setting_value')
          .eq('setting_key', 'dashboard_special_day_hints').limit(1);
        query = currentTenant?.id ? query.eq('tenant_id', currentTenant.id) : query.is('tenant_id', null);
        const { data } = await query.maybeSingle();
        return parseSpecialDaysSetting(data?.setting_value) || DEFAULT_SPECIAL_DAYS;
      } catch {
        return DEFAULT_SPECIAL_DAYS;
      }
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  const [, setContentRefreshToken] = useState(0);

  return (
    <div className="p-4 pb-8">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <SocialMediaPlannerPanel specialDays={specialDays} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <ThemenspeicherPanel onContentCreated={() => setContentRefreshToken((prev) => prev + 1)} />
        </div>
      </div>
    </div>
  );
}
