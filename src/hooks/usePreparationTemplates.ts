import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { STALE_TIME } from "@/lib/query-cache";
import { debugConsole } from "@/utils/debugConsole";
import type { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";

export interface PreparationTemplate {
  id: string;
  name: string;
  description: string | null;
  anlasstyp: string | null;
  is_global: boolean;
  preparation_data: AppointmentPreparation["preparation_data"];
  checklist_items: AppointmentPreparation["checklist_items"];
  created_by: string | null;
  tenant_id: string;
}

export function usePreparationTemplates() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;
  const queryKey = ["preparation-templates", tenantId] as const;

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: !!tenantId,
    staleTime: STALE_TIME.LIST,
    gcTime: STALE_TIME.LIST * 2,
    queryFn: async (): Promise<PreparationTemplate[]> => {
      const { data, error } = await supabase
        .from("preparation_templates")
        .select("id,name,description,anlasstyp,is_global,preparation_data,checklist_items,created_by,tenant_id")
        .eq("tenant_id", tenantId as string)
        .order("name");
      if (error) {
        debugConsole.error("preparation_templates fetch", error);
        throw error;
      }
      return (data as unknown as PreparationTemplate[]) ?? [];
    },
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const saveAsTemplate = useCallback(
    async (input: { name: string; description?: string; anlasstyp?: string; preparation: AppointmentPreparation }) => {
      if (!currentTenant || !user) throw new Error("Kein Tenant/Nutzer");
      const { error } = await supabase.from("preparation_templates").insert({
        name: input.name,
        description: input.description ?? null,
        anlasstyp: input.anlasstyp ?? null,
        preparation_data: input.preparation.preparation_data as never,
        checklist_items: input.preparation.checklist_items as never,
        tenant_id: currentTenant.id,
        created_by: user.id,
        is_global: false,
      });
      if (error) throw error;
      invalidate();
    },
    [currentTenant, user, invalidate],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("preparation_templates").delete().eq("id", id);
      if (error) throw error;
      invalidate();
    },
    [invalidate],
  );

  return {
    templates: data ?? [],
    loading: isLoading,
    saveAsTemplate,
    deleteTemplate,
    refetch,
  };
}
