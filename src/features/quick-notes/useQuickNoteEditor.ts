import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { stripHtml, toEditorHtml } from "@/hooks/quickNotes/utils";
import { getErrorMessage } from "@/utils/errorHandler";
import { notify } from "@/lib/notify";
import type { useQuickNotesData } from "./useQuickNotesData";
import type { useQuickNoteDialogs } from "./useQuickNoteDialogs";
import type { QuickNote } from "./types";

const signature = (title: string | null, content: string) => JSON.stringify([toEditorHtml(title), toEditorHtml(content)]);
export function useQuickNoteEditor(data: ReturnType<typeof useQuickNotesData>, dialogs: ReturnType<typeof useQuickNoteDialogs>) {
  const copyBusy = useRef(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editSaveStatus, setEditSaveStatus] = useState("");
  const last = useRef({ key: "", signature: "" });
  const flight = useRef<Promise<void> | null>(null);
  const current = useRef(dialogs);
  current.current = dialogs;
  const { editingNote, editTitle, editContent, editDialogOpen } = dialogs;
  const key = `${data.repository.scope.userId}:${data.repository.scope.tenantId}:${editingNote?.id ?? ""}`;
  const latestKey = useRef(key);
  latestKey.current = key;
  const save = useRef<(close: boolean) => Promise<void>>(async () => {});
  save.current = async (close) => {
    const snapshot = current.current;
    const note = snapshot.editingNote;
    if (!note || (!stripHtml(snapshot.editTitle) && !stripHtml(snapshot.editContent))) return;
    const savingKey = latestKey.current;
    const snapshotSignature = signature(snapshot.editTitle, snapshot.editContent);
    if (close) setSavingEdit(true);
    try {
      await flight.current;
      const operation = async () => {
        if (last.current.key !== savingKey || last.current.signature !== snapshotSignature) {
          setEditSaveStatus("Wird auf diesem Gerät gesichert…");
          if (snapshot.draftRestored && snapshot.draftBaseRevision === undefined && note.revision !== undefined) {
            throw new Error("Dieser ältere Entwurf besitzt keinen Versionsstand. Bitte als neue Notiz sichern");
          }
          await data.repository.queue({
            note: { ...note, revision: snapshot.draftBaseRevision ?? note.revision },
            title: snapshot.editTitle.trim() || null, content: snapshot.editContent.trim(),
          });
          last.current = { key: savingKey, signature: snapshotSignature };
        }
        if (latestKey.current !== savingKey) return;
        // Do not erase text entered while IndexedDB was committing an autosave.
        if (signature(current.current.editTitle, current.current.editContent) === snapshotSignature) {
          snapshot.setEditingNote({ ...note, title: snapshot.editTitle.trim() || null, content: snapshot.editContent.trim() });
          snapshot.clearDraft();
        }
        setEditSaveStatus(navigator.onLine ? "Lokal gesichert – Synchronisierung läuft" : "Auf diesem Gerät gespeichert – Synchronisierung ausstehend");
        if (close) { snapshot.setEditDialogOpen(false); snapshot.setEditingNote(null); }
      };
      const request = operation();
      flight.current = request;
      try { await request; } finally { if (flight.current === request) flight.current = null; }
    } catch (error) {
      setEditSaveStatus(`Nicht synchronisiert: ${getErrorMessage(error)}. Dein Entwurf bleibt erhalten.`);
      if (close) notify.error(getErrorMessage(error));
    } finally { if (close) setSavingEdit(false); }
  };
  useEffect(() => {
    if (!editingNote || !editDialogOpen) return;
    if (last.current.key !== key) {
      last.current = { key, signature: signature(editingNote.title, editingNote.content) };
      setEditSaveStatus("");
    }
    if (savingEdit || signature(editTitle, editContent) === last.current.signature || (!stripHtml(editTitle) && !stripHtml(editContent))) return;
    setEditSaveStatus("Änderungen werden gleich automatisch gesichert…");
    const timer = window.setTimeout(() => { void save.current(false); }, 1200);
    return () => window.clearTimeout(timer);
  }, [key, editingNote, editDialogOpen, editTitle, editContent, savingEdit]);
  const openEditDialog = (note: QuickNote) => {
    last.current = { key: `${data.repository.scope.userId}:${data.repository.scope.tenantId}:${note.id}`, signature: signature(note.title, note.content) };
    dialogs.setEditingNote(note); dialogs.setEditDialogOpen(true); setEditSaveStatus("");
  };
  const openVersionHistory = async (note: QuickNote) => {
    const { data: versions, error } = await supabase.from("quick_note_versions")
      .select("id, title, content, created_at").eq("note_id", note.id).eq("tenant_id", data.repository.scope.tenantId).order("created_at", { ascending: false });
    if (error) { notify.error(getErrorMessage(error)); return; }
    dialogs.setVersions((versions ?? []).map(version => ({ ...version, created_at: version.created_at ?? "" })));
    dialogs.setVersionHistoryNote(note); dialogs.setVersionHistoryOpen(true);
  };
  const restoreVersion = async (version: { title: string | null; content: string }) => {
    if (!dialogs.versionHistoryNote) return;
    try {
      const note = data.repository.getNotes().find(item => item.id === dialogs.versionHistoryNote?.id) ?? dialogs.versionHistoryNote;
      await data.repository.queue({ note, title: version.title, content: version.content });
      dialogs.setVersionHistoryOpen(false); notify.success("Version lokal wiederhergestellt");
    } catch (error) { notify.error(getErrorMessage(error)); }
  };
  const saveDraftAsCopy = async () => {
    if (copyBusy.current) return;
    copyBusy.current = true; setSavingEdit(true);
    try {
      await flight.current;
      await data.repository.queue({ title: dialogs.editTitle.trim() || null, content: dialogs.editContent.trim(), color: dialogs.editingNote?.color });
      dialogs.clearDraft(); dialogs.setEditDialogOpen(false); dialogs.setEditingNote(null);
      notify.success("Text als neue Notiz auf diesem Gerät gespeichert");
    } catch (error) { notify.error(getErrorMessage(error)); }
    finally { copyBusy.current = false; setSavingEdit(false); }
  };
  const cached = editingNote ? data.repository.getNotes().find(note => note.id === editingNote.id) : undefined;
  const status = cached && signature(cached.title, cached.content) === signature(editTitle, editContent)
    ? cached.sync_status === "conflict" || cached.sync_status === "error" ? "Synchronisierung angehalten – dein Text bleibt lokal erhalten"
      : cached.sync_status === "pending" ? "Auf diesem Gerät gespeichert – Synchronisierung ausstehend"
      : navigator.onLine ? "Synchronisiert" : "Auf diesem Gerät verfügbar"
    : editSaveStatus;
  return { saveDraftAsCopy, savingEdit, editSaveStatus: status, openEditDialog, handleSaveEdit: () => save.current(true), openVersionHistory, restoreVersion };
}
