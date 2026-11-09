import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

export function useActionPermission(action: string): { allowed: boolean; isLoading: boolean } {
  const { user } = useAuth(); const { currentTenant } = useTenant();
  const query = useQuery({
    queryKey: ["action-permission", user?.id, currentTenant?.id, action],
    enabled: Boolean(user && currentTenant), staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_tenant_action_allowed", { _user_id: user!.id, _tenant_id: currentTenant!.id, _action: action });
      if (error) throw error; return data === true;
    },
  });
  return { allowed: query.data === true && !query.isError, isLoading: query.isLoading };
}
