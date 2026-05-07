import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
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
  const [templates, setTemplates] = useState<PreparationTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("preparation_templates")
        .select("id,name,description,anlasstyp,is_global,preparation_data,checklist_items,created_by,tenant_id")
        .eq("tenant_id", currentTenant.id)
        .order("name");
      if (error) throw error;
      setTemplates((data as unknown as PreparationTemplate[]) ?? []);
    } catch (e) {
      debugConsole.error("preparation_templates fetch", e);
    } finally {
      setLoading(false);
    }
  }, [currentTenant]);

  useEffect(() => { void fetchTemplates(); }, [fetchTemplates]);

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
      await fetchTemplates();
    },
    [currentTenant, user, fetchTemplates],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("preparation_templates").delete().eq("id", id);
      if (error) throw error;
      await fetchTemplates();
    },
    [fetchTemplates],
  );

  return { templates, loading, saveAsTemplate, deleteTemplate, refetch: fetchTemplates };
}
