import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Pin, Trash2, StickyNote, MoreHorizontal, CheckSquare, Vote, 
  Calendar as CalendarIcon, Archive, Edit, ChevronDown, Clock,
  Star, ArrowUp, ArrowDown, RotateCcw, Share2, Users, Globe, Hourglass
} from "lucide-react";
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

export interface QuickNote {
  id: string;
  title: string | null;
  content: string;
  color: string | null;
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

  const loadNotes = useCallback(async () => {
    if (!user) return;
    
    try {
      // Load all initial data in parallel for better performance
      const [ownNotesResult, individualSharesResult, globalSharesResult] = await Promise.all([
        supabase
          .from("quick_notes")
          .select(`
            id, title, content, color, is_pinned, created_at, updated_at, user_id,
            is_archived, task_id, meeting_id, decision_id, priority_level, follow_up_date, pending_for_jour_fixe,
            meetings!meeting_id(title, meeting_date)
          `)
          .eq("user_id", user.id)
          .eq("is_archived", false)
          .is("deleted_at", null)
          .order("is_pinned", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("quick_note_shares")
          .select("note_id")
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
            id, title, content, color, is_pinned, created_at, updated_at, user_id,
            is_archived, task_id, meeting_id, priority_level, follow_up_date, pending_for_jour_fixe,
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

          sharedNotes = individuallySharedData.map(note => ({
            ...note,
            is_shared: true,
            owner: profiles?.find(p => p.user_id === note.user_id) || null
          })) as QuickNote[];
        }
      }

      // Load globally shared notes
      if (globalShareUserIds.length > 0) {
        const { data: globallySharedData } = await supabase
          .from("quick_notes")
          .select(`
            id, title, content, color, is_pinned, created_at, updated_at, user_id,
            is_archived, task_id, meeting_id, priority_level, follow_up_date, pending_for_jour_fixe,
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

  const { groups, followUpNotes, scheduledFollowUps } = groupNotesByPriority(notes);

  // Action handlers
  const handleTogglePin = async (note: QuickNote) => {
    try {
      const { error } = await supabase
        .from("quick_notes")
        .update({ is_pinned: !note.is_pinned })
        .eq("id", note.id);

      if (error) throw error;
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
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          tenant_id: currentTenant.id,
          title: note.title || note.content.substring(0, 50) + (note.content.length > 50 ? '...' : ''),
          description: note.content,
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
      loadNotes();
    } catch (error) {
      console.error('Error removing task from note:', error);
      toast.error("Fehler beim Entfernen der Aufgabe");
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
    if (!editingNote) return;

    try {
      const { error } = await supabase
        .from("quick_notes")
        .update({ 
          title: editTitle.trim() || null,
          content: editContent.trim()
        })
        .eq("id", editingNote.id);

      if (error) throw error;
      toast.success("Notiz aktualisiert");
      setEditDialogOpen(false);
      setEditingNote(null);
      loadNotes();
    } catch (error) {
      console.error("Error updating note:", error);
      toast.error("Fehler beim Speichern");
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

  const renderNoteCard = (note: QuickNote, showFollowUpBadge = false) => {
    const isExpanded = expandedNotes.has(note.id);
    const fullText = note.content.replace(/<[^>]*>/g, '');
    const needsTruncation = fullText.length > 150;
    
    return (
      <div
        key={note.id}
        className="p-3 rounded-lg border transition-colors hover:shadow-sm bg-card border-l-4 group relative"
        style={{ borderLeftColor: note.color || "#3b82f6" }}
        onClick={() => onNoteClick?.(note)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {note.title && (
              <h4 className="font-semibold text-sm truncate mb-1">
                {note.title}
              </h4>
            )}
            {isExpanded ? (
              <div 
                className="text-sm text-muted-foreground prose prose-sm max-w-none [&>p]:mb-1 [&>ul]:mb-1 [&>ol]:mb-1"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }}
              />
            ) : (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {getPreviewText(note.content)}
              </p>
            )}
            {needsTruncation && (
              <button 
                className="text-xs text-primary hover:underline mt-1 font-medium"
                onClick={(e) => toggleNoteExpand(note.id, e)}
              >
                {isExpanded ? "Weniger anzeigen" : "...mehr anzeigen"}
              </button>
            )}
          </div>
        
        {/* Right column: Icons on top, metadata below */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {/* Quick Action Icons - always visible */}
          <div className="flex items-center gap-0.5">
            {/* Als Aufgabe - immer sichtbar, unterschiedliches Styling wenn verknüpft */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-6 w-6",
                      note.task_id 
                        ? "text-blue-500" 
                        : "text-muted-foreground hover:text-blue-500"
                    )}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (note.task_id) {
                        // Show confirmation to remove task
                        if (window.confirm("Möchten Sie die verknüpfte Aufgabe wirklich löschen?")) {
                          removeTaskFromNote(note);
                        }
                      } else {
                        createTaskFromNote(note); 
                      }
                    }}
                  >
                    <CheckSquare className={cn("h-3.5 w-3.5", note.task_id && "fill-blue-500/20")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {note.task_id ? "Aufgabe entfernen" : "Als Aufgabe"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Als Entscheidung */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-purple-500"
                    onClick={(e) => { e.stopPropagation(); toast.info("Entscheidung erstellen", { description: "Funktion in Entwicklung" }); }}
                  >
                    <Vote className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Als Entscheidung</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Jour Fixe */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-6 w-6",
                      note.meeting_id 
                        ? "text-emerald-500" 
                        : "text-muted-foreground hover:text-emerald-500"
                    )}
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
                    <CalendarIcon className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {note.meeting_id ? "Von Jour Fixe entfernen" : "Auf Jour Fixe setzen"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Wiedervorlage */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-6 w-6",
                      note.follow_up_date 
                        ? "text-orange-500" 
                        : "text-muted-foreground hover:text-orange-500"
                    )}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (note.follow_up_date) {
                        handleSetFollowUp(note.id, null);
                      } else {
                        handleSetFollowUp(note.id, addDays(new Date(), 14));
                      }
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {note.follow_up_date 
                    ? `Wiedervorlage: ${format(new Date(note.follow_up_date), "dd.MM.yyyy", { locale: de })}` 
                    : "Wiedervorlage (+14 Tage)"
                  }
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
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
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => openEditDialog(note)}>
                  <Edit className="h-3 w-3 mr-2" />
                  Bearbeiten
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                
                {/* Priority Submenu */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Star className="h-3 w-3 mr-2" />
                    Priorität
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => handleSetPriority(note.id, 1)}>
                        <span className="text-amber-500 mr-2">★</span>
                        Level 1
                        {note.priority_level === 1 && <span className="ml-auto text-xs">✓</span>}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSetPriority(note.id, 2)}>
                        <span className="text-amber-500 mr-2">★★</span>
                        Level 2
                        {note.priority_level === 2 && <span className="ml-auto text-xs">✓</span>}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSetPriority(note.id, 3)}>
                        <span className="text-amber-500 mr-2">★★★</span>
                        Level 3
                        {note.priority_level === 3 && <span className="ml-auto text-xs">✓</span>}
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
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => handleSetFollowUp(note.id, addDays(new Date(), 14))}>
                        In 14 Tagen
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSetFollowUp(note.id, addDays(new Date(), 7))}>
                        In 7 Tagen
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

                <DropdownMenuSeparator />
                
                {!note.task_id && (
                  <DropdownMenuItem onClick={() => createTaskFromNote(note)}>
                    <CheckSquare className="h-3 w-3 mr-2" />
                    Als Aufgabe
                  </DropdownMenuItem>
                )}
                {!note.decision_id ? (
                  <DropdownMenuItem onClick={() => {
                    setNoteForDecision(note);
                    setDecisionCreatorOpen(true);
                  }}>
                    <Vote className="h-3 w-3 mr-2" />
                    Als Entscheidung
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled className="text-purple-600">
                    <Vote className="h-3 w-3 mr-2" />
                    Entscheidung aktiv
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuSeparator />
                
                {!note.meeting_id ? (
                  <DropdownMenuItem onClick={() => {
                    setNoteForMeeting(note);
                    setMeetingSelectorOpen(true);
                  }}>
                    <CalendarIcon className="h-3 w-3 mr-2" />
                    Auf Jour Fixe setzen
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => removeNoteFromMeeting(note.id)} className="text-amber-600">
                    <CalendarIcon className="h-3 w-3 mr-2" />
                    Von Jour Fixe entfernen
                  </DropdownMenuItem>
                )}
                
                {/* Share option - only for own notes */}
                {note.user_id === user?.id && (
                  <>
                    <DropdownMenuSeparator />
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
                  </>
                )}
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => handleTogglePin(note)}>
                  <Pin className={cn("h-3 w-3 mr-2", note.is_pinned && "text-amber-500")} />
                  {note.is_pinned ? 'Loslösen' : 'Anpinnen'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleArchive(note.id)}>
                  <Archive className="h-3 w-3 mr-2" />
                  Archivieren
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  onClick={() => handleDelete(note.id)} 
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Metadata row below icons */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {/* Date as icon with tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Clock className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{format(new Date(note.created_at), "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {note.is_pinned && (
              <Pin className="h-3 w-3 text-amber-500" />
            )}
            {note.task_id && (
              <Badge variant="outline" className="text-xs px-1 py-0 h-4 text-blue-600">
                Aufgabe
              </Badge>
            )}
            {note.meeting_id && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs px-1 py-0 h-4 text-emerald-600 cursor-help">
                      {note.meetings?.meeting_date 
                        ? `JF: ${format(new Date(note.meetings.meeting_date), "dd.MM.", { locale: de })}`
                        : "Nächster JF ⏳"
                      }
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {note.meetings?.meeting_date 
                      ? `${note.meetings.title} am ${format(new Date(note.meetings.meeting_date), "dd.MM.yyyy", { locale: de })}`
                      : "Wird dem nächsten geplanten Jour Fixe zugeordnet"
                    }
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {/* Shared indicator */}
            {(note.share_count || 0) > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs px-1 py-0 h-4 text-violet-600 cursor-help">
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
            {/* Shared from others indicator */}
            {note.is_shared && note.owner && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-xs px-1 py-0 h-4 cursor-help">
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
      <ScrollArea style={{ height: maxHeight }}>
        <div className="space-y-4 p-4">
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
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {group.notes.length}
                </Badge>
              </div>
              
              <div className="space-y-2">
                {group.notes.map(note => renderNoteCard(note))}
              </div>
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
            <Textarea
              placeholder="Inhalt"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[150px]"
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
    </>
  );
}
