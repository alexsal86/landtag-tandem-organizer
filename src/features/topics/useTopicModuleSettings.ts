import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  DEFAULT_TOPIC_MODULE_RULE,
  normalizeTopicModuleRule,
  type TopicModule,
  type TopicModuleRule,
  type TopicModuleRuleRow,
} from "./moduleRules";

export function useTopicModuleSettings(module: TopicModule | null): TopicModuleRule & {
  loading: boolean;
} {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const settings = useQuery({
    queryKey: ["topic-module-settings", tenantId, module],
    enabled: Boolean(tenantId && module),
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("topic_module_settings")
        .select(
          "is_enabled, requirement, max_topics, creation_policy, show_filter",
        )
        .eq("tenant_id", tenantId!)
        .eq("module", module!)
        .abortSignal(signal)
        .maybeSingle();
      if (error) throw error;
      return (data as TopicModuleRuleRow | null) ?? null;
    },
  });

  if (!module) {
    return { ...DEFAULT_TOPIC_MODULE_RULE, loading: false };
  }

  return {
    ...normalizeTopicModuleRule(settings.data),
    loading: settings.isLoading,
  };
}
