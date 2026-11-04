import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useEffect, useState } from "react";
import { useQuickNoteDraft } from "@/hooks/useQuickNoteDraft";
import { toEditorHtml } from "@/hooks/quickNotes/utils";
import type { QuickNote } from "./types";

export function useQuickNoteDialogs() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  // Dialog state
  const [meetingSelectorOpen, setMeetingSelectorOpen] = useState(false);
  const [noteForMeeting, setNoteForMeeting] = useState<QuickNote | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<QuickNote | null>(null);
  const { title: editTitle, content: editContent, setTitle: setEditTitle, setContent: setEditContent, clearDraft, draftStatus, draftBaseRevision, draftRestored } = useQuickNoteDraft(`edit:${editingNote?.id ?? "none"}`, { title: toEditorHtml(editingNote?.title), content: toEditorHtml(editingNote?.content), baseRevision: editingNote?.revision });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [noteForDatePicker, setNoteForDatePicker] = useState<QuickNote | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [noteForShare, setNoteForShare] = useState<QuickNote | null>(null);
  const [globalShareDialogOpen, setGlobalShareDialogOpen] = useState(false);
  const [decisionCreatorOpen, setDecisionCreatorOpen] = useState(false);
  const [noteForDecision, setNoteForDecision] = useState<QuickNote | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [versionHistoryNote, setVersionHistoryNote] = useState<QuickNote | null>(null);
  const [versions, setVersions] = useState<Array<{
    id: string;
    title: string | null;
    content: string;
    created_at: string;
  }>>([]);

  // Confirmation dialogs state
  const [confirmDeleteTaskNote, setConfirmDeleteTaskNote] = useState<QuickNote | null>(null);
  const [confirmDeleteLinkedNote, setConfirmDeleteLinkedNote] = useState<QuickNote | null>(null);
  const [confirmRemoveDecision, setConfirmRemoveDecision] = useState<QuickNote | null>(null);
  const [confirmRemoveCaseItem, setConfirmRemoveCaseItem] = useState<QuickNote | null>(null);
  const [deleteLinkedTask, setDeleteLinkedTask] = useState(false);
  const [deleteLinkedDecision, setDeleteLinkedDecision] = useState(false);
  const [deleteLinkedMeeting, setDeleteLinkedMeeting] = useState(false);
  const [deleteLinkedCaseItem, setDeleteLinkedCaseItem] = useState(false);

  useEffect(() => {
    setMeetingSelectorOpen(false); setNoteForMeeting(null);
    setEditDialogOpen(false); setEditingNote(null);
    setDatePickerOpen(false); setNoteForDatePicker(null);
    setShareDialogOpen(false); setNoteForShare(null); setGlobalShareDialogOpen(false);
    setDecisionCreatorOpen(false); setNoteForDecision(null);
    setVersionHistoryOpen(false); setVersionHistoryNote(null); setVersions([]);
    setConfirmDeleteTaskNote(null); setConfirmDeleteLinkedNote(null);
    setConfirmRemoveDecision(null); setConfirmRemoveCaseItem(null);
  }, [user?.id, currentTenant?.id]);
  return { meetingSelectorOpen, setMeetingSelectorOpen, noteForMeeting, setNoteForMeeting, editDialogOpen, setEditDialogOpen, editingNote, setEditingNote, datePickerOpen, setDatePickerOpen, noteForDatePicker, setNoteForDatePicker, shareDialogOpen, setShareDialogOpen, noteForShare, setNoteForShare, globalShareDialogOpen, setGlobalShareDialogOpen, decisionCreatorOpen, setDecisionCreatorOpen, noteForDecision, setNoteForDecision, versionHistoryOpen, setVersionHistoryOpen, versionHistoryNote, setVersionHistoryNote, versions, setVersions, confirmDeleteTaskNote, setConfirmDeleteTaskNote, confirmDeleteLinkedNote, setConfirmDeleteLinkedNote, confirmRemoveDecision, setConfirmRemoveDecision, confirmRemoveCaseItem, setConfirmRemoveCaseItem, deleteLinkedTask, setDeleteLinkedTask, deleteLinkedDecision, setDeleteLinkedDecision, deleteLinkedMeeting, setDeleteLinkedMeeting, deleteLinkedCaseItem, setDeleteLinkedCaseItem, editTitle, editContent, setEditTitle, setEditContent, clearDraft, draftStatus, draftBaseRevision, draftRestored };
}
