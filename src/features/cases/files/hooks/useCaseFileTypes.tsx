import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export interface CaseFileType {
  id: string;
  name: string;
  label: string;
  icon: string | null;
  color: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useCaseFileTypes = () => {
  const [caseFileTypes, setCaseFileTypes] = useState<CaseFileType[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCaseFileTypes = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('case_file_types')
        .select('*')
        .order('order_index');

      if (error) throw error;
      setCaseFileTypes(data || []);
    } catch (error) {
      console.error('Error fetching case file types:', error);
      toast({
        title: "Fehler",
        description: "FallAkten-Typen konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createCaseFileType = async (data: { label: string; icon?: string; color?: string }) => {
    try {
      const { error } = await supabase
        .from('case_file_types')
        .insert({
          name: data.label.toLowerCase().replace(/\s+/g, '_'),
          label: data.label,
          icon: data.icon || 'Folder',
          color: data.color || '#3b82f6',
          order_index: Math.max(...caseFileTypes.map(t => t.order_index), -1) + 1,
        });

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "FallAkten-Typ wurde erstellt.",
      });

      await fetchCaseFileTypes();
      return true;
    } catch (error) {
      console.error('Error creating case file type:', error);
      toast({
        title: "Fehler",
        description: "FallAkten-Typ konnte nicht erstellt werden.",
        variant: "destructive",
      });
      return false;
    }
  };

  const updateCaseFileType = async (id: string, data: { label?: string; icon?: string; color?: string }) => {
    try {
      const updateData: Record<string, unknown> = {};
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

      toast({
        title: "Erfolgreich",
        description: "FallAkten-Typ wurde aktualisiert.",
      });

      await fetchCaseFileTypes();
      return true;
    } catch (error) {
      console.error('Error updating case file type:', error);
      toast({
        title: "Fehler",
        description: "FallAkten-Typ konnte nicht aktualisiert werden.",
        variant: "destructive",
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

      toast({
        title: "Erfolgreich",
        description: "FallAkten-Typ wurde gelöscht.",
      });

      await fetchCaseFileTypes();
      return true;
    } catch (error) {
      console.error('Error deleting case file type:', error);
      toast({
        title: "Fehler",
        description: "FallAkten-Typ konnte nicht gelöscht werden.",
        variant: "destructive",
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

      toast({
        title: "Erfolgreich",
        description: `FallAkten-Typ wurde ${!isActive ? 'aktiviert' : 'deaktiviert'}.`,
      });

      await fetchCaseFileTypes();
      return true;
    } catch (error) {
      console.error('Error toggling case file type:', error);
      toast({
        title: "Fehler",
        description: "Status konnte nicht geändert werden.",
        variant: "destructive",
      });
      return false;
    }
  };

  const updateOrder = async (items: CaseFileType[]) => {
    try {
      for (const item of items) {
        await supabase
          .from('case_file_types')
          .update({ order_index: item.order_index })
          .eq('id', item.id);
      }
      setCaseFileTypes(items);
      return true;
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: "Fehler",
        description: "Reihenfolge konnte nicht gespeichert werden.",
        variant: "destructive",
      });
      await fetchCaseFileTypes();
      return false;
    }
  };

  useEffect(() => {
    fetchCaseFileTypes();
  }, [fetchCaseFileTypes]);

  // Helper to get type config by name (for compatibility with existing code)
  const getTypeConfig = (typeName: string) => {
    return caseFileTypes.find(t => t.name === typeName);
  };

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
