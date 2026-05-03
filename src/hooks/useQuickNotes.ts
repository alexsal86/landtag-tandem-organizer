import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { debugConsole } from '@/utils/debugConsole';
import { getErrorMessage } from '@/utils/errorHandler';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { format, addDays, isToday, isPast, isBefore, isAfter, startOfDay } from "date-fns";
import { de } from "date-fns/locale";
import type { QuickNote } from "@/components/shared/QuickNotesList";
import type { DropResult } from "@hello-pangea/dnd";

export interface GroupedNotes {
  level: number;
  label: string;
  notes: QuickNote[];
}

// Note colors for picker
export const noteColors = [
  { value: '#f59e0b', bg: '#fef3c7', label: 'Gold' },
  { value: '#3b82f6', bg: '#dbeafe', label: 'Blau' },
  { value: '#22c55e', bg: '#dcfce7', label: 'Grün' },
  { value: '#ec4899', bg: '#fce7f3', label: 'Pink' },
  { value: '#8b5cf6', bg: '#ede9fe', label: 'Lila' },
  { value: '#f97316', bg: '#fed7aa', label: 'Orange' },
  { value: '#06b6d4', bg: '#cffafe', label: 'Türkis' },
  { value: '#ef4444', bg: '#fee2e2', label: 'Rot' },
  { value: null, bg: null, label: 'Standard' }
];

export const stripHtml = (value: string) => value.replace(/<[^>]*>/g, "").trim();
export const toEditorHtml = (value: string | null | undefined) => {
  if (!value) return "";
  if (/<[^>]+>/.test(value)) return value;
  return `<p>${value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</p>`;
};

export const getCardBackground = (color: string | null): string | undefined => {
  if (!color) return undefined;
  const found = noteColors.find(c => c.value === color);
  return found?.bg || `${color}30`;
};

const hasInactiveMeetingLink = (note: QuickNote) => {
  if (!note.meeting_id) return false;
  return !note.meetings || note.meetings.status === 'archived';
};

const normalizeMeetingLink = (note: QuickNote): QuickNote => {
  if (!hasInactiveMeetingLink(note)) return note;
  return {
    ...note,
    meeting_id: undefined,
    meetings: null,
    pending_for_jour_fixe: false,
  };
};

export function useQuickNotes(refreshTrigger?: number, controlledSearchQuery?: string) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
  const [followUpExpanded, setFollowUpExpanded] = useState(true);
  const [scheduledFollowUpsExpanded, setScheduledFollowUpsExpanded] = useState(false);
  const [colorModeUpdating, setColorModeUpdating] = useState<string | null>(null);

  // Dialog state
  const [meetingSelectorOpen, setMeetingSelectorOpen] = useState(false);
  const [noteForMeeting, setNoteForMeeting] = useState<QuickNote | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<QuickNote | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
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
  const [deleteLinkedTask, setDeleteLinkedTask] = useState(true);
  const [deleteLinkedDecision, setDeleteLinkedDecision] = useState(true);
  const [deleteLinkedMeeting, setDeleteLinkedMeeting] = useState(false);
  const [deleteLinkedCaseItem, setDeleteLinkedCaseItem] = useState(true);

  // ── Data Loading ──────────────────────────────────────────────────────

  const loadNotes = useCallback(async () => {
    if (!user) return;

    try {
      const [ownNotesResult, individualSharesResult, globalSharesResult] = await Promise.all([
        supabase
          .from("quick_notes")
          .select(`
            id, title, content, color, color_full_card, is_pinned, created_at, updated_at, user_id,
            is_archived, task_id, meeting_id, decision_id, case_item_id, priority_level, follow_up_date, pending_for_jour_fixe, topic_backlog_id,
            task_archived_info, decision_archived_info, meeting_archived_info,
            meetings!meeting_id(title, meeting_date, status)
          `)
          .eq("user_id", user.id)
          .eq("is_archived", false)
          .is("deleted_at", null)
          .order("is_pinned", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("quick_note_shares")
          .select("note_id, permission_type")
          .eq("shared_with_user_id", user.id),
        supabase
          .from("quick_note_global_shares")
          .select("user_id")
          .eq("shared_with_user_id", user.id)
      ]);

      const { data: ownNotes, error: ownError } = ownNotesResult;
      if (ownError) throw ownError;

      const noteIds = (ownNotes || []).map((n: Record<string, any>) => n.id);
      let shareDetails: Record<string, Array<{ id: string; display_name: string | null }>> = {};

      if (noteIds.length > 0) {
        const { data: sharesData } = await supabase
          .from("quick_note_shares")
          .select("note_id, shared_with_user_id")
          .in("note_id", noteIds);

        if (sharesData && sharesData.length > 0) {
          const sharedUserIds = [...new Set(sharesData.map((s: Record<string, any>) => s.shared_with_user_id))];
          const { data: sharedProfiles } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", sharedUserIds);

          sharesData.forEach((s: Record<string, any>) => {
            if (!shareDetails[s.note_id]) {
              shareDetails[s.note_id] = [];
            }
            const profile = sharedProfiles?.find((p: Record<string, any>) => p.user_id === s.shared_with_user_id);
            shareDetails[s.note_id].push({
              id: s.shared_with_user_id,
              display_name: profile?.display_name || null
            });
          });
        }
      }

      const { data: individualShares } = individualSharesResult;
      const { data: globalShares } = globalSharesResult;

      const individualNoteIds = individualShares?.map((s: Record<string, any>) => s.note_id) || [];
      const globalShareUserIds = globalShares?.map((s: Record<string, any>) => s.user_id) || [];

      let sharedNotes: QuickNote[] = [];

      if (individualNoteIds.length > 0) {
        const { data: individuallySharedData } = await supabase
          .from("quick_notes")
          .select(`
            id, title, content, color, color_full_card, is_pinned, created_at, updated_at, user_id,
            is_archived, task_id, meeting_id, decision_id, case_item_id, priority_level, follow_up_date, pending_for_jour_fixe, topic_backlog_id,
            task_archived_info, decision_archived_info, meeting_archived_info,
            meetings!meeting_id(title, meeting_date, status)
          `)
          .in("id", individualNoteIds)
          .eq("is_archived", false)
          .is("deleted_at", null);

        if (individuallySharedData && individuallySharedData.length > 0) {
          const ownerIds = [...new Set(individuallySharedData.map((n: Record<string, any>) => n.user_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, display_name, avatar_url")
            .in("user_id", ownerIds);

          sharedNotes = individuallySharedData.map((note: Record<string, any>) => {
            const shareInfo = individualShares?.find((s: Record<string, any>) => s.note_id === note.id);
            return {
              ...note,
              is_shared: true,
              can_edit: shareInfo?.permission_type === 'edit',
              owner: profiles?.find((p: Record<string, any>) => p.user_id === note.user_id) || null
            };
          }) as QuickNote[];
        }
      }

      if (globalShareUserIds.length > 0) {
        const { data: globallySharedData } = await supabase
          .from("quick_notes")
          .select(`
            id, title, content, color, color_full_card, is_pinned, created_at, updated_at, user_id,
            is_archived, task_id, meeting_id, decision_id, case_item_id, priority_level, follow_up_date, pending_for_jour_fixe, topic_backlog_id,
            task_archived_info, decision_archived_info, meeting_archived_info,
            meetings!meeting_id(title, meeting_date, status)
          `)
          .in("user_id", globalShareUserIds)
          .eq("is_archived", false)
          .is("deleted_at", null);

        if (globallySharedData && globallySharedData.length > 0) {
          const ownerIds = [...new Set(globallySharedData.map((n: Record<string, any>) => n.user_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, display_name, avatar_url")
            .in("user_id", ownerIds);

          const globalNotes = globallySharedData
            .filter((note: Record<string, any>) => !sharedNotes.some(s => s.id === note.id))
            .map((note: Record<string, any>) => ({
              ...note,
              is_shared: true,
              owner: profiles?.find((p: Record<string, any>) => p.user_id === note.user_id) || null
            })) as QuickNote[];

          sharedNotes = [...sharedNotes, ...globalNotes];
        }
      }

      const ownWithDetails = (ownNotes || []).map((note: Record<string, any>) => ({
        ...note,
        share_count: shareDetails[note.id]?.length || 0,
        shared_with_users: shareDetails[note.id] || []
      })) as QuickNote[];

      const ownNotesWithInactiveMeetings = ownWithDetails.filter(hasInactiveMeetingLink);
      if (ownNotesWithInactiveMeetings.length > 0) {
        const ownNoteIdsToCleanup = ownNotesWithInactiveMeetings.map(note => note.id);
        const timestamp = new Date().toISOString();

        const { error: cleanupError } = await supabase
          .from("quick_notes")
          .update({
            meeting_id: null,
            pending_for_jour_fixe: false,
            meeting_archived_info: null,
            added_to_meeting_at: null,
            updated_at: timestamp,
          })
          .in("id", ownNoteIdsToCleanup)
          .eq("user_id", user.id);

        if (cleanupError) {
          debugConsole.error("Error cleaning up inactive meeting links:", cleanupError);
        }
      }

      setNotes([...ownWithDetails, ...sharedNotes].map(normalizeMeetingLink));
    } catch (error) {
      debugConsole.error("Error loading notes:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes, refreshTrigger]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`quick-notes-${user.id}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quick_notes',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          setTimeout(() => loadNotes(), 1000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadNotes]);

  useEffect(() => {
    const handleNoteCreated = () => {
      loadNotes();
    };
    window.addEventListener('quick-note-created', handleNoteCreated);
    return () => window.removeEventListener('quick-note-created', handleNoteCreated);
  }, [loadNotes]);

  // Follow-up notifications
  const followUpNotifiedRef = useRef(false);
  useEffect(() => {
    if (!user || followUpNotifiedRef.current || notes.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    const storageKey = `follow_up_notified_${today}`;
    const alreadyNotified: string[] = JSON.parse(localStorage.getItem(storageKey) || '[]');

    const now = startOfDay(new Date());
    const dueFollowUps = notes.filter(n =>
      n.follow_up_date &&
      n.user_id === user.id &&
      !alreadyNotified.includes(n.id) &&
      isBefore(startOfDay(new Date(n.follow_up_date)), addDays(now, 1))
    );

    if (dueFollowUps.length > 0) {
      followUpNotifiedRef.current = true;
      const newNotified = [...alreadyNotified];

      dueFollowUps.forEach(async (note) => {
        try {
          await supabase.rpc('create_notification', {
            user_id_param: user.id,
            type_name: 'note_follow_up',
            title_param: 'Fällige Wiedervorlage',
            message_param: `Notiz "${note.title || 'Ohne Titel'}" hat eine fällige Wiedervorlage`,
            data_param: JSON.stringify({ noteId: note.id, date: today }),
            priority_param: 'high',
          });
          newNotified.push(note.id);
        } catch (e) {
          debugConsole.error('Follow-up notification error:', e);
        }
      });

      localStorage.setItem(storageKey, JSON.stringify(newNotified));

      try {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('follow_up_notified_') && key !== storageKey) {
            localStorage.removeItem(key);
          }
        });
      } catch {}
    } else {
      followUpNotifiedRef.current = true;
    }
  }, [notes, user]);

  // ── Grouping & Filtering ─────────────────────────────────────────────

  const groupNotesByPriority = useCallback((allNotes: QuickNote[]) => {
    const now = startOfDay(new Date());

    const followUpNotes = allNotes.filter(n =>
      n.follow_up_date && isBefore(startOfDay(new Date(n.follow_up_date)), addDays(now, 1))
    ).sort((a, b) =>
      new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime()
    );

    const scheduledFollowUps = allNotes.filter(n =>
      n.follow_up_date && isAfter(startOfDay(new Date(n.follow_up_date)), now)
    ).sort((a, b) =>
      new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime()
    );

    const remaining = allNotes.filter(n => !n.follow_up_date);
    const maxLevel = Math.max(...remaining.map(n => n.priority_level || 0), 0);

    const groups: GroupedNotes[] = [];

    for (let level = 1; level <= maxLevel; level++) {
      const levelNotes = remaining.filter(n => n.priority_level === level);
      if (levelNotes.length > 0) {
        groups.push({
          level,
          label: `Level ${level}`,
          notes: levelNotes.sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          })
        });
      }
    }

    const standardNotes = remaining.filter(n => !n.priority_level || n.priority_level === 0);
    if (standardNotes.length > 0) {
      groups.push({
        level: 0,
        label: 'Ohne Priorität',
        notes: standardNotes.sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
      });
    }

    return { groups, followUpNotes, scheduledFollowUps };
  }, []);

  const searchQuery = controlledSearchQuery ?? internalSearchQuery;

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const query = searchQuery.toLowerCase();
    return notes.filter(note =>
      stripHtml(note.title || "").toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query) ||
      note.meetings?.title?.toLowerCase().includes(query)
    );
  }, [notes, searchQuery]);

  const { groups, followUpNotes, scheduledFollowUps } = groupNotesByPriority(filteredNotes);

  // ── Action Handlers ───────────────────────────────────────────────────

  const handleTogglePin = async (note: QuickNote) => {
    if (!user?.id) { toast.error("Nicht angemeldet"); return; }
    try {
      const { data, error } = await supabase
        .from("quick_notes")
        .update({ is_pinned: !note.is_pinned })
        .eq("id", note.id)
        .eq("user_id", user.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) { toast.error("Keine Berechtigung zum Ändern dieser Notiz"); return; }
      toast.success(note.is_pinned ? "Notiz losgelöst" : "Notiz angepinnt");
      loadNotes();
    } catch (error) {
      debugConsole.error("Error toggling pin:", error);
      toast.error("Fehler beim Ändern");
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!user?.id) { toast.error("Nicht angemeldet"); return; }
    try {
      const permanentDeleteAt = addDays(new Date(), 30);
      const { data, error } = await supabase
        .from("quick_notes")
        .update({
          deleted_at: new Date().toISOString(),
          permanent_delete_at: permanentDeleteAt.toISOString()
        })
        .eq("id", noteId)
        .eq("user_id", user.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) { toast.error("Notiz konnte nicht gelöscht werden"); return; }
      toast.success("Notiz in Papierkorb verschoben (wird nach 30 Tagen gelöscht)");
      loadNotes();
    } catch (error) {
      debugConsole.error("Error deleting note:", error);
      toast.error("Fehler beim Löschen");
    }
  };

  const handleArchive = async (noteId: string) => {
    if (!user?.id) { toast.error("Nicht angemeldet"); return; }
    try {
      const { data, error } = await supabase
        .from("quick_notes")
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq("id", noteId)
        .eq("user_id", user.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) { toast.error("Notiz konnte nicht archiviert werden"); return; }
      toast.success("Notiz archiviert");
      loadNotes();
    } catch (error) {
      debugConsole.error("Error archiving note:", error);
      toast.error("Fehler beim Archivieren");
    }
  };

  const handleSetPriority = async (noteId: string, level: number) => {
    if (!user?.id) { toast.error("Nicht angemeldet"); return; }
    try {
      const { data, error } = await supabase
        .from("quick_notes")
        .update({ priority_level: level })
        .eq("id", noteId)
        .eq("user_id", user.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) { toast.error("Keine Berechtigung zum Ändern dieser Notiz"); return; }
      toast.success(level > 0 ? `Level ${level} gesetzt` : "Priorität entfernt");
      loadNotes();
    } catch (error) {
      debugConsole.error("Error setting priority:", error);
      toast.error("Fehler beim Setzen der Priorität");
    }
  };

  const handleSetColor = async (noteId: string, color: string | null) => {
    if (!user?.id) { toast.error("Nicht angemeldet"); return; }
    const note = notes.find(n => n.id === noteId);
    if (!note) { toast.error("Notiz nicht gefunden"); return; }
    const canModify = note.user_id === user.id || note.can_edit === true;
    if (!canModify) { toast.error("Keine Berechtigung zum Ändern dieser Notiz"); return; }
    try {
      const { data, error } = note.user_id === user.id
        ? await supabase.from("quick_notes").update({ color }).eq("id", noteId).eq("user_id", user.id).select()
        : await supabase.from("quick_notes").update({ color }).eq("id", noteId).select();
      if (error) throw error;
      if (!data || data.length === 0) { toast.error("Farbe konnte nicht geändert werden"); return; }
      toast.success(color ? "Farbe gesetzt" : "Farbe entfernt");
      loadNotes();
    } catch (error) {
      debugConsole.error("Error setting color:", error);
      toast.error("Fehler beim Setzen der Farbe");
    }
  };

  const handleSetColorMode = async (noteId: string, fullCard: boolean) => {
    if (colorModeUpdating) return;
    if (!user?.id) { toast.error("Nicht angemeldet"); return; }
    const note = notes.find(n => n.id === noteId);
    if (!note) { toast.error("Notiz nicht gefunden"); return; }
    const canModify = note.user_id === user.id || note.can_edit === true;
    if (!canModify) { toast.error("Keine Berechtigung zum Ändern dieser Notiz"); return; }

    setColorModeUpdating(noteId);
    const previousValue = note.color_full_card;
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, color_full_card: fullCard } : n));

    try {
      const { data, error } = await supabase
        .from("quick_notes")
        .update({ color_full_card: fullCard })
        .eq("id", noteId)
        .select();
      if (error || !data || data.length === 0) {
        setNotes(prev => prev.map(n => n.id === noteId ? { ...n, color_full_card: previousValue } : n));
        toast.error("Fehler beim Setzen des Farbmodus");
        return;
      }
      toast.success(fullCard ? "Ganze Card eingefärbt" : "Nur Kante eingefärbt");
    } catch (error) {
      debugConsole.error("Error setting color mode:", error);
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, color_full_card: previousValue } : n));
      toast.error("Fehler beim Setzen des Farbmodus");
    } finally {
      setTimeout(() => setColorModeUpdating(null), 300);
    }
  };

  const removeDecisionFromNote = async (note: QuickNote) => {
    if (!note.decision_id || !user?.id) return;
    try {
      const { data: decisionData } = await supabase
        .from('task_decisions').select('title').eq('id', note.decision_id).single();
      await supabase.from('task_decisions').update({ archived_at: new Date().toISOString() }).eq('id', note.decision_id);
      const archivedInfo = decisionData ? { id: note.decision_id, title: decisionData.title, archived_at: new Date().toISOString() } : null;
      await supabase.from("quick_notes").update({ decision_id: null, decision_archived_info: archivedInfo }).eq("id", note.id).eq("user_id", user.id);
      toast.success("Entscheidungsanfrage zurückgenommen");
      setConfirmRemoveDecision(null);
      loadNotes();
    } catch (error) {
      debugConsole.error("Error removing decision:", error);
      toast.error("Fehler beim Zurücknehmen der Entscheidung");
    }
  };

  const handleSetFollowUp = async (noteId: string, date: Date | null) => {
    if (!user?.id) { toast.error("Nicht angemeldet"); return; }
    try {
      const { data, error } = await supabase
        .from("quick_notes")
        .update({ follow_up_date: date?.toISOString() || null })
        .eq("id", noteId)
        .eq("user_id", user.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) { toast.error("Wiedervorlage konnte nicht gesetzt werden"); return; }
      toast.success(date ? `Wiedervorlage für ${format(date, "dd.MM.yyyy", { locale: de })}` : "Wiedervorlage entfernt");
      loadNotes();
      setDatePickerOpen(false);
      setNoteForDatePicker(null);
    } catch (error) {
      debugConsole.error("Error setting follow-up:", error);
      toast.error("Fehler beim Setzen der Wiedervorlage");
    }
  };

  const createTaskFromNote = async (note: QuickNote) => {
    if (!user || !currentTenant) { toast.error("Nicht angemeldet"); return; }
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
      await supabase.from("quick_notes").update({ task_id: task.id }).eq("id", note.id);
      toast.success("Aufgabe erstellt");
      loadNotes();
    } catch (error) {
      debugConsole.error('Error creating task from note:', error);
      toast.error("Fehler beim Erstellen der Aufgabe");
    }
  };

  const removeTaskFromNote = async (note: QuickNote) => {
    if (!note.task_id || !user?.id) return;
    try {
      const { error: taskError } = await supabase.from('tasks').delete().eq('id', note.task_id);
      if (taskError && !taskError.message.includes('0 rows')) {
        debugConsole.warn('Task deletion warning:', taskError);
      }
      const { error: noteError } = await supabase
        .from("quick_notes").update({ task_id: null }).eq("id", note.id).eq("user_id", user.id);
      if (noteError) debugConsole.warn('Note update warning:', noteError);
      toast.success("Aufgabe entfernt");
      setConfirmDeleteTaskNote(null);
      loadNotes();
    } catch (error) {
      debugConsole.error('Error removing task from note:', error);
      toast.error("Fehler beim Entfernen der Aufgabe");
    }
  };

  const handleDeleteWithConfirmation = (note: QuickNote) => {
    const hasLinks = note.task_id || note.decision_id || note.meeting_id || note.case_item_id;
    if (hasLinks) {
      setDeleteLinkedTask(!!note.task_id);
      setDeleteLinkedDecision(!!note.decision_id);
      setDeleteLinkedMeeting(false);
      setDeleteLinkedCaseItem(!!note.case_item_id);
      setConfirmDeleteLinkedNote(note);
    } else {
      handleDelete(note.id);
    }
  };

  const handleDeleteNoteWithLinks = async () => {
    if (!confirmDeleteLinkedNote || !user?.id) return;
    const note = confirmDeleteLinkedNote;
    try {
      if (note.task_id && deleteLinkedTask) {
        await supabase.from('tasks').delete().eq('id', note.task_id);
      }
      if (note.decision_id && deleteLinkedDecision) {
        await supabase.from('task_decisions').delete().eq('id', note.decision_id);
      }
      if (note.meeting_id && deleteLinkedMeeting) {
        await supabase.from("quick_notes").update({ meeting_id: null, added_to_meeting_at: null }).eq("id", note.id).eq("user_id", user.id);
      }
      if (note.case_item_id && deleteLinkedCaseItem) {
        await supabase.from('case_items').update({ status: 'archiviert' }).eq('id', note.case_item_id);
      }
      await handleDelete(note.id);
      setConfirmDeleteLinkedNote(null);
    } catch (error) {
      debugConsole.error("Error deleting note with links:", error);
      toast.error("Fehler beim Löschen");
    }
  };

  const addNoteToMeeting = async (noteId: string, meetingId: string, _meetingTitle: string) => {
    if (!user?.id) { toast.error("Nicht angemeldet"); return; }
    try {
      const { data, error } = await supabase
        .from('quick_notes')
        .update({ meeting_id: meetingId, added_to_meeting_at: new Date().toISOString(), pending_for_jour_fixe: false })
        .eq('id', noteId).eq('user_id', user.id).select();
      if (error) throw error;
      if (!data || data.length === 0) { toast.error("Notiz konnte nicht zugewiesen werden"); return; }
      toast.success(`Notiz zum Jour Fixe hinzugefügt`);
      setMeetingSelectorOpen(false);
      setNoteForMeeting(null);
      loadNotes();
    } catch (error) {
      debugConsole.error('Error adding note to meeting:', error);
      toast.error("Fehler beim Hinzufügen zum Jour Fixe");
    }
  };

  const markForNextJourFixe = async (noteId: string) => {
    if (!user?.id) { toast.error("Nicht angemeldet"); return; }
    try {
      const { data, error } = await supabase
        .from('quick_notes').update({ pending_for_jour_fixe: true }).eq('id', noteId).eq('user_id', user.id).select();
      if (error) throw error;
      if (!data || data.length === 0) { toast.error("Notiz konnte nicht vorgemerkt werden"); return; }
      toast.success("Notiz für nächsten Jour Fixe vorgemerkt");
      loadNotes();
    } catch (error) {
      debugConsole.error('Error marking for Jour Fixe:', error);
      toast.error("Fehler beim Vormerken");
    }
  };

  const removeFromJourFixeQueue = async (noteId: string) => {
    try {
      const { error } = await supabase.from('quick_notes').update({ pending_for_jour_fixe: false }).eq('id', noteId);
      if (error) throw error;
      toast.success("Vormerkung entfernt");
      loadNotes();
    } catch (error) {
      debugConsole.error('Error removing from Jour Fixe queue:', error);
      toast.error("Fehler beim Entfernen der Vormerkung");
    }
  };

  const removeNoteFromMeeting = async (noteId: string) => {
    if (!user?.id) { toast.error("Nicht angemeldet"); return; }
    try {
      const { data, error } = await supabase
        .from('quick_notes').update({ meeting_id: null, added_to_meeting_at: null }).eq('id', noteId).eq('user_id', user.id).select();
      if (error) throw error;
      if (!data || data.length === 0) { toast.error("Notiz konnte nicht entfernt werden"); return; }
      toast.success("Notiz vom Jour Fixe entfernt");
      loadNotes();
    } catch (error) {
      debugConsole.error('Error removing note from meeting:', error);
      toast.error("Fehler beim Entfernen");
    }
  };

  const openEditDialog = (note: QuickNote) => {
    setEditingNote(note);
    setEditTitle(toEditorHtml(note.title));
    setEditContent(toEditorHtml(note.content));
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingNote || !user?.id) return;
    if (!stripHtml(editTitle) && !stripHtml(editContent)) { toast.error("Bitte Titel oder Inhalt eingeben"); return; }
    try {
      await supabase.from("quick_note_versions").insert([{ note_id: editingNote.id, title: editingNote.title, content: editingNote.content, user_id: user.id }]);
      let updateQuery = supabase.from("quick_notes").update({ title: editTitle.trim() || null, content: editContent.trim() }).eq("id", editingNote.id);
      if (editingNote.user_id === user.id) updateQuery = updateQuery.eq("user_id", user.id);
      const { data, error } = await updateQuery.select();
      if (error) throw error;
      if (!data || data.length === 0) { toast.error("Keine Berechtigung zum Bearbeiten dieser Notiz"); return; }
      toast.success("Notiz aktualisiert");
      setEditDialogOpen(false);
      setEditingNote(null);
      loadNotes();
    } catch (error) {
      debugConsole.error("Error updating note:", error);
      toast.error("Fehler beim Speichern");
    }
  };

  const openVersionHistory = async (note: QuickNote) => {
    const { data, error } = await supabase
      .from("quick_note_versions").select("id, note_id, title, content, created_at, user_id").eq("note_id", note.id).order("created_at", { ascending: false });
    if (error) { debugConsole.error("Error loading versions:", error); toast.error("Fehler beim Laden der Versionen"); return; }
    setVersions((data || []).map((v: Record<string, any>) => ({ ...v, created_at: v.created_at ?? '' })));
    setVersionHistoryNote(note);
    setVersionHistoryOpen(true);
  };

  const restoreVersion = async (version: { title: string | null; content: string }) => {
    if (!versionHistoryNote || !user?.id) return;
    try {
      await supabase.from("quick_note_versions").insert([{ note_id: versionHistoryNote.id, title: versionHistoryNote.title, content: versionHistoryNote.content, user_id: user.id }]);
      const { error } = await supabase.from("quick_notes").update({ title: version.title, content: version.content }).eq("id", versionHistoryNote.id).eq("user_id", user.id);
      if (error) throw error;
      toast.success("Version wiederhergestellt");
      setVersionHistoryOpen(false);
      loadNotes();
    } catch (error) {
      debugConsole.error("Error restoring version:", error);
      toast.error("Fehler beim Wiederherstellen");
    }
  };

  const createCaseItemFromNote = async (note: QuickNote) => {
    if (!user || !currentTenant) { toast.error("Nicht angemeldet"); return; }
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

      toast.success("Vorgang erstellt");
      loadNotes();
    } catch (error) {
      debugConsole.error('Error creating case item from note:', error);
      toast.error(getErrorMessage(error));
    }
  };

  const removeCaseItemFromNote = async (note: QuickNote) => {
    if (!note.case_item_id || !user?.id) return;
    try {
      await supabase.from('case_items').update({ status: 'archiviert' }).eq('id', note.case_item_id);
      await supabase.from("quick_notes").update({ case_item_id: null }).eq("id", note.id).eq("user_id", user.id);
      toast.success("Vorgang archiviert und von Notiz entfernt");
      setConfirmRemoveCaseItem(null);
      loadNotes();
    } catch (error) {
      debugConsole.error('Error removing case item from note:', error);
      toast.error("Fehler beim Entfernen des Vorgangs");
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
      toast.info("Keine Aufzählungspunkte gefunden", { description: "Die Notiz enthält keine Aufzählung oder Liste zum Aufteilen." });
      return;
    }
    try {
      const newNotes = items.map((content) => ({
        user_id: user.id, content,
        title: content.substring(0, 30) + (content.length > 30 ? '...' : ''),
        color: note.color, priority_level: note.priority_level || 0,
        is_pinned: false, is_archived: false,
      }));
      const { error } = await supabase.from('quick_notes').insert(newNotes);
      if (error) throw error;
      toast.success(`${items.length} Notizen erstellt`, { description: "Die Aufzählungspunkte wurden in separate Notizen aufgeteilt." });
      loadNotes();
    } catch (error) {
      debugConsole.error('Error splitting note:', error);
      toast.error("Fehler beim Aufteilen der Notiz");
    }
  };

  const handleNoteDragEnd = async (result: DropResult) => {
    if (!result.destination || !user?.id) return;
    const sourceLevel = parseInt(result.source.droppableId.replace('level-', ''));
    const destLevel = parseInt(result.destination.droppableId.replace('level-', ''));
    const noteId = result.draggableId;
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    if (note.user_id !== user.id) { toast.error("Nur eigene Notizen können verschoben werden"); return; }
    if (sourceLevel === destLevel) { toast.info("Reihenfolge wird durch Erstelldatum bestimmt"); return; }
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, priority_level: destLevel } : n));
    try {
      const { error } = await supabase.from("quick_notes").update({ priority_level: destLevel }).eq("id", noteId).eq("user_id", user.id);
      if (error) { debugConsole.error("Error updating priority via drag:", error); loadNotes(); toast.error("Fehler beim Verschieben"); }
      else { toast.success(destLevel > 0 ? `Level ${destLevel} gesetzt` : "Priorität entfernt"); }
    } catch (error) {
      debugConsole.error("Error in drag handler:", error);
      loadNotes();
    }
  };

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
    // Data
    user, notes, loading, searchQuery, setSearchQuery: setInternalSearchQuery,
    filteredNotes, groups, followUpNotes, scheduledFollowUps,
    expandedNotes, expandedDetails, colorModeUpdating,
    followUpExpanded, setFollowUpExpanded,
    scheduledFollowUpsExpanded, setScheduledFollowUpsExpanded,

    // Dialog state
    meetingSelectorOpen, setMeetingSelectorOpen,
    noteForMeeting, setNoteForMeeting,
    editDialogOpen, setEditDialogOpen,
    editingNote, setEditingNote,
    editTitle, setEditTitle,
    editContent, setEditContent,
    datePickerOpen, setDatePickerOpen,
    noteForDatePicker, setNoteForDatePicker,
    shareDialogOpen, setShareDialogOpen,
    noteForShare, setNoteForShare,
    globalShareDialogOpen, setGlobalShareDialogOpen,
    decisionCreatorOpen, setDecisionCreatorOpen,
    noteForDecision, setNoteForDecision,
    versionHistoryOpen, setVersionHistoryOpen,
    versionHistoryNote,
    versions,

    // Confirmation state
    confirmDeleteTaskNote, setConfirmDeleteTaskNote,
    confirmDeleteLinkedNote, setConfirmDeleteLinkedNote,
    confirmRemoveDecision, setConfirmRemoveDecision,
    confirmRemoveCaseItem, setConfirmRemoveCaseItem,
    deleteLinkedTask, setDeleteLinkedTask,
    deleteLinkedDecision, setDeleteLinkedDecision,
    deleteLinkedMeeting, setDeleteLinkedMeeting,
    deleteLinkedCaseItem, setDeleteLinkedCaseItem,

    // Actions
    loadNotes,
    handleTogglePin, handleDelete, handleArchive,
    handleSetPriority, handleSetColor, handleSetColorMode,
    handleSetFollowUp, handleDeleteWithConfirmation, handleDeleteNoteWithLinks,
    createTaskFromNote, removeTaskFromNote, removeDecisionFromNote,
    createCaseItemFromNote, removeCaseItemFromNote,
    addNoteToMeeting, markForNextJourFixe, removeFromJourFixeQueue, removeNoteFromMeeting,
    openEditDialog, handleSaveEdit,
    openVersionHistory, restoreVersion,
    splitNoteIntoBullets,
    handleNoteDragEnd,
    toggleNoteExpand, toggleDetailsExpand,
  };
}
