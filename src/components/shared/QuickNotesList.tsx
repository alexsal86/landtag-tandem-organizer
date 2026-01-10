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
  Star, ArrowUp, ArrowDown, RotateCcw, Share2, Users, Globe
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, addDays, isToday, isPast, isBefore, startOfDay } from "date-fns";
import { de } from "date-fns/locale";
import { MeetingNoteSelector } from "@/components/widgets/MeetingNoteSelector";
import { NoteShareDialog } from "@/components/shared/NoteShareDialog";
import { GlobalNoteShareDialog } from "@/components/shared/GlobalNoteShareDialog";
import { NotesArchive } from "@/components/shared/NotesArchive";

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
  priority_level?: number;
  follow_up_date?: string;
  is_archived?: boolean;
  user_id?: string;
  is_shared?: boolean;
  share_count?: number;
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
  const [archiveRefreshTrigger, setArchiveRefreshTrigger] = useState(0);

  const loadNotes = useCallback(async () => {
    if (!user) return;
    
    try {
      // Load own notes (excluding soft-deleted)
      const { data: ownNotes, error: ownError } = await supabase
        .from("quick_notes")
        .select(`
          id, title, content, color, is_pinned, created_at, updated_at, user_id,
          is_archived, task_id, meeting_id, priority_level, follow_up_date,
          meetings!meeting_id(title, meeting_date)
        `)
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .is("deleted_at", null)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (ownError) throw ownError;

      // Load shares count for own notes
      const noteIds = (ownNotes || []).map(n => n.id);
      let shareCounts: Record<string, number> = {};
      
      if (noteIds.length > 0) {
        const { data: sharesData } = await supabase
          .from("quick_note_shares")
          .select("note_id")
          .in("note_id", noteIds);
        
        if (sharesData) {
          sharesData.forEach(s => {
            shareCounts[s.note_id] = (shareCounts[s.note_id] || 0) + 1;
          });
        }
      }

      // Load shared notes (notes shared with me)
      const { data: sharedNoteIds } = await supabase
        .from("quick_note_shares")
        .select("note_id")
        .eq("shared_with_user_id", user.id);

      let sharedNotes: QuickNote[] = [];
      if (sharedNoteIds && sharedNoteIds.length > 0) {
        const ids = sharedNoteIds.map(s => s.note_id);
        const { data: sharedData } = await supabase
          .from("quick_notes")
          .select(`
            id, title, content, color, is_pinned, created_at, updated_at, user_id,
            is_archived, task_id, meeting_id, priority_level, follow_up_date,
            meetings!meeting_id(title, meeting_date)
          `)
        .in("id", ids)
        .eq("is_archived", false)
        .is("deleted_at", null);

        if (sharedData && sharedData.length > 0) {
          // Load owner profiles
          const ownerIds = [...new Set(sharedData.map(n => n.user_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, display_name, avatar_url")
            .in("user_id", ownerIds);

          sharedNotes = sharedData.map(note => ({
            ...note,
            is_shared: true,
            owner: profiles?.find(p => p.user_id === note.user_id) || null
          })) as QuickNote[];
        }
      }

      // Combine own notes with share counts and shared notes
      const ownWithCounts = (ownNotes || []).map(note => ({
        ...note,
        share_count: shareCounts[note.id] || 0
      })) as QuickNote[];

      setNotes([...ownWithCounts, ...sharedNotes]);
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
    
    // Follow-up notes (due today or earlier)
    const followUpNotes = allNotes.filter(n => 
      n.follow_up_date && isBefore(startOfDay(new Date(n.follow_up_date)), addDays(now, 1))
    ).sort((a, b) => 
      new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime()
    );
    
    // Remaining notes (no follow-up or future follow-up)
    const remaining = allNotes.filter(n => 
      !n.follow_up_date || !isBefore(startOfDay(new Date(n.follow_up_date)), addDays(now, 1))
    );
    
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
    
    return { groups, followUpNotes };
  }, []);

  const { groups, followUpNotes } = groupNotesByPriority(notes);

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
    try {
      const permanentDeleteAt = addDays(new Date(), 30);
      const { error } = await supabase
        .from("quick_notes")
        .update({ 
          deleted_at: new Date().toISOString(),
          permanent_delete_at: permanentDeleteAt.toISOString()
        })
        .eq("id", noteId);

      if (error) throw error;
      toast.success("Notiz in Papierkorb verschoben (wird nach 30 Tagen gelöscht)");
      loadNotes();
      setArchiveRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Fehler beim Löschen");
    }
  };

  const handleArchive = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("quick_notes")
        .update({ 
          is_archived: true,
          archived_at: new Date().toISOString()
        })
        .eq("id", noteId);

      if (error) throw error;
      toast.success("Notiz archiviert");
      loadNotes();
    } catch (error) {
      console.error("Error archiving note:", error);
      toast.error("Fehler beim Archivieren");
    }
  };

  const handleSetPriority = async (noteId: string, level: number) => {
    try {
      const { error } = await supabase
        .from("quick_notes")
        .update({ priority_level: level })
        .eq("id", noteId);

      if (error) throw error;
      toast.success(level > 0 ? `Level ${level} gesetzt` : "Priorität entfernt");
      loadNotes();
    } catch (error) {
      console.error("Error setting priority:", error);
      toast.error("Fehler beim Setzen der Priorität");
    }
  };

  const handleSetFollowUp = async (noteId: string, date: Date | null) => {
    try {
      const { error } = await supabase
        .from("quick_notes")
        .update({ follow_up_date: date?.toISOString() || null })
        .eq("id", noteId);

      if (error) throw error;
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

  const addNoteToMeeting = async (noteId: string, meetingId: string, meetingTitle: string) => {
    try {
      const { error } = await supabase
        .from('quick_notes')
        .update({
          meeting_id: meetingId,
          added_to_meeting_at: new Date().toISOString()
        })
        .eq('id', noteId);

      if (error) throw error;

      toast.success(`Notiz zum Jour Fixe "${meetingTitle}" hinzugefügt`);
      setMeetingSelectorOpen(false);
      setNoteForMeeting(null);
      loadNotes();
    } catch (error) {
      console.error('Error adding note to meeting:', error);
      toast.error("Fehler beim Hinzufügen zum Jour Fixe");
    }
  };

  const removeNoteFromMeeting = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('quick_notes')
        .update({
          meeting_id: null,
          added_to_meeting_at: null
        })
        .eq('id', noteId);

      if (error) throw error;
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
              <h4 className="font-medium text-sm truncate mb-1">
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
            {/* Als Aufgabe */}
            {!note.task_id && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-blue-500"
                      onClick={(e) => { e.stopPropagation(); createTaskFromNote(note); }}
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Als Aufgabe</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
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
                <DropdownMenuItem onClick={() => toast.info("Entscheidung erstellen", { description: "Funktion in Entwicklung" })}>
                  <Vote className="h-3 w-3 mr-2" />
                  Als Entscheidung
                </DropdownMenuItem>
                
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
                      {note.meetings?.title 
                        ? `JF: ${note.meetings.title.length > 12 ? note.meetings.title.substring(0, 12) + '...' : note.meetings.title}`
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
                    Mit {note.share_count} {note.share_count === 1 ? 'Person' : 'Personen'} geteilt
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
                    <span className="text-xs font-medium text-muted-foreground">Wiedervorlage</span>
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

          {/* Notes Archive (Trash) */}
          <Separator className="my-3" />
          <NotesArchive 
            refreshTrigger={archiveRefreshTrigger} 
            onRestore={loadNotes} 
          />
        </div>
      </ScrollArea>

      {/* Meeting Selector Dialog */}
      {noteForMeeting && (
        <MeetingNoteSelector
          open={meetingSelectorOpen}
          onOpenChange={setMeetingSelectorOpen}
          onSelect={(meetingId, meetingTitle) => addNoteToMeeting(noteForMeeting.id, meetingId, meetingTitle)}
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
    </>
  );
}
