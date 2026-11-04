import type { User } from "@supabase/supabase-js";
import type { Tenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { debugConsole } from "@/utils/debugConsole";
import { getErrorMessage } from "@/utils/errorHandler";
import { stripHtml } from "@/hooks/quickNotes/utils";
import type { QuickNote } from "./types";
import type { useQuickNotesData } from "./useQuickNotesData";
import type { useQuickNoteDialogs } from "./useQuickNoteDialogs";

export function useQuickNoteLinks(data: ReturnType<typeof useQuickNotesData>, dialogs: ReturnType<typeof useQuickNoteDialogs>, user: User | null, currentTenant: Tenant | null) {
  const { repository } = data;
  const { setConfirmRemoveDecision, setConfirmDeleteTaskNote, setMeetingSelectorOpen, setNoteForMeeting, setConfirmRemoveCaseItem } = dialogs;
  const removeDecisionFromNote = async (note: QuickNote) => {
    if (!note.decision_id || !user?.id) return;
    try {
      const { data: decisionData } = await supabase
        .from('task_decisions').select('title').eq('id', note.decision_id).single();
      const { error: decisionError } = await supabase.from('task_decisions').update({ archived_at: new Date().toISOString() }).eq('id', note.decision_id).select().single();
      if (decisionError) throw decisionError;
      const archivedInfo = decisionData ? { id: note.decision_id, title: decisionData.title, archived_at: new Date().toISOString() } : null;
      const { error: linkError } = await supabase.from("quick_notes").update({ decision_id: null, decision_archived_info: archivedInfo }).eq("id", note.id).eq("user_id", user.id).select().single();
      if (linkError) throw linkError;
      notify.success("Entscheidungsanfrage zurückgenommen");
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
      const plainContent = stripHtml(note.content);
      const taskTitle = note.title
        ? stripHtml(note.title)
        : plainContent.substring(0, 50) + (plainContent.length > 50 ? '...' : '');
      const mapPriority = (level: number | undefined | null): 'low' | 'medium' | 'high' => {
        if (!level || level <= 1) return 'low';
        if (level === 2) return 'medium';
        return 'high';
      };
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert([{
          user_id: user.id, tenant_id: currentTenant.id, title: taskTitle,
          description: note.content, category: 'personal', priority: mapPriority(note.priority_level),
          status: 'todo', due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          assigned_to: user.id,
        }])
        .select().single();
      if (taskError) throw taskError;
      const { error: linkError } = await supabase.from("quick_notes").update({ task_id: task.id }).eq("id", note.id).eq("tenant_id", currentTenant.id).select().single();
      if (linkError) throw linkError;
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
      const { error: taskError } = await supabase.from('tasks').delete().eq('id', note.task_id);
      if (taskError) throw taskError;
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
      const plainContent = stripHtml(note.content);
      const itemSubject = note.title
        ? stripHtml(note.title)
        : plainContent.substring(0, 100);

      const mapPriority = (level: number | undefined | null): 'low' | 'medium' | 'high' => {
        if (!level || level <= 1) return 'low';
        if (level === 2) return 'medium';
        return 'high';
      };

      // Generate ID client-side so we can link the note even if RLS blocks returning rows
      const caseItemId = crypto.randomUUID();

      const { error: caseError } = await supabase
        .from('case_items')
        .insert([
          {
            id: caseItemId,
            tenant_id: currentTenant.id,
            user_id: user.id,
            owner_user_id: user.id,
            subject: itemSubject,
            summary: note.content,
            status: 'neu',
            priority: mapPriority(note.priority_level),
            source_channel: 'other',
            intake_payload: {
              category: 'Allgemein',
            },
          },
        ]);

      if (caseError) throw caseError;

      const { error: linkError } = await supabase
        .from("quick_notes")
        .update({ case_item_id: caseItemId })
        .eq("id", note.id)
        .eq("user_id", user.id);

      if (linkError) throw linkError;

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
      const { error: caseError } = await supabase.from('case_items').update({ status: 'archiviert' }).eq('id', note.case_item_id).select().single();
      if (caseError) throw caseError;
      const { error: linkError } = await supabase.from("quick_notes").update({ case_item_id: null }).eq("id", note.id).eq("user_id", user.id).select().single();
      if (linkError) throw linkError;
      notify.success("Vorgang archiviert und von Notiz entfernt");
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
