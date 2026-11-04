import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { debugConsole } from "@/utils/debugConsole";
import { getErrorMessage } from "@/utils/errorHandler";
import type { QuickNote } from "./types";
import type { useQuickNotesData } from "./useQuickNotesData";
import type { useQuickNoteDialogs } from "./useQuickNoteDialogs";
import type { useQuickNoteActions } from "./useQuickNoteActions";
export function useQuickNoteDeletion(data: ReturnType<typeof useQuickNotesData>, dialogs: ReturnType<typeof useQuickNoteDialogs>, actions: ReturnType<typeof useQuickNoteActions>, userId?: string) {
  const { repository } = data;
  const { confirmDeleteLinkedNote, setConfirmDeleteLinkedNote, deleteLinkedTask, setDeleteLinkedTask, deleteLinkedDecision, setDeleteLinkedDecision, deleteLinkedMeeting, setDeleteLinkedMeeting, deleteLinkedCaseItem, setDeleteLinkedCaseItem } = dialogs;
  const handleDeleteWithConfirmation = (note: QuickNote) => {
    const hasLinks = note.task_id || note.decision_id || note.meeting_id || note.case_item_id;
    if (hasLinks) {
      setDeleteLinkedTask(false);
      setDeleteLinkedDecision(false);
      setDeleteLinkedMeeting(false);
      setDeleteLinkedCaseItem(false);
      setConfirmDeleteLinkedNote(note);
    } else {
      actions.handleDelete(note.id);
    }
  };

  const linkedDeleteBusy = useRef(false);
  const [deletingLinkedNote, setDeletingLinkedNote] = useState(false);
  const handleDeleteNoteWithLinks = async () => {
    if (!confirmDeleteLinkedNote || !userId || linkedDeleteBusy.current) return;
    if (repository.getSnapshot().writes.some(write => write.noteId === confirmDeleteLinkedNote.id)) {
      notify.error("Bitte diese Notiz vor dem Löschen synchronisieren oder den lokalen Text als neue Notiz sichern");
      return;
    }
    linkedDeleteBusy.current = true;
    setDeletingLinkedNote(true);
    try {
      const { error } = await supabase.rpc("delete_quick_note_with_links", {
        p_note_id: confirmDeleteLinkedNote.id,
        p_delete_task: deleteLinkedTask,
        p_delete_decision: deleteLinkedDecision,
        p_archive_case_item: deleteLinkedCaseItem,
        p_remove_meeting: deleteLinkedMeeting,
      });
      if (error) throw error;
      setConfirmDeleteLinkedNote(null);
      notify.success("Notiz in den Papierkorb verschoben");
      await repository.removeCachedNote(confirmDeleteLinkedNote.id);
    } catch (error) {
      debugConsole.error("Error deleting note with links:", error);
      notify.error(`Löschen konnte nicht bestätigt werden: ${getErrorMessage(error)}. Bitte aktualisieren Sie die Notizen vor einem erneuten Versuch.`);
    } finally {
      linkedDeleteBusy.current = false;
      setDeletingLinkedNote(false);
    }
  };
  return { handleDeleteWithConfirmation, handleDeleteNoteWithLinks, deletingLinkedNote };
}
