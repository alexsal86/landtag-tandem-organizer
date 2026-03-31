import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/components/ui/use-toast";
import { debugConsole } from "@/utils/debugConsole";
import { handleAppError } from "@/utils/errorHandler";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export interface CaseFile {
  id: string;
  user_id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  case_type: string;
  case_scale: string | null;
  status: string;
  priority: string | null;
  reference_number: string | null;
  start_date: string | null;
  target_date: string | null;
  tags: string[] | null;
  is_private: boolean | null;
  visibility: string;
  current_status_note: string | null;
  current_status_updated_at: string | null;
  risks_and_opportunities: Json | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  processing_status?: string | null;
  processing_statuses?: Json | null;
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
  case_scale?: string;
  status: string;
  priority?: string;
  reference_number?: string;
  start_date?: string;
  target_date?: string;
  tags?: string[];
  is_private?: boolean;
  visibility?: 'private' | 'shared' | 'public';
}

type CaseFileInsert = TablesInsert<"case_files">;
type CaseFileUpdate = TablesUpdate<"case_files">;
type CaseFileRealtimePayload = Tables<"case_files">;

type CaseFileCountRow = Pick<CaseFile,
  | 'id'
  | 'user_id'
  | 'tenant_id'
  | 'title'
  | 'description'
  | 'case_type'
  | 'case_scale'
  | 'status'
  | 'priority'
  | 'reference_number'
  | 'start_date'
  | 'target_date'
  | 'tags'
  | 'is_private'
  | 'visibility'
  | 'current_status_note'
  | 'current_status_updated_at'
  | 'risks_and_opportunities'
  | 'assigned_to'
  | 'created_at'
  | 'updated_at'
  | 'processing_status'
  | 'processing_statuses'
  | 'contacts_count'
  | 'documents_count'
  | 'tasks_count'
  | 'appointments_count'
  | 'letters_count'
>;

interface CaseFileParticipantInput {
  user_id: string;
  role: 'viewer' | 'editor';
}

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

const CASE_FILE_COUNTS_RPC = 'get_case_files_with_counts';

const normalizeCaseFileRow = (row: CaseFileCountRow): CaseFile => ({
  ...row,
  processing_status: row.processing_status ?? null,
  processing_statuses: row.processing_statuses ?? null,
  contacts_count: row.contacts_count ?? 0,
  documents_count: row.documents_count ?? 0,
  tasks_count: row.tasks_count ?? 0,
  appointments_count: row.appointments_count ?? 0,
  letters_count: row.letters_count ?? 0,
});

const patchCaseFile = (existing: CaseFile, payload: Partial<CaseFileRealtimePayload>): CaseFile => ({
  ...existing,
  ...(Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as Partial<CaseFile>),
});

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
      debugConsole.log('[useCaseFiles] fetching via RPC, tenant:', currentTenant.id);
      const { data, error } = await supabase.rpc(CASE_FILE_COUNTS_RPC, { p_tenant_id: currentTenant.id });

      if (error) throw error;

      debugConsole.log('[useCaseFiles] received', (data ?? []).length, 'case files');
      setCaseFiles(((data ?? []) as CaseFileCountRow[]).map(normalizeCaseFileRow));
    } catch (error) {
      handleAppError(error, {
        context: 'useCaseFiles.fetch',
        toast: { fn: toast, title: 'Fehler', description: 'Fallakten konnten nicht geladen werden.' },
      });
    } finally {
      setLoading(false);
    }
  }, [user, currentTenant, toast]);

  const createCaseFile = async (data: CaseFileFormData, participants: CaseFileParticipantInput[] = []) => {
    if (!user || !currentTenant) return null;

    try {
      const insertPayload: CaseFileInsert = {
        ...data,
        user_id: user.id,
        tenant_id: currentTenant.id,
      };

      const { data: newCaseFile, error } = await supabase
        .from('case_files')
        .insert([insertPayload])
        .select()
        .single();

      if (error) throw error;

      if (participants.length > 0) {
        const { error: participantsError } = await supabase
          .from('case_file_participants')
          .insert(
            participants.map((participant) => ({
              case_file_id: newCaseFile.id,
              user_id: participant.user_id,
              role: participant.role,
            }))
          );

        if (participantsError) {
          await supabase.from('case_files').delete().eq('id', newCaseFile.id);
          throw new Error('ROLLBACK_CASE_FILE_PARTICIPANTS');
        }
      }

      toast({
        title: "Erfolgreich",
        description: "Fallakte wurde erstellt.",
      });

      await fetchCaseFiles();
      return newCaseFile;
    } catch (error) {
      debugConsole.error('Error creating case file:', error);
      const participantsRollbackError =
        error instanceof Error && error.message === 'ROLLBACK_CASE_FILE_PARTICIPANTS';

      toast({
        title: "Fehler",
        description: participantsRollbackError
          ? "Fallakte-Erstellung wurde zurückgerollt, da Teilnehmer nicht gespeichert werden konnten."
          : "Fallakte konnte nicht erstellt werden.",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateCaseFile = async (id: string, data: Partial<CaseFileFormData>) => {
    try {
      const { error } = await supabase
        .from('case_files')
        .update(data as CaseFileUpdate)
        .eq('id', id);

      if (error) throw error;

      setCaseFiles((prev) =>
        prev.map((caseFile) =>
          caseFile.id === id
            ? {
                ...caseFile,
                ...data,
                updated_at: new Date().toISOString(),
              }
            : caseFile,
        ),
      );

      toast({
        title: "Erfolgreich",
        description: "Fallakte wurde aktualisiert.",
      });

      return true;
    } catch (error) {
      debugConsole.error('Error updating case file:', error);
      const errorMessage = error instanceof Error ? error.message : "";
      toast({
        title: "Fehler",
        description: errorMessage.includes("Abschlussinteraktion")
          ? "Zum Abschließen ist mindestens eine dokumentierte Abschlussinteraktion erforderlich."
          : "Fallakte konnte nicht aktualisiert werden.",
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

      setCaseFiles((prev) => prev.filter((caseFile) => caseFile.id !== id));

      toast({
        title: "Erfolgreich",
        description: "Fallakte wurde gelöscht.",
      });

      return true;
    } catch (error) {
      debugConsole.error('Error deleting case file:', error);
      toast({
        title: "Fehler",
        description: "Fallakte konnte nicht gelöscht werden.",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchCaseFiles();
  }, [fetchCaseFiles]);

  useEffect(() => {
    if (!user || !currentTenant) return;

    const handleRealtimeRefresh = () => {
      void fetchCaseFiles();
    };

    const channelName = `case-files-changes-${currentTenant.id}-${user.id}-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'case_files',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id as string | undefined;
            if (deletedId) {
              setCaseFiles((prev) => prev.filter((caseFile) => caseFile.id !== deletedId));
            }
            return;
          }

          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Partial<CaseFileRealtimePayload>;
            const updatedId = updated.id;
            if (updatedId) {
              setCaseFiles((prev) => {
                const existingIndex = prev.findIndex((caseFile) => caseFile.id === updatedId);
                if (existingIndex === -1) {
                  return prev;
                }
                const next = [...prev];
                next[existingIndex] = patchCaseFile(next[existingIndex], updated);
                return next.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
              });
            }
            handleRealtimeRefresh();
            return;
          }

          handleRealtimeRefresh();
        },
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
