import { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Pin, Trash2, StickyNote, MoreHorizontal, CheckSquare, Vote, 
  Calendar as CalendarIcon, Archive, Edit, ChevronDown, ChevronUp, Clock,
  Star, ArrowUp, ArrowDown, RotateCcw, Share2, Users, Globe, Hourglass,
  Pencil, GripVertical, ListTree, History, ArrowRight, Search, Palette, X
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, addDays, isToday, isPast, isBefore, isAfter, startOfDay } from "date-fns";
import { de } from "date-fns/locale";
import { MeetingNoteSelector } from "@/components/widgets/MeetingNoteSelector";
import { NoteShareDialog } from "@/components/shared/NoteShareDialog";
import { GlobalNoteShareDialog } from "@/components/shared/GlobalNoteShareDialog";
import { NoteDecisionCreator } from "@/components/shared/NoteDecisionCreator";
import { DecisionResponseSummary } from "@/components/shared/DecisionResponseSummary";
import { NoteLinkedBadge } from "@/components/shared/NoteLinkedBadge";
import { NoteLinkedDetails } from "@/components/shared/NoteLinkedDetails";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";

// Type for archived info from database (JSON)
type ArchivedInfo = { id: string; title: string; archived_at: string } | null;

export interface QuickNote {
  id: string;
  title: string | null;
  content: string;
  color: string | null;
  color_full_card?: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  task_id?: string;
  meeting_id?: string;
  decision_id?: string;
  priority_level?: number;
  follow_up_date?: string;
  is_archived?: boolean;
  user_id?: string;
  is_shared?: boolean;
  share_count?: number;
  pending_for_jour_fixe?: boolean;
  can_edit?: boolean; // For shared notes with edit permission
  task_archived_info?: ArchivedInfo | unknown;
  decision_archived_info?: ArchivedInfo | unknown;
  meeting_archived_info?: ArchivedInfo | unknown;
  shared_with_users?: Array<{
    id: string;
    display_name: string | null;
  }>;
  owner?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  meetings?: {
    title: string;
    meeting_date: string;
  } | null;
}

interface QuickNotesListProps {
  refreshTrigger?: number;
  showHeader?: boolean;
  maxHeight?: string;
  onNoteClick?: (note: QuickNote) => void;
}

interface GroupedNotes {
  level: number;
  label: string;
  notes: QuickNote[];
}

export function QuickNotesList({ 
  refreshTrigger, 
  showHeader = true,
  maxHeight = "400px",
  onNoteClick
}: QuickNotesListProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [meetingSelectorOpen, setMeetingSelectorOpen] = useState(false);
  const [noteForMeeting, setNoteForMeeting] = useState<QuickNote | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<QuickNote | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [followUpExpanded, setFollowUpExpanded] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [noteForDatePicker, setNoteForDatePicker] = useState<QuickNote | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [noteForShare, setNoteForShare] = useState<QuickNote | null>(null);
  const [globalShareDialogOpen, setGlobalShareDialogOpen] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [scheduledFollowUpsExpanded, setScheduledFollowUpsExpanded] = useState(false);
  const [decisionCreatorOpen, setDecisionCreatorOpen] = useState(false);
  const [noteForDecision, setNoteForDecision] = useState<QuickNote | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
  
  // Confirmation dialogs state
  const [confirmDeleteTaskNote, setConfirmDeleteTaskNote] = useState<QuickNote | null>(null);
  const [confirmDeleteLinkedNote, setConfirmDeleteLinkedNote] = useState<QuickNote | null>(null);
  const [confirmRemoveDecision, setConfirmRemoveDecision] = useState<QuickNote | null>(null);
  const [deleteLinkedTask, setDeleteLinkedTask] = useState(true);
  const [deleteLinkedDecision, setDeleteLinkedDecision] = useState(true);
  const [deleteLinkedMeeting, setDeleteLinkedMeeting] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  
  // Note colors for picker - Palette 2: Balanced/Mittel (ausgewogen und lesbar)
  const noteColors = [
    { value: '#fbbf24', label: 'Gold' },      // amber-400 - balanced
    { value: '#60a5fa', label: 'Blau' },      // blue-400 - balanced
    { value: '#4ade80', label: 'Grün' },      // green-400 - balanced
    { value: '#f472b6', label: 'Pink' },      // pink-400 - balanced
    { value: '#a78bfa', label: 'Lila' },      // violet-400 - balanced
    { value: '#fb923c', label: 'Orange' },    // orange-400 - balanced
    { value: '#22d3ee', label: 'Türkis' },    // cyan-400 - balanced
    { value: '#f87171', label: 'Rot' },       // red-400 - balanced
    { value: null, label: 'Standard' }
  ];
  
  // State to prevent double-clicks on color mode checkbox
  const [colorModeUpdating, setColorModeUpdating] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    if (!user) return;
    
    try {
      // Load all initial data in parallel for better performance
      const [ownNotesResult, individualSharesResult, globalSharesResult] = await Promise.all([
        supabase
          .from("quick_notes")
          .select(`
            id, title, content, color, color_full_card, is_pinned, created_at, updated_at, user_id,
            is_archived, task_id, meeting_id, decision_id, priority_level, follow_up_date, pending_for_jour_fixe,
            task_archived_info, decision_archived_info, meeting_archived_info,
            meetings!meeting_id(title, meeting_date)
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

      // Load shares with user details for own notes
      const noteIds = (ownNotes || []).map(n => n.id);
      let shareDetails: Record<string, Array<{ id: string; display_name: string | null }>> = {};
      
      if (noteIds.length > 0) {
        const { data: sharesData } = await supabase
          .from("quick_note_shares")
          .select("note_id, shared_with_user_id")
          .in("note_id", noteIds);
        
        if (sharesData && sharesData.length > 0) {
          // Get user profiles for shared users
          const sharedUserIds = [...new Set(sharesData.map(s => s.shared_with_user_id))];
          const { data: sharedProfiles } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", sharedUserIds);
          
          sharesData.forEach(s => {
            if (!shareDetails[s.note_id]) {
              shareDetails[s.note_id] = [];
            }
            const profile = sharedProfiles?.find(p => p.user_id === s.shared_with_user_id);
            shareDetails[s.note_id].push({
              id: s.shared_with_user_id,
              display_name: profile?.display_name || null
            });
          });
        }
      }

      // Extract data from parallel results
      const { data: individualShares } = individualSharesResult;
      const { data: globalShares } = globalSharesResult;

      // Collect all note IDs from individual shares
      const individualNoteIds = individualShares?.map(s => s.note_id) || [];
      // Collect user IDs from global shares
      const globalShareUserIds = globalShares?.map(s => s.user_id) || [];

      let sharedNotes: QuickNote[] = [];
      
      // Load individually shared notes
      if (individualNoteIds.length > 0) {
        const { data: individuallySharedData } = await supabase
          .from("quick_notes")
          .select(`
            id, title, content, color, color_full_card, is_pinned, created_at, updated_at, user_id,
            is_archived, task_id, meeting_id, decision_id, priority_level, follow_up_date, pending_for_jour_fixe,
            task_archived_info, decision_archived_info, meeting_archived_info,
            meetings!meeting_id(title, meeting_date)
          `)
          .in("id", individualNoteIds)
          .eq("is_archived", false)
          .is("deleted_at", null);

        if (individuallySharedData && individuallySharedData.length > 0) {
          const ownerIds = [...new Set(individuallySharedData.map(n => n.user_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, display_name, avatar_url")
            .in("user_id", ownerIds);

          sharedNotes = individuallySharedData.map(note => {
            const shareInfo = individualShares?.find(s => s.note_id === note.id);
            return {
              ...note,
              is_shared: true,
              can_edit: shareInfo?.permission_type === 'edit',
              owner: profiles?.find(p => p.user_id === note.user_id) || null
            };
          }) as QuickNote[];
        }
      }

      // Load globally shared notes
      if (globalShareUserIds.length > 0) {
        const { data: globallySharedData } = await supabase
          .from("quick_notes")
          .select(`
            id, title, content, color, color_full_card, is_pinned, created_at, updated_at, user_id,
            is_archived, task_id, meeting_id, decision_id, priority_level, follow_up_date, pending_for_jour_fixe,
            task_archived_info, decision_archived_info, meeting_archived_info,
            meetings!meeting_id(title, meeting_date)
          `)
          .in("user_id", globalShareUserIds)
          .eq("is_archived", false)
          .is("deleted_at", null);

        if (globallySharedData && globallySharedData.length > 0) {
          const ownerIds = [...new Set(globallySharedData.map(n => n.user_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, display_name, avatar_url")
            .in("user_id", ownerIds);

          const globalNotes = globallySharedData
            .filter(note => !sharedNotes.some(s => s.id === note.id)) // Avoid duplicates
            .map(note => ({
              ...note,
              is_shared: true,
              owner: profiles?.find(p => p.user_id === note.user_id) || null
            })) as QuickNote[];

          sharedNotes = [...sharedNotes, ...globalNotes];
        }
      }

      // Combine own notes with share details and shared notes
      const ownWithDetails = (ownNotes || []).map(note => ({
        ...note,
        share_count: shareDetails[note.id]?.length || 0,
        shared_with_users: shareDetails[note.id] || []
      })) as QuickNote[];

      setNotes([...ownWithDetails, ...sharedNotes]);
    } catch (error) {
      console.error("Error loading notes:", error);
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
      .channel('quick-notes-list-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quick_notes',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          loadNotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadNotes]);

  // Listen for notes created via GlobalQuickNoteDialog
  useEffect(() => {
    const handleNoteCreated = () => {
      loadNotes();
    };
    
    window.addEventListener('quick-note-created', handleNoteCreated);
    return () => window.removeEventListener('quick-note-created', handleNoteCreated);
  }, [loadNotes]);

  // Group notes by priority and follow-up
  const groupNotesByPriority = useCallback((allNotes: QuickNote[]) => {
    const now = startOfDay(new Date());
    
    // Follow-up notes (due today or earlier - fällig)
    const followUpNotes = allNotes.filter(n => 
      n.follow_up_date && isBefore(startOfDay(new Date(n.follow_up_date)), addDays(now, 1))
    ).sort((a, b) => 
      new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime()
    );
    
    // Scheduled follow-ups (future dates - geplant, werden bis dahin ausgeblendet)
    const scheduledFollowUps = allNotes.filter(n => 
      n.follow_up_date && isAfter(startOfDay(new Date(n.follow_up_date)), now)
    ).sort((a, b) => 
      new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime()
    );
    
    // Remaining notes: no follow-up date (exclude scheduled notes!)
    const remaining = allNotes.filter(n => !n.follow_up_date);
    
    // Find max priority level
    const maxLevel = Math.max(...remaining.map(n => n.priority_level || 0), 0);
    
    const groups: GroupedNotes[] = [];
    
    // Level 1, 2, 3... (only if notes exist)
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
    
    // Standard (Level 0)
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

  // Filter notes by search query
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    
    const query = searchQuery.toLowerCase();
    return notes.filter(note => 
      note.title?.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query) ||
      note.meetings?.title?.toLowerCase().includes(query)
    );
  }, [notes, searchQuery]);

  const { groups, followUpNotes, scheduledFollowUps } = groupNotesByPriority(filteredNotes);

  // Action handlers
  const handleTogglePin = async (note: QuickNote) => {
    if (!user?.id) {
      toast.error("Nicht angemeldet");
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from("quick_notes")
        .update({ is_pinned: !note.is_pinned })
        .eq("id", note.id)
        .eq("user_id", user.id)
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error("Keine Berechtigung zum Ändern dieser Notiz");
        return;
      }
      
      toast.success(note.is_pinned ? "Notiz losgelöst" : "Notiz angepinnt");
      loadNotes();
    } catch (error) {
      console.error("Error toggling pin:", error);
      toast.error("Fehler beim Ändern");
    }
  };

  // Soft delete - move to trash instead of permanent delete
  const handleDelete = async (noteId: string) => {
    if (!user?.id) {
      toast.error("Nicht angemeldet");
      return;
    }
    
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
      
      if (!data || data.length === 0) {
        toast.error("Notiz konnte nicht gelöscht werden");
        return;
      }
      
      toast.success("Notiz in Papierkorb verschoben (wird nach 30 Tagen gelöscht)");
      loadNotes();
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Fehler beim Löschen");
    }
  };

  const handleArchive = async (noteId: string) => {
    if (!user?.id) {
      toast.error("Nicht angemeldet");
      return;
    }

    console.log("Archiving note:", { noteId, userId: user.id });

    try {
      const { data, error } = await supabase
        .from("quick_notes")
        .update({ 
          is_archived: true,
          archived_at: new Date().toISOString()
        })
        .eq("id", noteId)
        .eq("user_id", user.id)
        .select();

      console.log("Archive result:", { data, error });

      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error("Notiz konnte nicht archiviert werden");
        return;
      }

      toast.success("Notiz archiviert");
      loadNotes();
    } catch (error) {
      console.error("Error archiving note:", error);
      toast.error("Fehler beim Archivieren");
    }
  };

  const handleSetPriority = async (noteId: string, level: number) => {
    if (!user?.id) {
      toast.error("Nicht angemeldet");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("quick_notes")
        .update({ priority_level: level })
        .eq("id", noteId)
        .eq("user_id", user.id)
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error("Keine Berechtigung zum Ändern dieser Notiz");
        return;
      }
      
      toast.success(level > 0 ? `Level ${level} gesetzt` : "Priorität entfernt");
      loadNotes();
    } catch (error) {
      console.error("Error setting priority:", error);
      toast.error("Fehler beim Setzen der Priorität");
    }
  };

  // Set note color
  const handleSetColor = async (noteId: string, color: string | null) => {
    if (!user?.id) {
      toast.error("Nicht angemeldet");
      return;
    }

    const note = notes.find(n => n.id === noteId);
    if (!note) {
      toast.error("Notiz nicht gefunden");
      return;
    }

    // Check permission: own note OR shared with edit rights
    const canModify = note.user_id === user.id || note.can_edit === true;
    if (!canModify) {
      toast.error("Keine Berechtigung zum Ändern dieser Notiz");
      return;
    }

    try {
      // Execute query directly - different paths for own vs shared notes
      const { data, error } = note.user_id === user.id
        ? await supabase
            .from("quick_notes")
            .update({ color })
            .eq("id", noteId)
            .eq("user_id", user.id)
            .select()
        : await supabase
            .from("quick_notes")
            .update({ color })
            .eq("id", noteId)
            .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error("Farbe konnte nicht geändert werden");
        return;
      }
      
      toast.success(color ? "Farbe gesetzt" : "Farbe entfernt");
      loadNotes();
    } catch (error) {
      console.error("Error setting color:", error);
      toast.error("Fehler beim Setzen der Farbe");
    }
  };

  // Set color full card mode with optimistic UI and locking
  const handleSetColorMode = async (noteId: string, fullCard: boolean) => {
    // Prevent double execution
    if (colorModeUpdating) {
      console.log("Color mode update already in progress, skipping");
      return;
    }
    
    if (!user?.id) {
      toast.error("Nicht angemeldet");
      return;
    }

    const note = notes.find(n => n.id === noteId);
    if (!note) {
      toast.error("Notiz nicht gefunden");
      return;
    }

    // Check permission: own note OR shared with edit rights
    const canModify = note.user_id === user.id || note.can_edit === true;
    if (!canModify) {
      toast.error("Keine Berechtigung zum Ändern dieser Notiz");
      return;
    }

    // Set lock FIRST
    setColorModeUpdating(noteId);
    
    // Optimistic update
    const previousValue = note.color_full_card;
    setNotes(prev => prev.map(n => 
      n.id === noteId ? { ...n, color_full_card: fullCard } : n
    ));

    try {
      // SIMPLIFIED QUERY - let RLS handle permissions
      // No ternary, no user_id filter - RLS policies already check this
      const { error } = await supabase
        .from("quick_notes")
        .update({ color_full_card: fullCard })
        .eq("id", noteId);

      if (error) {
        console.error("Update error:", error);
        // Rollback
        setNotes(prev => prev.map(n => 
          n.id === noteId ? { ...n, color_full_card: previousValue } : n
        ));
        toast.error("Fehler beim Setzen des Farbmodus");
      } else {
        toast.success(fullCard ? "Ganze Card eingefärbt" : "Nur Kante eingefärbt");
      }
    } catch (error) {
      console.error("Error setting color mode:", error);
      setNotes(prev => prev.map(n => 
        n.id === noteId ? { ...n, color_full_card: previousValue } : n
      ));
      toast.error("Fehler beim Setzen des Farbmodus");
    } finally {
      // Release lock after a small delay to prevent rapid re-clicks
      setTimeout(() => setColorModeUpdating(null), 300);
    }
  };

  // Remove decision from note (archive the decision)
  const removeDecisionFromNote = async (note: QuickNote) => {
    if (!note.decision_id || !user?.id) return;
    
    try {
      // Get decision title for archive info
      const { data: decisionData } = await supabase
        .from('task_decisions')
        .select('title')
        .eq('id', note.decision_id)
        .single();
      
      // Archive the decision (using archived_at field)
      await supabase
        .from('task_decisions')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', note.decision_id);
      
      // Remove link from note and store archived info
      const archivedInfo = decisionData ? {
        id: note.decision_id,
        title: decisionData.title,
        archived_at: new Date().toISOString()
      } : null;
      
      await supabase
        .from("quick_notes")
        .update({ 
          decision_id: null,
          decision_archived_info: archivedInfo
        })
        .eq("id", note.id)
        .eq("user_id", user.id);
      
      toast.success("Entscheidungsanfrage zurückgenommen");
      setConfirmRemoveDecision(null);
      loadNotes();
    } catch (error) {
      console.error("Error removing decision:", error);
      toast.error("Fehler beim Zurücknehmen der Entscheidung");
    }
  };

  // Cleanup deleted link - called when linked item is not found
  const cleanupDeletedLink = async (noteId: string, field: 'task_id' | 'decision_id' | 'meeting_id') => {
    if (!user?.id) return;
    
    try {
      await supabase
        .from("quick_notes")
        .update({ [field]: null })
        .eq("id", noteId)
        .eq("user_id", user.id);
      
      loadNotes();
    } catch (error) {
      console.error(`Error cleaning up ${field}:`, error);
    }
  };

  // Drag-and-Drop handler for priority changes
  const handleNoteDragEnd = async (result: DropResult) => {
    if (!result.destination || !user?.id) return;
    
    const sourceLevel = parseInt(result.source.droppableId.replace('level-', ''));
    const destLevel = parseInt(result.destination.droppableId.replace('level-', ''));
    const noteId = result.draggableId;
    const note = notes.find(n => n.id === noteId);
    
    if (!note) return;
    
    // Check ownership
    if (note.user_id !== user.id) {
      toast.error("Nur eigene Notizen können verschoben werden");
      return;
    }
    
    // Same level: inform user about sort order
    if (sourceLevel === destLevel) {
      toast.info("Reihenfolge wird durch Erstelldatum bestimmt");
      return;
    }
    
    // Level change: Update priority_level
    // Optimistic update
    setNotes(prev => prev.map(n => 
      n.id === noteId ? { ...n, priority_level: destLevel } : n
    ));
    
    // Database update
    try {
      const { error } = await supabase
        .from("quick_notes")
        .update({ priority_level: destLevel })
        .eq("id", noteId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error updating priority via drag:", error);
        loadNotes(); // Rollback on error
        toast.error("Fehler beim Verschieben");
      } else {
        toast.success(destLevel > 0 ? `Level ${destLevel} gesetzt` : "Priorität entfernt");
      }
    } catch (error) {
      console.error("Error in drag handler:", error);
      loadNotes();
    }
  };

  // Toggle linked details expansion (not description)
  const toggleDetailsExpand = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedDetails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  const handleSetFollowUp = async (noteId: string, date: Date | null) => {
    if (!user?.id) {
      toast.error("Nicht angemeldet");
      return;
    }

    console.log("Setting follow-up:", { noteId, date, userId: user.id });

    try {
      const { data, error } = await supabase
        .from("quick_notes")
        .update({ follow_up_date: date?.toISOString() || null })
        .eq("id", noteId)
        .eq("user_id", user.id)
        .select();

      console.log("Follow-up result:", { data, error });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("Wiedervorlage konnte nicht gesetzt werden");
        return;
      }

      toast.success(date ? `Wiedervorlage für ${format(date, "dd.MM.yyyy", { locale: de })}` : "Wiedervorlage entfernt");
      loadNotes();
      setDatePickerOpen(false);
      setNoteForDatePicker(null);
    } catch (error) {
      console.error("Error setting follow-up:", error);
      toast.error("Fehler beim Setzen der Wiedervorlage");
    }
  };

  const createTaskFromNote = async (note: QuickNote) => {
    if (!user || !currentTenant) {
      toast.error("Nicht angemeldet");
      return;
    }

    try {
      // Strip HTML tags from content for clean title
      const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').trim();
      const plainContent = stripHtml(note.content);
      const taskTitle = note.title 
        ? stripHtml(note.title) 
        : plainContent.substring(0, 50) + (plainContent.length > 50 ? '...' : '');
      
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          tenant_id: currentTenant.id,
          title: taskTitle,
          description: note.content, // Keep HTML for RichTextDisplay rendering
          category: 'personal',
          priority: 'medium',
          status: 'todo',
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          assigned_to: user.id,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      await supabase
        .from("quick_notes")
        .update({ task_id: task.id })
        .eq("id", note.id);

      toast.success("Aufgabe erstellt");
      loadNotes();
    } catch (error) {
      console.error('Error creating task from note:', error);
      toast.error("Fehler beim Erstellen der Aufgabe");
    }
  };

  const removeTaskFromNote = async (note: QuickNote) => {
    if (!note.task_id || !user?.id) return;
    
    try {
      // First delete the task - handle case where task might already be deleted
      const { error: taskError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', note.task_id);

      // Task might already be deleted - that's ok (PGRST116 = no rows found)
      if (taskError && !taskError.message.includes('0 rows')) {
        console.warn('Task deletion warning:', taskError);
        // Continue anyway as long as it's not a critical error
      }

      // Then remove the link from the note
      const { error: noteError } = await supabase
        .from("quick_notes")
        .update({ task_id: null })
        .eq("id", note.id)
        .eq("user_id", user.id);

      // Only throw if it's a real error
      if (noteError) {
        console.warn('Note update warning:', noteError);
        // Still consider success if the link was effectively removed
      }
      
      toast.success("Aufgabe entfernt");
      setConfirmDeleteTaskNote(null);
      loadNotes();
    } catch (error) {
      console.error('Error removing task from note:', error);
      toast.error("Fehler beim Entfernen der Aufgabe");
    }
  };

  // Handle delete with confirmation for linked items
  const handleDeleteWithConfirmation = (note: QuickNote) => {
    const hasLinks = note.task_id || note.decision_id || note.meeting_id;
    
    if (hasLinks) {
      // Reset checkboxes based on what's linked
      setDeleteLinkedTask(!!note.task_id);
      setDeleteLinkedDecision(!!note.decision_id);
      setDeleteLinkedMeeting(false); // Default: don't remove from meeting
      setConfirmDeleteLinkedNote(note);
    } else {
      // No links - delete directly
      handleDelete(note.id);
    }
  };

  const handleDeleteNoteWithLinks = async () => {
    if (!confirmDeleteLinkedNote || !user?.id) return;
    
    const note = confirmDeleteLinkedNote;
    
    try {
      // 1. Delete linked task if selected
      if (note.task_id && deleteLinkedTask) {
        await supabase.from('tasks').delete().eq('id', note.task_id);
      }
      
      // 2. Delete linked decision if selected  
      if (note.decision_id && deleteLinkedDecision) {
        await supabase.from('task_decisions').delete().eq('id', note.decision_id);
      }
      
      // 3. Remove from meeting if selected (not delete the meeting itself)
      if (note.meeting_id && deleteLinkedMeeting) {
        await supabase
          .from("quick_notes")
          .update({ meeting_id: null, added_to_meeting_at: null })
          .eq("id", note.id)
          .eq("user_id", user.id);
      }
      
      // 4. Move note to trash
      await handleDelete(note.id);
      
      setConfirmDeleteLinkedNote(null);
    } catch (error) {
      console.error("Error deleting note with links:", error);
      toast.error("Fehler beim Löschen");
    }
  };

  const addNoteToMeeting = async (noteId: string, meetingId: string, meetingTitle: string) => {
    if (!user?.id) {
      toast.error("Nicht angemeldet");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('quick_notes')
        .update({
          meeting_id: meetingId,
          added_to_meeting_at: new Date().toISOString(),
          pending_for_jour_fixe: false
        })
        .eq('id', noteId)
        .eq('user_id', user.id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("Notiz konnte nicht zugewiesen werden");
        return;
      }

      toast.success(`Notiz zum Jour Fixe hinzugefügt`);
      setMeetingSelectorOpen(false);
      setNoteForMeeting(null);
      loadNotes();
    } catch (error) {
      console.error('Error adding note to meeting:', error);
      toast.error("Fehler beim Hinzufügen zum Jour Fixe");
    }
  };

  const markForNextJourFixe = async (noteId: string) => {
    if (!user?.id) {
      toast.error("Nicht angemeldet");
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('quick_notes')
        .update({ pending_for_jour_fixe: true })
        .eq('id', noteId)
        .eq('user_id', user.id)
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error("Notiz konnte nicht vorgemerkt werden");
        return;
      }
      
      toast.success("Notiz für nächsten Jour Fixe vorgemerkt");
      loadNotes();
    } catch (error) {
      console.error('Error marking for Jour Fixe:', error);
      toast.error("Fehler beim Vormerken");
    }
  };

  const removeFromJourFixeQueue = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('quick_notes')
        .update({ pending_for_jour_fixe: false })
        .eq('id', noteId);

      if (error) throw error;
      toast.success("Vormerkung entfernt");
      loadNotes();
    } catch (error) {
      console.error('Error removing from Jour Fixe queue:', error);
      toast.error("Fehler beim Entfernen der Vormerkung");
    }
  };

  const removeNoteFromMeeting = async (noteId: string) => {
    if (!user?.id) {
      toast.error("Nicht angemeldet");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('quick_notes')
        .update({
          meeting_id: null,
          added_to_meeting_at: null
        })
        .eq('id', noteId)
        .eq('user_id', user.id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("Notiz konnte nicht entfernt werden");
        return;
      }

      toast.success("Notiz vom Jour Fixe entfernt");
      loadNotes();
    } catch (error) {
      console.error('Error removing note from meeting:', error);
      toast.error("Fehler beim Entfernen");
    }
  };

  const openEditDialog = (note: QuickNote) => {
    setEditingNote(note);
    setEditTitle(note.title || "");
    setEditContent(note.content);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingNote || !user?.id) return;

    try {
      // 1. Save current version to history before updating
      await supabase
        .from("quick_note_versions")
        .insert({
          note_id: editingNote.id,
          title: editingNote.title,
          content: editingNote.content,
          user_id: user.id
        });

      // 2. Update the note - handle both own notes and shared notes with edit permission
      let updateQuery = supabase
        .from("quick_notes")
        .update({ 
          title: editTitle.trim() || null,
          content: editContent.trim()
        })
        .eq("id", editingNote.id);
      
      // For own notes, add user_id filter; for shared notes with edit permission, RLS handles it
      if (editingNote.user_id === user.id) {
        updateQuery = updateQuery.eq("user_id", user.id);
      }
      
      const { data, error } = await updateQuery.select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error("Keine Berechtigung zum Bearbeiten dieser Notiz");
        return;
      }
      
      toast.success("Notiz aktualisiert");
      setEditDialogOpen(false);
      setEditingNote(null);
      loadNotes();
    } catch (error) {
      console.error("Error updating note:", error);
      toast.error("Fehler beim Speichern");
    }
  };

  // Version history state and functions
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [versionHistoryNote, setVersionHistoryNote] = useState<QuickNote | null>(null);
  const [versions, setVersions] = useState<Array<{
    id: string;
    title: string | null;
    content: string;
    created_at: string;
  }>>([]);

  const openVersionHistory = async (note: QuickNote) => {
    const { data, error } = await supabase
      .from("quick_note_versions")
      .select("*")
      .eq("note_id", note.id)
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error loading versions:", error);
      toast.error("Fehler beim Laden der Versionen");
      return;
    }
    
    setVersions(data || []);
    setVersionHistoryNote(note);
    setVersionHistoryOpen(true);
  };

  const restoreVersion = async (version: { title: string | null; content: string }) => {
    if (!versionHistoryNote || !user?.id) return;

    try {
      // Save current state before restoring
      await supabase
        .from("quick_note_versions")
        .insert({
          note_id: versionHistoryNote.id,
          title: versionHistoryNote.title,
          content: versionHistoryNote.content,
          user_id: user.id
        });

      const { error } = await supabase
        .from("quick_notes")
        .update({ 
          title: version.title,
          content: version.content
        })
        .eq("id", versionHistoryNote.id)
        .eq("user_id", user.id);

      if (error) throw error;
      
      toast.success("Version wiederhergestellt");
      setVersionHistoryOpen(false);
      loadNotes();
    } catch (error) {
      console.error("Error restoring version:", error);
      toast.error("Fehler beim Wiederherstellen");
    }
  };

  // Split note into individual notes based on bullets/list items
  const splitNoteIntoBullets = async (note: QuickNote) => {
    if (!user) return;
    
    // HTML list items regex
    const listItemRegex = /<li[^>]*>(.*?)<\/li>/gi;
    // Dash/bullet regex for plain text
    const dashBulletRegex = /^[-•*]\s+(.+)$/gm;
    
    let items: string[] = [];
    
    // Try HTML lists first
    let match;
    while ((match = listItemRegex.exec(note.content)) !== null) {
      const text = match[1].replace(/<[^>]*>/g, '').trim();
      if (text) items.push(text);
    }
    
    // If no HTML lists found, try dash bullets in plain text
    if (items.length === 0) {
      const plainText = note.content.replace(/<[^>]*>/g, '');
      while ((match = dashBulletRegex.exec(plainText)) !== null) {
        if (match[1].trim()) items.push(match[1].trim());
      }
    }
    
    // If still no items, try splitting by line breaks (for paragraphs)
    if (items.length === 0) {
      const plainText = note.content.replace(/<[^>]*>/g, '');
      const lines = plainText.split(/\n+/).map(l => l.trim()).filter(l => l.length > 5);
      if (lines.length > 1) {
        items = lines;
      }
    }
    
    if (items.length <= 1) {
      toast.info("Keine Aufzählungspunkte gefunden", {
        description: "Die Notiz enthält keine Aufzählung oder Liste zum Aufteilen."
      });
      return;
    }
    
    try {
      // Create new notes for each item
      const newNotes = items.map((content) => ({
        user_id: user.id,
        content,
        title: content.substring(0, 30) + (content.length > 30 ? '...' : ''),
        color: note.color,
        priority_level: note.priority_level || 0,
        is_pinned: false,
        is_archived: false,
      }));
      
      const { error } = await supabase
        .from('quick_notes')
        .insert(newNotes);
        
      if (error) throw error;
      
      toast.success(`${items.length} Notizen erstellt`, {
        description: "Die Aufzählungspunkte wurden in separate Notizen aufgeteilt."
      });
      loadNotes();
    } catch (error) {
      console.error('Error splitting note:', error);
      toast.error("Fehler beim Aufteilen der Notiz");
    }
  };

  const getPreviewText = (html: string) => {
    return html.replace(/<[^>]*>/g, '').substring(0, 150);
  };

  const toggleNoteExpand = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  // Simple HTML sanitizer for safe rendering
  const sanitizeHtml = (html: string) => {
    // Allow only basic formatting tags
    const allowedTags = ['b', 'i', 'u', 'strong', 'em', 'br', 'p', 'ul', 'ol', 'li', 'span'];
    const tagPattern = new RegExp(`<(?!\/?(${allowedTags.join('|')})(\\s|>))[^>]*>`, 'gi');
    return html
      .replace(tagPattern, '')
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '');
  };

  const renderNoteCard = (note: QuickNote, showFollowUpBadge = false, dragHandleProps?: any) => {
    const isExpanded = expandedNotes.has(note.id);
    const fullText = note.content.replace(/<[^>]*>/g, '');
    const needsTruncation = fullText.length > 150;
    const hasLinkedItems = note.task_id || note.decision_id || note.meeting_id;
    const hasShared = (note.share_count || 0) > 0 || note.is_shared === true;
    
    // Helper to get preview text with inline "..." - properly decode HTML entities
    const getPreviewText = (content: string, maxLength = 150) => {
      // Create a temporary element to properly decode HTML entities
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      const text = (tempDiv.textContent || tempDiv.innerText || '').trim();
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength).trim() + '...';
    };
    
    return (
      <div
        key={note.id}
        className="p-3 pb-12 rounded-lg border transition-all hover:shadow-sm border-l-4 group relative"
        style={{ 
          borderLeftColor: note.color || "#3b82f6",
          backgroundColor: note.color && note.color_full_card === true
            ? `${note.color}50` // 31% opacity for full card mode - more intense
            : undefined  // Kein Hintergrund wenn nur Rand
        }}
        onClick={() => onNoteClick?.(note)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Title - larger */}
            {note.title && (
              <h4 className="font-semibold text-base break-words line-clamp-2 mb-1">
                {note.title}
              </h4>
            )}
            {/* Description - gray, with INLINE expand arrow after "..." */}
            {isExpanded ? (
              <div>
                <div 
                  className="text-sm text-muted-foreground/70 prose prose-sm max-w-none [&>p]:mb-1 [&>ul]:mb-1 [&>ol]:mb-1"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }}
                />
                {needsTruncation && (
                  <button 
                    className="inline-flex items-center mt-1 text-primary hover:underline"
                    onClick={(e) => toggleNoteExpand(note.id, e)}
                  >
                    <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                    <span className="text-xs ml-0.5">Weniger</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground/70">
                <span>
                  {getPreviewText(note.content, 150)}
                  {needsTruncation && (
                    <button 
                      className="inline-flex items-center text-primary hover:underline align-baseline"
                      onClick={(e) => toggleNoteExpand(note.id, e)}
                    >
                      <ArrowRight className="h-3.5 w-3.5 inline ml-0.5" strokeWidth={2.5} />
                    </button>
                  )}
                </span>
              </div>
            )}
            
          </div>
        
        {/* UNIFIED BOTTOM BAR - Status indicators + ">" / "→ Details" + Quick Actions in one row */}
        {(hasLinkedItems || hasShared || note.user_id === user?.id) && (
          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between gap-2">
            {/* LEFT: Status indicators/badges */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Small squares + ">" - visible when NOT hovering card */}
              <div className="flex items-center gap-1.5 group-hover:hidden">
                {note.task_id && (
                  <div className="w-1.5 h-1.5 bg-blue-500" title="Aufgabe" />
                )}
                {note.decision_id && (
                  <div className="w-1.5 h-1.5 bg-purple-500" title="Entscheidung" />
                )}
                {note.meeting_id && (
                  <div className="w-1.5 h-1.5 bg-emerald-500" title="Jour Fixe" />
                )}
                {hasShared && (
                  <div 
                    className="w-1.5 h-1.5 bg-violet-500" 
                    title={note.is_shared ? `Geteilt von ${note.owner?.display_name || 'Unbekannt'}` : "Geteilt"}
                  />
                )}
              </div>
              
              {/* Full badges - visible on card hover */}
              <div className="hidden group-hover:flex items-center gap-1.5 flex-wrap">
                {note.task_id && (
                  <NoteLinkedBadge type="task" id={note.task_id} label="Aufgabe" />
                )}
                {note.decision_id && (
                  <NoteLinkedBadge type="decision" id={note.decision_id} label="Entscheidung" />
                )}
                {note.meeting_id && (
                  <NoteLinkedBadge 
                    type="meeting" 
                    id={note.meeting_id} 
                    label={note.meetings?.meeting_date 
                      ? `JF: ${format(new Date(note.meetings.meeting_date), "dd.MM.", { locale: de })}`
                      : "Jour Fixe"
                    } 
                  />
                )}
                {/* Shared badge - von mir geteilt */}
                {(note.share_count || 0) > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 text-violet-600 border-violet-300 bg-violet-50 dark:bg-violet-900/30 cursor-help">
                          <Users className="h-3 w-3 mr-0.5" />
                          {note.share_count}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <p className="font-medium">Geteilt mit:</p>
                          {note.shared_with_users && note.shared_with_users.length > 0 ? (
                            note.shared_with_users.map(u => (
                              <p key={u.id} className="text-sm">{u.display_name || 'Unbekannt'}</p>
                            ))
                          ) : (
                            <p className="text-sm">Mit {note.share_count} {note.share_count === 1 ? 'Person' : 'Personen'} geteilt</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {/* Shared badge - mit mir geteilt */}
                {note.is_shared && note.owner && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 cursor-help">
                          <Share2 className="h-3 w-3 mr-0.5" />
                          {note.owner.display_name?.split(' ')[0] || 'Geteilt'}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        Geteilt von {note.owner.display_name || 'Unbekannt'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
            
            {/* RIGHT: "→" (default) / "↓/↑ Details | Icons" (hover) */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Simple "→" - only visible on hover when linked items exist */}
              {hasLinkedItems && (
                <span className="text-sm text-muted-foreground hidden group-hover:inline group-hover:opacity-0">→</span>
              )}
              
              {/* "↓/↑ Details" + separator + icons - visible on hover */}
              <div className={cn(
                "flex items-center gap-1",
                "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              )}>
                {/* "↓/↑ Details" button only if linked items - opens LINKED DETAILS, not description */}
                {hasLinkedItems && (
                  <>
                    <button 
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center"
                      onClick={(e) => toggleDetailsExpand(note.id, e)}
                    >
                      {expandedDetails.has(note.id) ? (
                        <ChevronUp className="h-3 w-3" strokeWidth={2.5} />
                      ) : (
                        <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
                      )}
                      <span className="ml-0.5">Details</span>
                    </button>
                    {note.user_id === user?.id && (
                      <div className="h-4 w-px bg-border mx-1" />
                    )}
                  </>
                )}
                
                {/* Quick action icons - only for own notes */}
                {note.user_id === user?.id && (
                  <TooltipProvider>
                    <div className="flex items-center gap-1">
                      {/* Edit */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-muted/80 rounded-full"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              openEditDialog(note); 
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Bearbeiten</TooltipContent>
                      </Tooltip>
                      
                      {/* Task */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-6 w-6 hover:bg-muted/80 rounded-full", note.task_id && "text-blue-600")}
                            onClick={(e) => {
                              e.stopPropagation();
                              note.task_id ? setConfirmDeleteTaskNote(note) : createTaskFromNote(note);
                            }}
                          >
                            <CheckSquare className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">{note.task_id ? "Aufgabe entfernen" : "Als Aufgabe"}</TooltipContent>
                      </Tooltip>
                      
                      {/* Decision - toggle behavior */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-6 w-6 hover:bg-muted/80 rounded-full", note.decision_id && "text-purple-600")}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (note.decision_id) {
                                setConfirmRemoveDecision(note);
                              } else {
                                setNoteForDecision(note);
                                setDecisionCreatorOpen(true);
                              }
                            }}
                          >
                            <Vote className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">{note.decision_id ? "Entscheidung zurücknehmen" : "Als Entscheidung"}</TooltipContent>
                      </Tooltip>
                      
                      {/* Follow-up */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-6 w-6 hover:bg-muted/80 rounded-full", note.follow_up_date && "text-amber-600")}
                            onClick={(e) => {
                              e.stopPropagation();
                              setNoteForDatePicker(note);
                              setDatePickerOpen(true);
                            }}
                          >
                            <Clock className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Wiedervorlage</TooltipContent>
                      </Tooltip>
                      
                      {/* Jour Fixe */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-6 w-6 hover:bg-muted/80 rounded-full", note.meeting_id && "text-emerald-600")}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (note.meeting_id) {
                                removeNoteFromMeeting(note.id);
                              } else {
                                setNoteForMeeting(note);
                                setMeetingSelectorOpen(true);
                              }
                            }}
                          >
                            <CalendarIcon className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">{note.meeting_id ? "Von Jour Fixe entfernen" : "Auf Jour Fixe"}</TooltipContent>
                      </Tooltip>
                      
                      {/* Archive */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-muted/80 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchive(note.id);
                            }}
                          >
                            <Archive className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Archivieren</TooltipContent>
                      </Tooltip>
                      
                      {/* Drag Handle - LAST */}
                      {dragHandleProps && (
                        <div {...dragHandleProps} className="cursor-grab p-1 hover:bg-muted/80 rounded-full">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>
        )}
        
          {/* Right column: Only menu icon visible, rest on hover */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-0.5">
              {/* Three-dot menu - always visible */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {/* PRIMÄRE AKTIONEN */}
                  {(note.user_id === user?.id || note.can_edit) && (
                    <DropdownMenuItem onClick={() => openEditDialog(note)}>
                      <Pencil className="h-3 w-3 mr-2" />
                      Bearbeiten
                    </DropdownMenuItem>
                  )}
                  
                  {/* Task - kontextabhängig */}
                  {note.task_id ? (
                    <DropdownMenuItem onClick={() => setConfirmDeleteTaskNote(note)} className="text-blue-600">
                      <CheckSquare className="h-3 w-3 mr-2" />
                      Aufgabe entfernen
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => createTaskFromNote(note)}>
                      <CheckSquare className="h-3 w-3 mr-2" />
                      Als Aufgabe
                    </DropdownMenuItem>
                  )}
                  
                  {/* Decision - kontextabhängig */}
                  {note.decision_id ? (
                    <DropdownMenuItem disabled className="text-purple-600">
                      <Vote className="h-3 w-3 mr-2" />
                      Entscheidung aktiv
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => {
                      setNoteForDecision(note);
                      setDecisionCreatorOpen(true);
                    }}>
                      <Vote className="h-3 w-3 mr-2" />
                      Als Entscheidung
                    </DropdownMenuItem>
                  )}
                  
                  {/* Meeting - kontextabhängig */}
                  {note.meeting_id ? (
                    <DropdownMenuItem onClick={() => removeNoteFromMeeting(note.id)} className="text-emerald-600">
                      <CalendarIcon className="h-3 w-3 mr-2" />
                      Von Jour Fixe entfernen
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => {
                      setNoteForMeeting(note);
                      setMeetingSelectorOpen(true);
                    }}>
                      <CalendarIcon className="h-3 w-3 mr-2" />
                      Auf Jour Fixe setzen
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />
                  
                  {/* SEKUNDÄRE AKTIONEN */}
                  {/* Priority Submenu */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Star className="h-3 w-3 mr-2" />
                      Priorität
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => handleSetPriority(note.id, 3)}>
                          <span className="text-amber-500 mr-2">★★★</span> Level 3
                          {note.priority_level === 3 && <span className="ml-auto text-xs">✓</span>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSetPriority(note.id, 2)}>
                          <span className="text-amber-500 mr-2">★★</span> Level 2
                          {note.priority_level === 2 && <span className="ml-auto text-xs">✓</span>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSetPriority(note.id, 1)}>
                          <span className="text-amber-500 mr-2">★</span> Level 1
                          {note.priority_level === 1 && <span className="ml-auto text-xs">✓</span>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleSetPriority(note.id, 0)}>
                          Keine Priorität
                          {(!note.priority_level || note.priority_level === 0) && <span className="ml-auto text-xs">✓</span>}
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  {/* Follow-up Submenu */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Clock className="h-3 w-3 mr-2" />
                      Wiedervorlage
                      {note.follow_up_date && <span className="ml-auto text-xs text-amber-600">●</span>}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => handleSetFollowUp(note.id, addDays(new Date(), 7))}>
                          In 7 Tagen
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSetFollowUp(note.id, addDays(new Date(), 14))}>
                          In 14 Tagen
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSetFollowUp(note.id, addDays(new Date(), 30))}>
                          In 30 Tagen
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => {
                          setNoteForDatePicker(note);
                          setDatePickerOpen(true);
                        }}>
                          <CalendarIcon className="h-3 w-3 mr-2" />
                          Datum wählen...
                        </DropdownMenuItem>
                        {note.follow_up_date && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleSetFollowUp(note.id, null)} className="text-destructive">
                              Wiedervorlage entfernen
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  {/* Color Submenu - also for shared notes with edit permission */}
                  {(note.user_id === user?.id || note.can_edit === true) && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Palette className="h-3 w-3 mr-2" />
                        Farbe
                        {note.color && (
                          <span 
                            className="ml-auto w-3 h-3 rounded-full border"
                            style={{ backgroundColor: note.color }}
                          />
                        )}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <div className="flex flex-wrap gap-1.5 p-2 max-w-[140px]">
                            {noteColors.map((color) => (
                              <button
                                key={color.value || 'default'}
                                onClick={() => handleSetColor(note.id, color.value)}
                                className={cn(
                                  "w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
                                  note.color === color.value ? "border-primary ring-2 ring-primary/30" : "border-transparent",
                                  !color.value && "bg-background border-border"
                                )}
                                style={color.value ? { backgroundColor: color.value } : undefined}
                                title={color.label}
                              />
                            ))}
                          </div>
                          {note.color && (
                            <>
                              <DropdownMenuSeparator />
                              <div 
                                className="px-2 py-1.5" 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <label 
                                  className="flex items-center gap-2 text-xs cursor-pointer select-none"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onPointerDown={(e) => e.stopPropagation()}
                                >
                                  <Checkbox 
                                    checked={note.color_full_card === true}
                                    disabled={colorModeUpdating === note.id}
                                    onCheckedChange={(checked) => {
                                      if (colorModeUpdating !== note.id) {
                                        handleSetColorMode(note.id, checked === true);
                                      }
                                    }}
                                  />
                                  {colorModeUpdating === note.id ? "Wird gespeichert..." : "Ganze Card einfärben"}
                                </label>
                              </div>
                            </>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  )}
                  
                  {/* Share option - only for own notes */}
                  {note.user_id === user?.id && (
                    <DropdownMenuItem onClick={() => {
                      setNoteForShare(note);
                      setShareDialogOpen(true);
                    }}>
                      <Share2 className="h-3 w-3 mr-2" />
                      Freigeben
                      {(note.share_count || 0) > 0 && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {note.share_count}
                        </span>
                      )}
                    </DropdownMenuItem>
                  )}
                  
                  {/* Split into individual notes - only for own notes */}
                  {note.user_id === user?.id && (
                    <DropdownMenuItem onClick={() => splitNoteIntoBullets(note)}>
                      <ListTree className="h-3 w-3 mr-2" />
                      In Einzelnotizen aufteilen
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  {/* TERTIÄRE AKTIONEN */}
                  <DropdownMenuItem onClick={() => handleTogglePin(note)}>
                    <Pin className={cn("h-3 w-3 mr-2", note.is_pinned && "text-amber-500")} />
                    {note.is_pinned ? 'Loslösen' : 'Anpinnen'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleArchive(note.id)}>
                    <Archive className="h-3 w-3 mr-2" />
                    Archivieren
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openVersionHistory(note)}>
                    <History className="h-3 w-3 mr-2" />
                    Versionshistorie
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* LÖSCHEN */}
                  <DropdownMenuItem 
                    onClick={() => handleDeleteWithConfirmation(note)} 
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Löschen
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* ERSTELLUNGSDATUM - am Ende */}
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Erstellt: {format(new Date(note.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Metadata row: only pending JF and follow-up badges (shared moved to indicators) */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {/* Pending for Jour Fixe indicator */}
              {note.pending_for_jour_fixe && !note.meeting_id && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs px-1 py-0 h-4 text-amber-600 cursor-help">
                        <Hourglass className="h-3 w-3 mr-0.5" />
                        JF
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      Wartet auf nächsten Jour Fixe
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {showFollowUpBadge && note.follow_up_date && (
                <Badge 
                  variant={isPast(new Date(note.follow_up_date)) && !isToday(new Date(note.follow_up_date)) 
                    ? "destructive" 
                    : "secondary"
                  } 
                  className="text-xs px-1 py-0 h-4"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {isToday(new Date(note.follow_up_date)) 
                    ? "Heute"
                    : format(new Date(note.follow_up_date), "dd.MM.", { locale: de })
                  }
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        {/* Pinned Indicator - golden corner top right */}
        {note.is_pinned && (
          <div 
            className="absolute top-0 right-0 w-0 h-0 border-t-[16px] border-l-[16px] border-t-amber-400 border-l-transparent rounded-tr-lg"
            title="Angepinnt"
          />
        )}
        
        {/* Collapsible Details for linked items - controlled by expandedDetails state */}
        {hasLinkedItems && (
          <NoteLinkedDetails 
            taskId={note.task_id} 
            decisionId={note.decision_id} 
            meetingId={note.meeting_id}
            isExpanded={expandedDetails.has(note.id)}
          />
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <StickyNote className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p>Noch keine Notizen</p>
        <p className="text-sm">Nutze Quick Capture zum Starten</p>
      </div>
    );
  }

  return (
    <>
      {/* Search Bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Notizen durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-8 text-sm"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        {searchQuery && (
          <p className="text-xs text-muted-foreground mt-1.5">
            {filteredNotes.length} von {notes.length} Notizen gefunden
          </p>
        )}
      </div>
      
      <ScrollArea style={{ height: maxHeight }}>
        <DragDropContext onDragEnd={handleNoteDragEnd}>
          <div className="space-y-4 p-4 pt-0">
            {/* Priority Groups */}
            {groups.map((group, index) => (
              <div key={group.level}>
                {index > 0 && <Separator className="my-3" />}
                
                <div className="flex items-center gap-2 mb-2">
                  {group.level > 0 && (
                    <span className="text-amber-500 text-sm">
                      {'★'.repeat(group.level)}
                    </span>
                  )}
                  <span className="text-xs font-medium text-muted-foreground">
                    {group.label}
                  </span>
                </div>
                
                <Droppable droppableId={`level-${group.level}`}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "space-y-2 min-h-[40px] rounded-lg transition-colors",
                        snapshot.isDraggingOver && "bg-primary/5 ring-1 ring-primary/20"
                      )}
                    >
                      {group.notes.map((note, noteIndex) => (
                        <Draggable 
                          key={note.id} 
                          draggableId={note.id} 
                          index={noteIndex}
                          isDragDisabled={note.user_id !== user?.id}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                snapshot.isDragging && "opacity-90"
                              )}
                            >
                              {renderNoteCard(note, false, provided.dragHandleProps)}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}

            {/* Follow-up Section (collapsible) */}
            {(followUpNotes.length > 0 || notes.some(n => n.follow_up_date)) && (
              <>
                <Separator className="my-3" />
                <Collapsible open={followUpExpanded} onOpenChange={setFollowUpExpanded}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform",
                        !followUpExpanded && "-rotate-90"
                      )} />
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Fällige Wiedervorlagen</span>
                      {followUpNotes.length > 0 && (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0">
                          {followUpNotes.length}
                        </Badge>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="space-y-2 mt-2">
                      {followUpNotes.length > 0 ? (
                        followUpNotes.map(note => renderNoteCard(note, true))
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Keine fälligen Wiedervorlagen
                        </p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}

            {/* Scheduled Follow-ups Section (future dates - hidden from main list) */}
            {scheduledFollowUps.length > 0 && (
              <>
                <Separator className="my-3" />
                <Collapsible open={scheduledFollowUpsExpanded} onOpenChange={setScheduledFollowUpsExpanded}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform",
                        !scheduledFollowUpsExpanded && "-rotate-90"
                      )} />
                      <Hourglass className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Geplant (bis zum Datum ausgeblendet)</span>
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        {scheduledFollowUps.length}
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="space-y-2 mt-2">
                      {scheduledFollowUps.map(note => renderNoteCard(note, true))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
          </div>
        </DragDropContext>
      </ScrollArea>

      {/* Meeting Selector Dialog */}
      {noteForMeeting && (
        <MeetingNoteSelector
          open={meetingSelectorOpen}
          onOpenChange={setMeetingSelectorOpen}
          onSelect={(meetingId, meetingTitle) => addNoteToMeeting(noteForMeeting.id, meetingId, meetingTitle)}
          onMarkForNextJourFixe={() => markForNextJourFixe(noteForMeeting.id)}
        />
      )}

      {/* Date Picker Dialog */}
      <Dialog open={datePickerOpen} onOpenChange={setDatePickerOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Wiedervorlage-Datum wählen</DialogTitle>
            <DialogDescription>
              Wählen Sie ein Datum für die Wiedervorlage.
            </DialogDescription>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={noteForDatePicker?.follow_up_date ? new Date(noteForDatePicker.follow_up_date) : undefined}
            onSelect={(date) => {
              if (date && noteForDatePicker) {
                handleSetFollowUp(noteForDatePicker.id, date);
              }
            }}
            disabled={(date) => date < startOfDay(new Date())}
            locale={de}
            className="rounded-md border"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notiz bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie Titel und Inhalt der Notiz.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="Titel (optional)"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <SimpleRichTextEditor
              key={editDialogOpen ? editingNote?.id : 'closed'}
              initialContent={editContent}
              onChange={setEditContent}
              placeholder="Inhalt"
              minHeight="150px"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editContent.trim()}>
              Speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      {noteForShare && (
        <NoteShareDialog
          open={shareDialogOpen}
          onOpenChange={(open) => {
            setShareDialogOpen(open);
            if (!open) {
              setNoteForShare(null);
              loadNotes(); // Refresh to update share counts
            }
          }}
          noteId={noteForShare.id}
          noteTitle={noteForShare.title || noteForShare.content.substring(0, 50)}
        />
      )}

      {/* Global Share Dialog */}
      <GlobalNoteShareDialog
        open={globalShareDialogOpen}
        onOpenChange={setGlobalShareDialogOpen}
      />

      {/* Decision Creator Dialog */}
      {noteForDecision && (
        <NoteDecisionCreator
          note={noteForDecision}
          open={decisionCreatorOpen}
          onOpenChange={(open) => {
            setDecisionCreatorOpen(open);
            if (!open) setNoteForDecision(null);
          }}
          onDecisionCreated={() => {
            loadNotes();
            setDecisionCreatorOpen(false);
            setNoteForDecision(null);
          }}
        />
      )}

      {/* Version History Dialog */}
      <Dialog open={versionHistoryOpen} onOpenChange={setVersionHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Versionshistorie</DialogTitle>
            <DialogDescription>
              Frühere Versionen dieser Notiz
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[400px]">
            {versions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Keine früheren Versionen vorhanden
              </p>
            ) : (
              <div className="space-y-3 pr-4">
                {versions.map((version, index) => (
                  <div key={version.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <Badge variant="secondary">
                        Version {versions.length - index}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(version.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                      </span>
                    </div>
                    {version.title && (
                      <p className="font-medium text-sm mb-1">{version.title}</p>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {version.content.replace(/<[^>]*>/g, '')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => restoreVersion(version)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Wiederherstellen
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Task Dialog */}
      <AlertDialog 
        open={!!confirmDeleteTaskNote} 
        onOpenChange={(open) => !open && setConfirmDeleteTaskNote(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aufgabe entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die verknüpfte Aufgabe wird unwiderruflich gelöscht. Die Notiz selbst bleibt erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (confirmDeleteTaskNote) removeTaskFromNote(confirmDeleteTaskNote);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Aufgabe löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Remove Decision Dialog */}
      <AlertDialog 
        open={!!confirmRemoveDecision} 
        onOpenChange={(open) => !open && setConfirmRemoveDecision(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entscheidungsanfrage zurücknehmen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Entscheidungsanfrage wird archiviert und von dieser Notiz entfernt. 
              Bisherige Antworten bleiben im Archiv erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (confirmRemoveDecision) removeDecisionFromNote(confirmRemoveDecision);
              }}
            >
              Zurücknehmen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete Note with Linked Items Dialog */}
      <AlertDialog 
        open={!!confirmDeleteLinkedNote} 
        onOpenChange={(open) => !open && setConfirmDeleteLinkedNote(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notiz mit Verknüpfungen löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Notiz hat verknüpfte Elemente. Was soll mit ihnen geschehen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-3 py-4">
            {confirmDeleteLinkedNote?.task_id && (
              <div className="flex items-center gap-3">
                <Checkbox 
                  id="delete-task" 
                  checked={deleteLinkedTask} 
                  onCheckedChange={(checked) => setDeleteLinkedTask(!!checked)} 
                />
                <label htmlFor="delete-task" className="text-sm flex items-center gap-2 cursor-pointer">
                  <CheckSquare className="h-4 w-4 text-blue-600" />
                  Verknüpfte Aufgabe auch löschen
                </label>
              </div>
            )}
            
            {confirmDeleteLinkedNote?.decision_id && (
              <div className="flex items-center gap-3">
                <Checkbox 
                  id="delete-decision" 
                  checked={deleteLinkedDecision} 
                  onCheckedChange={(checked) => setDeleteLinkedDecision(!!checked)} 
                />
                <label htmlFor="delete-decision" className="text-sm flex items-center gap-2 cursor-pointer">
                  <Vote className="h-4 w-4 text-purple-600" />
                  Verknüpfte Entscheidung auch löschen
                </label>
              </div>
            )}
            
            {confirmDeleteLinkedNote?.meeting_id && (
              <div className="flex items-center gap-3">
                <Checkbox 
                  id="delete-meeting" 
                  checked={deleteLinkedMeeting} 
                  onCheckedChange={(checked) => setDeleteLinkedMeeting(!!checked)} 
                />
                <label htmlFor="delete-meeting" className="text-sm flex items-center gap-2 cursor-pointer">
                  <CalendarIcon className="h-4 w-4 text-emerald-600" />
                  Vom Jour Fixe entfernen
                </label>
              </div>
            )}
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteNoteWithLinks}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
