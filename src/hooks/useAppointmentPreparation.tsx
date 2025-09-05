import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AppointmentPreparation {
  id: string;
  title: string;
  status: string;
  notes?: string;
  appointment_id?: string;
  template_id?: string;
  tenant_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  archived_at?: string;
  preparation_data: {
    objectives?: string;
    key_topics?: string;
    talking_points?: string;
    audience?: string;
    contact_person?: string;
    materials_needed?: string;
    facts_figures?: string;
    position_statements?: string;
    questions_answers?: string;
    technology_setup?: string;
    dress_code?: string;
    event_type?: string;
    // Contact information fields
    contact_name?: string;
    contact_info?: string;
    contact_id?: string;
    notes?: string;
  };
  checklist_items: Array<{
    id: string;
    label: string;
    completed: boolean;
  }>;
}

export function useAppointmentPreparation(preparationId: string | undefined) {
  const [preparation, setPreparation] = useState<AppointmentPreparation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchPreparation = async () => {
    if (!preparationId || !user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('appointment_preparations')
        .select('*')
        .eq('id', preparationId)
        .single();

      if (fetchError) throw fetchError;

      if (data) {
        setPreparation({
          id: data.id,
          title: data.title,
          status: data.status,
          notes: data.notes,
          appointment_id: data.appointment_id,
          template_id: data.template_id,
          tenant_id: data.tenant_id,
          created_by: data.created_by,
          created_at: data.created_at,
          updated_at: data.updated_at,
          is_archived: data.is_archived,
          archived_at: data.archived_at,
          preparation_data: data.preparation_data as any || {},
          checklist_items: data.checklist_items as any || []
        });
      }
    } catch (err) {
      console.error('Error fetching preparation:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const updatePreparation = async (updates: Partial<AppointmentPreparation>) => {
    if (!preparationId || !user) return;

    try {
      const { error: updateError } = await supabase
        .from('appointment_preparations')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', preparationId);

      if (updateError) throw updateError;

      // Refresh data after update
      await fetchPreparation();
    } catch (err) {
      console.error('Error updating preparation:', err);
      throw err;
    }
  };

  const archivePreparation = async () => {
    if (!preparationId || !user) return;

    try {
      const { error: archiveError } = await supabase
        .from('appointment_preparations')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', preparationId);

      if (archiveError) throw archiveError;
    } catch (err) {
      console.error('Error archiving preparation:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchPreparation();
  }, [preparationId, user]);

  return {
    preparation,
    loading,
    error,
    updatePreparation,
    archivePreparation,
    refetch: fetchPreparation
  };
}