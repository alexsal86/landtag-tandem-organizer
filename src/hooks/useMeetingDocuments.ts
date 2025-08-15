import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AgendaDocument } from "@/types/meeting";

export function useMeetingDocuments() {
  const { toast } = useToast();
  const [agendaDocuments, setAgendaDocuments] = useState<Record<string, AgendaDocument[]>>({});

  const loadAgendaDocuments = async (agendaItemIds: string[]) => {
    if (agendaItemIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('meeting_agenda_documents')
        .select('*')
        .in('meeting_agenda_item_id', agendaItemIds)
        .order('created_at');

      if (error) throw error;

      // Group documents by agenda item id
      const docsByItemId: Record<string, AgendaDocument[]> = {};
      data?.forEach(doc => {
        if (!docsByItemId[doc.meeting_agenda_item_id]) {
          docsByItemId[doc.meeting_agenda_item_id] = [];
        }
        docsByItemId[doc.meeting_agenda_item_id].push(doc);
      });

      setAgendaDocuments(docsByItemId);
    } catch (error) {
      console.error('Error loading agenda documents:', error);
    }
  };

  const uploadAgendaDocument = async (agendaItemId: string, file: File, userId: string) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${agendaItemId}-${Date.now()}.${fileExt}`;
      const filePath = `meeting-documents/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { data, error: insertError } = await supabase
        .from('meeting_agenda_documents')
        .insert({
          meeting_agenda_item_id: agendaItemId,
          user_id: userId,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update local state
      setAgendaDocuments(prev => ({
        ...prev,
        [agendaItemId]: [...(prev[agendaItemId] || []), data]
      }));

      toast({
        title: "Datei hochgeladen",
        description: `${file.name} wurde erfolgreich hochgeladen.`,
      });

      return data;
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: "Upload-Fehler",
        description: "Die Datei konnte nicht hochgeladen werden.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const downloadAgendaDocument = async (document: AgendaDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: "Download-Fehler",
        description: "Die Datei konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    }
  };

  const deleteAgendaDocument = async (documentId: string, agendaItemId: string, filePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath]);

      if (storageError) {
        console.warn('Storage deletion failed:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('meeting_agenda_documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      // Update local state
      setAgendaDocuments(prev => ({
        ...prev,
        [agendaItemId]: prev[agendaItemId]?.filter(doc => doc.id !== documentId) || []
      }));

      toast({
        title: "Datei gelöscht",
        description: "Die Datei wurde erfolgreich gelöscht.",
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Lösch-Fehler",
        description: "Die Datei konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  return {
    agendaDocuments,
    loadAgendaDocuments,
    uploadAgendaDocument,
    downloadAgendaDocument,
    deleteAgendaDocument,
    setAgendaDocuments
  };
}