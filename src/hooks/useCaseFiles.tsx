import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/components/ui/use-toast";

export interface CaseFile {
  id: string;
  user_id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  case_type: string;
  status: string;
  priority: string | null;
  reference_number: string | null;
  start_date: string | null;
  target_date: string | null;
  tags: string[] | null;
  is_private: boolean;
  visibility: string;
  current_status_note: string | null;
  current_status_updated_at: string | null;
  risks_and_opportunities: any;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  // Counts from relations
  contacts_count?: number;
  documents_count?: number;
  tasks_count?: number;
  appointments_count?: number;
  letters_count?: number;
}

export interface CaseFileFormData {
  title: string;
  description?: string;
  case_type: string;
  status: string;
  priority?: string;
  reference_number?: string;
  start_date?: string;
  target_date?: string;
  tags?: string[];
  is_private?: boolean;
}

// Legacy fallback - types are now loaded from database via useCaseFileTypes
export const CASE_TYPES = [
  { value: 'general', label: 'Allgemein' },
  { value: 'legislation', label: 'Gesetzgebung' },
  { value: 'citizen_concern', label: 'Bürgeranliegen' },
  { value: 'initiative', label: 'Initiative' },
  { value: 'investigation', label: 'Untersuchung' },
  { value: 'project', label: 'Projekt' },
  { value: 'petition', label: 'Petition' },
  { value: 'small_inquiry', label: 'Kleine Anfrage' },
  { value: 'committee_work', label: 'Ausschussarbeit' },
  { value: 'constituency', label: 'Wahlkreis' },
];

export const CASE_STATUSES = [
  { value: 'active', label: 'Aktiv', color: 'bg-green-500' },
  { value: 'pending', label: 'Wartend', color: 'bg-yellow-500' },
  { value: 'closed', label: 'Abgeschlossen', color: 'bg-blue-500' },
  { value: 'archived', label: 'Archiviert', color: 'bg-gray-500' },
];

export const useCaseFiles = () => {
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const fetchCaseFiles = useCallback(async () => {
    if (!user || !currentTenant) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('case_files')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Fetch counts for each case file
      const caseFilesWithCounts = await Promise.all(
        (data || []).map(async (cf) => {
          const [contacts, documents, tasks, appointments, letters] = await Promise.all([
            supabase.from('case_file_contacts').select('id', { count: 'exact', head: true }).eq('case_file_id', cf.id),
            supabase.from('case_file_documents').select('id', { count: 'exact', head: true }).eq('case_file_id', cf.id),
            supabase.from('case_file_tasks').select('id', { count: 'exact', head: true }).eq('case_file_id', cf.id),
            supabase.from('case_file_appointments').select('id', { count: 'exact', head: true }).eq('case_file_id', cf.id),
            supabase.from('case_file_letters').select('id', { count: 'exact', head: true }).eq('case_file_id', cf.id),
          ]);

          return {
            ...cf,
            contacts_count: contacts.count || 0,
            documents_count: documents.count || 0,
            tasks_count: tasks.count || 0,
            appointments_count: appointments.count || 0,
            letters_count: letters.count || 0,
          };
        })
      );

      setCaseFiles(caseFilesWithCounts);
    } catch (error) {
      console.error('Error fetching case files:', error);
      toast({
        title: "Fehler",
        description: "FallAkten konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, currentTenant, toast]);

  const createCaseFile = async (data: CaseFileFormData) => {
    if (!user || !currentTenant) return null;

    try {
      const { data: newCaseFile, error } = await supabase
        .from('case_files')
        .insert({
          ...data,
          user_id: user.id,
          tenant_id: currentTenant.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "FallAkte wurde erstellt.",
      });

      await fetchCaseFiles();
      return newCaseFile;
    } catch (error) {
      console.error('Error creating case file:', error);
      toast({
        title: "Fehler",
        description: "FallAkte konnte nicht erstellt werden.",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateCaseFile = async (id: string, data: Partial<CaseFileFormData>) => {
    try {
      const { error } = await supabase
        .from('case_files')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "FallAkte wurde aktualisiert.",
      });

      await fetchCaseFiles();
      return true;
    } catch (error) {
      console.error('Error updating case file:', error);
      toast({
        title: "Fehler",
        description: "FallAkte konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteCaseFile = async (id: string) => {
    try {
      const { error } = await supabase
        .from('case_files')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Erfolgreich",
        description: "FallAkte wurde gelöscht.",
      });

      await fetchCaseFiles();
      return true;
    } catch (error) {
      console.error('Error deleting case file:', error);
      toast({
        title: "Fehler",
        description: "FallAkte konnte nicht gelöscht werden.",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchCaseFiles();
  }, [fetchCaseFiles]);

  // Real-time subscription
  useEffect(() => {
    if (!user || !currentTenant) return;

    const channel = supabase
      .channel('case-files-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'case_files',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        () => {
          fetchCaseFiles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentTenant, fetchCaseFiles]);

  return {
    caseFiles,
    loading,
    fetchCaseFiles,
    createCaseFile,
    updateCaseFile,
    deleteCaseFile,
  };
};
