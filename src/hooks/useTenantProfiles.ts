import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";

export interface TenantProfileOption {
  user_id: string;
  display_name: string | null;
}

export function useTenantProfiles() {
  const { currentTenant } = useTenant();

  const query = useQuery({
    queryKey: ["tenant-profiles", currentTenant?.id],
    enabled: Boolean(currentTenant?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .eq("tenant_id", currentTenant!.id)
        .order("display_name");

      if (error) throw error;
      return (data ?? []) as TenantProfileOption[];
    },
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
