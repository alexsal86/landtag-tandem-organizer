import type { User } from "@supabase/supabase-js";
import type { Tenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { debugConsole } from "@/utils/debugConsole";
import { getErrorMessage } from "@/utils/errorHandler";
import type { QuickNote } from "./types";
import type { useQuickNotesData } from "./useQuickNotesData";
import type { useQuickNoteDialogs } from "./useQuickNoteDialogs";

export function useQuickNoteLinks(data: ReturnType<typeof useQuickNotesData>, dialogs: ReturnType<typeof useQuickNoteDialogs>, user: User | null, currentTenant: Tenant | null) {
  const { repository } = data;
  const { setConfirmRemoveDecision, setConfirmDeleteTaskNote, setMeetingSelectorOpen, setNoteForMeeting, setConfirmRemoveCaseItem } = dialogs;
  const removeDecisionFromNote = async (note: QuickNote) => {
    if (!note.decision_id || !user?.id) return;
    try {
      const { error } = await supabase.from("quick_notes").update({ decision_id: null }).eq("id", note.id).eq("user_id", user.id).select().single();
      if (error) throw error;
      notify.success("Verknüpfung zur Entscheidung entfernt");
      setConfirmRemoveDecision(null);
      await repository.refreshNote(note.id);
    } catch (error) {
      debugConsole.error("Error removing decision:", error);
      notify.error("Fehler beim Zurücknehmen der Entscheidung");
    }
  };
  const createTaskFromNote = async (note: QuickNote) => {
    if (!user || !currentTenant) { notify.error("Nicht angemeldet"); return; }
    try {
      await repository.sync();
      if (repository.getSnapshot().writes.some(write => write.noteId === note.id)) throw new Error("Bitte die Notiz vor dem Übernehmen synchronisieren");
      const { error } = await supabase.rpc("create_note_work", { p_note_id: note.id, p_kind: "task" });
      if (error) throw error;
      notify.success("Aufgabe erstellt");
      await repository.refreshNote(note.id);
    } catch (error) {
      debugConsole.error('Error creating task from note:', error);
      notify.error("Fehler beim Erstellen der Aufgabe");
    }
  };
  const removeTaskFromNote = async (note: QuickNote) => {
    if (!note.task_id || !user?.id) return;
    try {
      const { error: noteError } = await supabase
        .from("quick_notes").update({ task_id: null }).eq("id", note.id).eq("user_id", user.id);
      if (noteError) throw noteError;
      notify.success("Aufgabe entfernt");
      setConfirmDeleteTaskNote(null);
      await repository.refreshNote(note.id);
    } catch (error) {
      debugConsole.error('Error removing task from note:', error);
      notify.error("Fehler beim Entfernen der Aufgabe");
    }
  };
  const addNoteToMeeting = async (noteId: string, meetingId: string, _meetingTitle: string) => {
    if (!user?.id) { notify.error("Nicht angemeldet"); return; }
    try {
      const { data, error } = await supabase
        .from('quick_notes')
        .update({ meeting_id: meetingId, added_to_meeting_at: new Date().toISOString(), pending_for_jour_fixe: false })
        .eq('id', noteId).eq('user_id', user.id).select();
      if (error) throw error;
      if (!data || data.length === 0) { notify.error("Notiz konnte nicht zugewiesen werden"); return; }
      notify.success(`Notiz zum Jour Fixe hinzugefügt`);
      setMeetingSelectorOpen(false);
      setNoteForMeeting(null);
      await repository.refreshNote(noteId);
    } catch (error) {
      debugConsole.error('Error adding note to meeting:', error);
      notify.error("Fehler beim Hinzufügen zum Jour Fixe");
    }
  };
  const markForNextJourFixe = async (noteId: string) => {
    if (!user?.id) { notify.error("Nicht angemeldet"); return; }
    try {
      const { data, error } = await supabase
        .from('quick_notes').update({ pending_for_jour_fixe: true }).eq('id', noteId).eq('user_id', user.id).select();
      if (error) throw error;
      if (!data || data.length === 0) { notify.error("Notiz konnte nicht vorgemerkt werden"); return; }
      notify.success("Notiz für nächsten Jour Fixe vorgemerkt");
      await repository.refreshNote(noteId);
    } catch (error) {
      debugConsole.error('Error marking for Jour Fixe:', error);
      notify.error("Fehler beim Vormerken");
    }
  };
  const removeFromJourFixeQueue = async (noteId: string) => {
    try {
      const { error } = await supabase.from('quick_notes').update({ pending_for_jour_fixe: false }).eq('id', noteId);
      if (error) throw error;
      notify.success("Vormerkung entfernt");
      await repository.refreshNote(noteId);
    } catch (error) {
      debugConsole.error('Error removing from Jour Fixe queue:', error);
      notify.error("Fehler beim Entfernen der Vormerkung");
    }
  };
  const removeNoteFromMeeting = async (noteId: string) => {
    if (!user?.id) { notify.error("Nicht angemeldet"); return; }
    try {
      const { data, error } = await supabase
        .from('quick_notes').update({ meeting_id: null, added_to_meeting_at: null }).eq('id', noteId).eq('user_id', user.id).select();
      if (error) throw error;
      if (!data || data.length === 0) { notify.error("Notiz konnte nicht entfernt werden"); return; }
      notify.success("Notiz vom Jour Fixe entfernt");
      await repository.refreshNote(noteId);
    } catch (error) {
      debugConsole.error('Error removing note from meeting:', error);
      notify.error("Fehler beim Entfernen");
    }
  };
  const createCaseItemFromNote = async (note: QuickNote) => {
    if (!user || !currentTenant) { notify.error("Nicht angemeldet"); return; }
    try {
      await repository.sync();
      if (repository.getSnapshot().writes.some(write => write.noteId === note.id)) throw new Error("Bitte die Notiz vor dem Übernehmen synchronisieren");
      const { error } = await supabase.rpc("create_note_work", { p_note_id: note.id, p_kind: "case" });
      if (error) throw error;
      notify.success("Vorgang erstellt");
      await repository.refreshNote(note.id);
    } catch (error) {
      debugConsole.error('Error creating case item from note:', error);
      notify.error(getErrorMessage(error));
    }
  };
  const removeCaseItemFromNote = async (note: QuickNote) => {
    if (!note.case_item_id || !user?.id) return;
    try {
      const { error: linkError } = await supabase.from("quick_notes").update({ case_item_id: null }).eq("id", note.id).eq("user_id", user.id).select().single();
      if (linkError) throw linkError;
      notify.success("Verknüpfung zum Vorgang entfernt");
      setConfirmRemoveCaseItem(null);
      await repository.refreshNote(note.id);
    } catch (error) {
      debugConsole.error('Error removing case item from note:', error);
      notify.error("Fehler beim Entfernen des Vorgangs");
    }
  };
  const splitNoteIntoBullets = async (note: QuickNote) => {
    if (!user) return;
    const listItemRegex = /<li[^>]*>(.*?)<\/li>/gi;
    const dashBulletRegex = /^[-•*]\s+(.+)$/gm;
    let items: string[] = [];
    let match;
    while ((match = listItemRegex.exec(note.content)) !== null) {
      const text = match[1].replace(/<[^>]*>/g, '').trim();
      if (text) items.push(text);
    }
    if (items.length === 0) {
      const plainText = note.content.replace(/<[^>]*>/g, '');
      while ((match = dashBulletRegex.exec(plainText)) !== null) {
        if (match[1].trim()) items.push(match[1].trim());
      }
    }
    if (items.length === 0) {
      const plainText = note.content.replace(/<[^>]*>/g, '');
      const lines = plainText.split(/\n+/).map(l => l.trim()).filter(l => l.length > 5);
      if (lines.length > 1) items = lines;
    }
    if (items.length <= 1) {
      notify.info("Keine Aufzählungspunkte gefunden", { description: "Die Notiz enthält keine Aufzählung oder Liste zum Aufteilen." });
      return;
    }
    try {
      const newNotes = items.map((content) => ({
        user_id: user.id, tenant_id: currentTenant?.id, content,
        title: content.substring(0, 30) + (content.length > 30 ? '...' : ''),
        color: note.color, priority_level: note.priority_level || 0,
        is_pinned: false, is_archived: false,
      }));
      const { data: created, error } = await supabase.from('quick_notes').insert(newNotes).select("id");
      if (error) throw error;
      notify.success(`${items.length} Notizen erstellt`, { description: "Die Aufzählungspunkte wurden in separate Notizen aufgeteilt." });
      await Promise.all((created ?? []).map(note => repository.refreshNote(note.id)));
    } catch (error) {
      debugConsole.error('Error splitting note:', error);
      notify.error("Fehler beim Aufteilen der Notiz");
    }
  };
  return { removeDecisionFromNote, createTaskFromNote, removeTaskFromNote, addNoteToMeeting, markForNextJourFixe, removeFromJourFixeQueue, removeNoteFromMeeting, createCaseItemFromNote, removeCaseItemFromNote, splitNoteIntoBullets };
}
