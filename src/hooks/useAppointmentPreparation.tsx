import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { debugConsole } from '@/utils/debugConsole';

export interface AppointmentPreparation {
  id: string;
  title: string;
  status: string;
  notes?: string | null;
  appointment_id?: string | null;
  template_id?: string | null;
  tenant_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  archived_at?: string | null;
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
    // Anlass des Besuchs
    visit_reason?: 'einladung' | 'eigeninitiative' | 'fraktionsarbeit' | 'pressetermin';
    // Begleitpersonen
    companions?: Array<{
      id: string;
      name: string;
      type: 'mitarbeiter' | 'fraktion' | 'partei' | 'presse' | 'sonstige';
      note?: string;
    }>;
    // Logistik
    travel_time?: string;
    has_parking?: boolean;
    follow_up?: string;
    // Programm / Ablaufplan
    program?: Array<{
      id: string;
      time: string;
      item: string;
      notes: string;
    }>;
  };
  checklist_items: Array<{
    id: string;
    label: string;
    completed: boolean;
  }>;
}

type AppointmentPreparationData = AppointmentPreparation['preparation_data'];
type AppointmentChecklistItem = AppointmentPreparation['checklist_items'][number];

interface AppointmentPreparationRow {
  id: string;
  title: string;
  status: string;
  notes: string | null;
  appointment_id: string | null;
  template_id: string | null;
  tenant_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  archived_at: string | null;
  preparation_data: AppointmentPreparationData | null;
  checklist_items: AppointmentChecklistItem[] | null;
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
        const row = data as AppointmentPreparationRow;
        setPreparation({
          id: row.id,
          title: row.title,
          status: row.status,
          notes: row.notes,
          appointment_id: row.appointment_id,
          template_id: row.template_id,
          tenant_id: row.tenant_id,
          created_by: row.created_by,
          created_at: row.created_at,
          updated_at: row.updated_at,
          is_archived: row.is_archived,
          archived_at: row.archived_at,
          preparation_data: row.preparation_data ?? {},
          checklist_items: row.checklist_items ?? []
        });
      }
    } catch (err) {
      debugConsole.error('Error fetching preparation:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const updatePreparation = async (updates: Partial<AppointmentPreparation>) => {
    if (!preparationId || !user) return;

    try {
      const updatePayload: Partial<AppointmentPreparationRow> = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Optimistic local update — no refetch
      setPreparation(prev => prev ? { ...prev, ...updates, updated_at: new Date().toISOString() } : prev);

      const { error: updateError } = await supabase
        .from('appointment_preparations')
        .update(updatePayload)
        .eq('id', preparationId);

      if (updateError) throw updateError;
    } catch (err) {
      debugConsole.error('Error updating preparation:', err);
      // Rollback on error
      await fetchPreparation();
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
      debugConsole.error('Error archiving preparation:', err);
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
