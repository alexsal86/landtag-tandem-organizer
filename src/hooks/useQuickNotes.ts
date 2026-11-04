import { useQuickNoteLinks } from "@/features/quick-notes/useQuickNoteLinks";
import { useQuickNoteDeletion } from "@/features/quick-notes/useQuickNoteDeletion";
import { useQuickNoteEditor } from "@/features/quick-notes/useQuickNoteEditor";
import { useQuickNotesData } from "@/features/quick-notes/useQuickNotesData";
import { useQuickNoteDialogs } from "@/features/quick-notes/useQuickNoteDialogs";
import { useQuickNoteActions } from "@/features/quick-notes/useQuickNoteActions";
import { useQuickNoteFollowUps } from "@/features/quick-notes/useQuickNoteFollowUps";
import { groupNotesByPriority } from "@/features/quick-notes/selectors";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { noteColors } from "./quickNotes/constants";
import {
  stripHtml,
  toEditorHtml,
  getCardBackground,
} from "./quickNotes/utils";
import type { GroupedNotes } from "./quickNotes/types";

// Re-exports for backwards compatibility
export { noteColors, stripHtml, toEditorHtml, getCardBackground };
export type { GroupedNotes };

export function useQuickNotes(refreshTrigger?: number, controlledSearchQuery?: string) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const data = useQuickNotesData(refreshTrigger);
  const { notes, loading, loadNotes, repository } = data;
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
  const [followUpExpanded, setFollowUpExpanded] = useState(true);
  const [scheduledFollowUpsExpanded, setScheduledFollowUpsExpanded] = useState(false);

  const dialogs = useQuickNoteDialogs();

  useQuickNoteFollowUps(notes, user?.id, currentTenant?.id);

  // ── Grouping & Filtering ─────────────────────────────────────────────

  const searchQuery = controlledSearchQuery ?? internalSearchQuery;

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const query = searchQuery.trim().toLocaleLowerCase("de");
    return notes.filter(note =>
      stripHtml(note.title || "").toLowerCase().includes(query) ||
      stripHtml(note.content).toLocaleLowerCase("de").includes(query) ||
      note.meetings?.title?.toLowerCase().includes(query)
    );
  }, [notes, searchQuery]);

  const { groups, followUpNotes, scheduledFollowUps } = groupNotesByPriority(filteredNotes);

  // ── Action Handlers ───────────────────────────────────────────────────

  const actions = useQuickNoteActions(data, dialogs, user?.id);

  const links = useQuickNoteLinks(data, dialogs, user, currentTenant);
  const deletion = useQuickNoteDeletion(data, dialogs, actions, user?.id);

  const editor = useQuickNoteEditor(data, dialogs);

  const toggleNoteExpand = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) newSet.delete(noteId); else newSet.add(noteId);
      return newSet;
    });
  };

  const toggleDetailsExpand = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedDetails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) newSet.delete(noteId); else newSet.add(noteId);
      return newSet;
    });
  };

  return {
    ...dialogs, ...actions, ...links, ...deletion, ...editor,
    user, notes, loading, searchQuery, setSearchQuery: setInternalSearchQuery,
    filteredNotes, groups, followUpNotes, scheduledFollowUps,
    expandedNotes, expandedDetails, followUpExpanded, setFollowUpExpanded,
    scheduledFollowUpsExpanded, setScheduledFollowUpsExpanded,
    toggleNoteExpand, toggleDetailsExpand, loadNotes, patchNote: data.patchNote,
    toggleChecklist: (id: string, index: number) => repository.toggleChecklist(id, index),
  };
}
