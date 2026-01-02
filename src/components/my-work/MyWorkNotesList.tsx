import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Pin, Trash2, StickyNote, MoreHorizontal, CheckSquare, Vote, Calendar, Archive, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { MeetingNoteSelector } from "@/components/widgets/MeetingNoteSelector";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface QuickNote {
  id: string;
  title: string | null;
  content: string;
  color: string | null;
  is_pinned: boolean;
  created_at: string;
  task_id?: string;
  meeting_id?: string;
}

interface MyWorkNotesListProps {
  refreshTrigger?: number;
}

export function MyWorkNotesList({ refreshTrigger }: MyWorkNotesListProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [meetingSelectorOpen, setMeetingSelectorOpen] = useState(false);
  const [noteForMeeting, setNoteForMeeting] = useState<QuickNote | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<QuickNote | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const loadNotes = useCallback(async () => {
    if (!user) return;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("quick_notes")
        .select("id, title, content, color, is_pinned, created_at, is_archived, task_id, meeting_id")
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotes((data as QuickNote[]) || []);
    } catch (error) {
      console.error("Error loading notes:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load notes on mount and when refreshTrigger changes
  useEffect(() => {
    loadNotes();
  }, [loadNotes, refreshTrigger]);

  // Realtime subscription for synchronization with Dashboard QuickNotes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('my-work-quick-notes-changes')
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
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("quick_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;
      toast({ title: "Notiz gelöscht" });
      loadNotes();
    } catch (error) {
      console.error("Error deleting note:", error);
      toast({ title: "Fehler beim Löschen", variant: "destructive" });
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
      toast({ title: "Notiz archiviert" });
      loadNotes();
    } catch (error) {
      console.error("Error archiving note:", error);
      toast({ title: "Fehler beim Archivieren", variant: "destructive" });
    }
  };

  const createTaskFromNote = async (note: QuickNote) => {
    if (!user || !currentTenant) {
      toast({ title: "Fehler", description: "Nicht angemeldet", variant: "destructive" });
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

      // Link the note to the task
      await supabase
        .from("quick_notes")
        .update({ task_id: task.id })
        .eq("id", note.id);

      toast({ title: "Aufgabe erstellt", description: "Die Notiz wurde als Aufgabe angelegt" });
      loadNotes();
    } catch (error) {
      console.error('Error creating task from note:', error);
      toast({ title: "Fehler", variant: "destructive" });
    }
  };

  const openMeetingSelector = (note: QuickNote) => {
    setNoteForMeeting(note);
    setMeetingSelectorOpen(true);
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

      toast({ title: `Notiz zum Jour Fixe "${meetingTitle}" hinzugefügt` });
      setMeetingSelectorOpen(false);
      setNoteForMeeting(null);
      loadNotes();
    } catch (error) {
      console.error('Error adding note to meeting:', error);
      toast({ title: "Fehler", variant: "destructive" });
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
      toast({ title: "Notiz vom Jour Fixe entfernt" });
      loadNotes();
    } catch (error) {
      console.error('Error removing note from meeting:', error);
      toast({ title: "Fehler", variant: "destructive" });
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
      toast({ title: "Notiz aktualisiert" });
      setEditDialogOpen(false);
      setEditingNote(null);
      loadNotes();
    } catch (error) {
      console.error("Error updating note:", error);
      toast({ title: "Fehler beim Speichern", variant: "destructive" });
    }
  };

  // Strip HTML tags for preview
  const getPreviewText = (html: string) => {
    return html.replace(/<[^>]*>/g, '').substring(0, 150);
  };

  if (loading) {
    return (
      <Card className="flex-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Meine Notizen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="flex-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              Meine Notizen
            </CardTitle>
            <Badge variant="secondary">{notes.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            {notes.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <StickyNote className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Noch keine Notizen</p>
                <p className="text-sm">Nutze Quick Capture oben zum Starten</p>
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 rounded-lg border transition-colors hover:shadow-sm bg-card border-l-4 group relative"
                    style={{ borderLeftColor: note.color || "#3b82f6" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {note.title && (
                          <h4 className="font-medium text-sm truncate mb-1">
                            {note.title}
                          </h4>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {getPreviewText(note.content)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(note.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                          </p>
                          {note.task_id && (
                            <Badge variant="outline" className="text-xs px-1 py-0 text-blue-600">
                              Aufgabe
                            </Badge>
                          )}
                          {note.meeting_id && (
                            <Badge variant="outline" className="text-xs px-1 py-0 text-emerald-600">
                              Jour Fixe
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(note)}>
                              <Edit className="h-3 w-3 mr-2" />
                              Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {!note.task_id && (
                              <DropdownMenuItem onClick={() => createTaskFromNote(note)}>
                                <CheckSquare className="h-3 w-3 mr-2" />
                                Als Aufgabe
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => toast({ title: "Entscheidung erstellen", description: "Funktion in Entwicklung" })}>
                              <Vote className="h-3 w-3 mr-2" />
                              Als Entscheidung
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {!note.meeting_id ? (
                              <DropdownMenuItem onClick={() => openMeetingSelector(note)}>
                                <Calendar className="h-3 w-3 mr-2" />
                                Auf Jour Fixe setzen
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => removeNoteFromMeeting(note.id)} className="text-amber-600">
                                <Calendar className="h-3 w-3 mr-2" />
                                Von Jour Fixe entfernen
                              </DropdownMenuItem>
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Meeting Selector Dialog */}
      {noteForMeeting && (
        <MeetingNoteSelector
          open={meetingSelectorOpen}
          onOpenChange={setMeetingSelectorOpen}
          onSelect={(meetingId, meetingTitle) => addNoteToMeeting(noteForMeeting.id, meetingId, meetingTitle)}
        />
      )}

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
    </>
  );
}