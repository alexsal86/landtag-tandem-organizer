import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { debugConsole } from "@/utils/debugConsole";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { notify } from "@/lib/notify";

export interface CaseFileType {
  id: string;
  name: string;
  label: string;
  icon: string | null;
  color: string | null;
  order_index: number;
  is_active: boolean;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

export const useCaseFileTypes = () => {
  const [caseFileTypes, setCaseFileTypes] = useState<CaseFileType[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentTenant } = useTenant();

  const fetchCaseFileTypes = useCallback(async () => {
    if (!currentTenant) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('case_file_types')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('order_index');

      if (error) throw error;
      setCaseFileTypes(data || []);
    } catch (error) {
      debugConsole.error('Error fetching case file types:', error);
      notify.error("Fehler", {
        description: "Fallakten-Typen konnten nicht geladen werden."
});
    } finally {
      setLoading(false);
    }
  }, [toast, currentTenant]);

  const createCaseFileType = async (data: { label: string; icon?: string; color?: string }) => {
    try {
      if (!currentTenant?.id) return false;

      const insertPayload: TablesInsert<"case_file_types"> = {
        name: data.label.toLowerCase().replace(/\s+/g, '_'),
        label: data.label,
        icon: data.icon || 'Folder',
        color: data.color || '#3b82f6',
        order_index: Math.max(...caseFileTypes.map((t) => t.order_index), -1) + 1,
        tenant_id: currentTenant.id,
      };

      const { error } = await supabase
        .from('case_file_types')
        .insert([insertPayload]);

      if (error) throw error;

      notify.success("Erfolgreich", {
        description: "Fallakten-Typ wurde erstellt."
});

      await fetchCaseFileTypes();
      return true;
    } catch (error) {
      debugConsole.error('Error creating case file type:', error);
      notify.error("Fehler", {
        description: "Fallakten-Typ konnte nicht erstellt werden."
});
      return false;
    }
  };

  const updateCaseFileType = async (id: string, data: { label?: string; icon?: string; color?: string }) => {
    try {
      const updateData: TablesUpdate<"case_file_types"> = {};
      if (data.label) {
        updateData.name = data.label.toLowerCase().replace(/\s+/g, '_');
        updateData.label = data.label;
      }
      if (data.icon !== undefined) updateData.icon = data.icon;
      if (data.color !== undefined) updateData.color = data.color;

      const { error } = await supabase
        .from('case_file_types')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      notify.success("Erfolgreich", {
        description: "Fallakten-Typ wurde aktualisiert."
});

      await fetchCaseFileTypes();
      return true;
    } catch (error) {
      debugConsole.error('Error updating case file type:', error);
      notify.error("Fehler", {
        description: "Fallakten-Typ konnte nicht aktualisiert werden."
});
      return false;
    }
  };

  const deleteCaseFileType = async (id: string) => {
    try {
      const { error } = await supabase
        .from('case_file_types')
        .delete()
        .eq('id', id);

      if (error) throw error;

      notify.success("Erfolgreich", {
        description: "Fallakten-Typ wurde gelöscht."
});

      await fetchCaseFileTypes();
      return true;
    } catch (error) {
      debugConsole.error('Error deleting case file type:', error);
      notify.error("Fehler", {
        description: "Fallakten-Typ konnte nicht gelöscht werden."
});
      return false;
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('case_file_types')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      notify.success("Erfolgreich", {
        description: `Fallakten-Typ wurde ${!isActive ? 'aktiviert' : 'deaktiviert'}.`
});

      await fetchCaseFileTypes();
      return true;
    } catch (error) {
      debugConsole.error('Error toggling case file type:', error);
      notify.error("Fehler", {
        description: "Status konnte nicht geändert werden."
});
      return false;
    }
  };

  const updateOrder = async (items: CaseFileType[]) => {
    try {
      const reorderPayload = items.map((item) => ({ id: item.id, order_index: item.order_index }));
      const { error } = await supabase
        .from('case_file_types')
        .upsert(reorderPayload as TablesUpdate<"case_file_types">[], { onConflict: 'id' });

      if (error) throw error;

      setCaseFileTypes(items);
      return true;
    } catch (error) {
      debugConsole.error('Error updating order:', error);
      notify.error("Fehler", {
        description: "Reihenfolge konnte nicht gespeichert werden."
});
      await fetchCaseFileTypes();
      return false;
    }
  };

  useEffect(() => {
    fetchCaseFileTypes();
  }, [fetchCaseFileTypes]);

  // Helper to get type config by name (for compatibility with existing code)
  const getTypeConfig = (typeName: string) => caseFileTypes.find((type) => type.name === typeName) ?? null;

  return {
    caseFileTypes,
    loading,
    fetchCaseFileTypes,
    createCaseFileType,
    updateCaseFileType,
    deleteCaseFileType,
    toggleActive,
    updateOrder,
    getTypeConfig,
  };
};
