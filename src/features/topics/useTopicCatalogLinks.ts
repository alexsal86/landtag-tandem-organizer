import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
export function useTopicCatalogLinks() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["topic-catalog-links", currentTenant?.id],
    enabled: !!currentTenant?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const r = await supabase
        .from("topic_catalog_links")
        .select("id,topic_id,kind,committee_id,region_id")
        .eq("tenant_id", currentTenant!.id);
      if (r.error) throw r.error;
      return r.data;
    },
  });
}
