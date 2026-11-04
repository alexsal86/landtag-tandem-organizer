import { useState } from "react";
import { format, addDays } from "date-fns";
import { de } from "date-fns/locale";
import type { DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { getErrorMessage } from "@/utils/errorHandler";
import type { QuickNote } from "./types";
import type { useQuickNotesData } from "./useQuickNotesData";
import type { useQuickNoteDialogs } from "./useQuickNoteDialogs";
import type { NotePatch } from "./repository";

export function useQuickNoteActions(data: ReturnType<typeof useQuickNotesData>, dialogs: ReturnType<typeof useQuickNoteDialogs>, userId?: string) {
  const [colorModeUpdating, setColorModeUpdating] = useState<string | null>(null);
  const apply = async (id: string, patch: NotePatch, message: string) => {
    try { await data.patchNote({ id, patch }); notify.success(message); return true; }
    catch (error) { notify.error(getErrorMessage(error)); return false; }
  };
  const handleArchive = async (id: string) => {
    const archived = await apply(id, { is_archived: true, archived_at: new Date().toISOString() }, "Notiz archiviert");
    if (archived) notify.success("Notiz im Archiv", { action: { label: "Rückgängig", onClick: () => {
      void (async () => {
        const { error } = await supabase.from("quick_notes").update({ is_archived: false, archived_at: null }).eq("id", id).eq("tenant_id", data.repository.scope.tenantId).eq("user_id", data.repository.scope.userId).select().single();
        if (error) { notify.error(getErrorMessage(error)); return; }
        await data.repository.refreshNote(id);
      })().catch(error => notify.error(getErrorMessage(error)));
    } } });
  };
  const handleSetFollowUp = async (id: string, date: Date | null) => {
    if (await apply(id, { follow_up_date: date?.toISOString() ?? null }, date ? `Wiedervorlage für ${format(date, "dd.MM.yyyy", { locale: de })}` : "Wiedervorlage entfernt")) {
      dialogs.setDatePickerOpen(false); dialogs.setNoteForDatePicker(null);
    }
  };
  const handleSetColorMode = async (id: string, full: boolean) => {
    if (colorModeUpdating) return;
    setColorModeUpdating(id);
    try { await apply(id, { color_full_card: full }, full ? "Ganze Card eingefärbt" : "Nur Kante eingefärbt"); }
    finally { setColorModeUpdating(null); }
  };
  const handleNoteDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    if (data.notes.find(note => note.id === result.draggableId)?.user_id !== userId) { notify.error("Nur eigene Notizen können verschoben werden"); return; }
    const level = Number(result.destination.droppableId.replace("level-", ""));
    if (!Number.isInteger(level) || level < 0 || level > 3) return;
    await apply(result.draggableId, { priority_level: level }, "Priorität geändert");
  };
  return {
    colorModeUpdating, handleArchive, handleSetFollowUp, handleSetColorMode, handleNoteDragEnd,
    handleTogglePin: (note: QuickNote) => apply(note.id, { is_pinned: !note.is_pinned }, note.is_pinned ? "Notiz losgelöst" : "Notiz angepinnt"),
    handleDelete: (id: string) => apply(id, { deleted_at: new Date().toISOString(), permanent_delete_at: addDays(new Date(), 30).toISOString() }, "Notiz in den Papierkorb verschoben"),
    handleSetPriority: (id: string, level: number) => apply(id, { priority_level: level }, "Priorität geändert"),
    handleSetColor: (id: string, color: string | null) => apply(id, { color }, "Farbe geändert"),
  };
}
