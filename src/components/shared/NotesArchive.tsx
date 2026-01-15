import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trash2, RotateCcw, Clock, ChevronDown, Archive, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, differenceInDays, addDays } from "date-fns";
import { de } from "date-fns/locale";

interface DeletedNote {
  id: string;
  title: string | null;
  content: string;
  color: string | null;
  deleted_at: string;
  permanent_delete_at: string;
}

interface ArchivedNote {
  id: string;
  title: string | null;
  content: string;
  color: string | null;
  archived_at: string;
}

interface NotesArchiveProps {
  refreshTrigger?: number;
  onRestore?: () => void;
}

export function NotesArchive({ refreshTrigger, onRestore }: NotesArchiveProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<DeletedNote[]>([]);
  const [archivedNotes, setArchivedNotes] = useState<ArchivedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false);
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<DeletedNote | null>(null);
  const [datePickerNote, setDatePickerNote] = useState<DeletedNote | null>(null);

  const loadDeletedNotes = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("quick_notes")
        .select("id, title, content, color, deleted_at, permanent_delete_at")
        .eq("user_id", user.id)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) throw error;
      setNotes((data || []) as DeletedNote[]);
    } catch (error) {
      console.error("Error loading deleted notes:", error);
    }
  }, [user]);

  const loadArchivedNotes = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("quick_notes")
        .select("id, title, content, color, archived_at")
        .eq("user_id", user.id)
        .eq("is_archived", true)
        .is("deleted_at", null)
        .order("archived_at", { ascending: false });

      if (error) throw error;
      setArchivedNotes((data || []) as ArchivedNote[]);
    } catch (error) {
      console.error("Error loading archived notes:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Load both note types in parallel for faster loading
    const loadAllNotes = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const [deletedRes, archivedRes] = await Promise.all([
          supabase
            .from("quick_notes")
            .select("id, title, content, color, deleted_at, permanent_delete_at")
            .eq("user_id", user.id)
            .not("deleted_at", "is", null)
            .order("deleted_at", { ascending: false }),
          supabase
            .from("quick_notes")
            .select("id, title, content, color, archived_at")
            .eq("user_id", user.id)
            .eq("is_archived", true)
            .is("deleted_at", null)
            .order("archived_at", { ascending: false })
        ]);
        
        setNotes((deletedRes.data || []) as DeletedNote[]);
        setArchivedNotes((archivedRes.data || []) as ArchivedNote[]);
      } catch (error) {
        console.error("Error loading notes:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadAllNotes();
  }, [user, refreshTrigger]);

  const handleRestore = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("quick_notes")
        .update({ deleted_at: null, permanent_delete_at: null })
        .eq("id", noteId);

      if (error) throw error;
      toast.success("Notiz wiederhergestellt");
      loadDeletedNotes();
      onRestore?.();
    } catch (error) {
      console.error("Error restoring note:", error);
      toast.error("Fehler beim Wiederherstellen");
    }
  };

  const handleRestoreFromArchive = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("quick_notes")
        .update({ is_archived: false, archived_at: null })
        .eq("id", noteId);

      if (error) throw error;
      toast.success("Notiz aus Archiv wiederhergestellt");
      loadArchivedNotes();
      onRestore?.();
    } catch (error) {
      console.error("Error restoring from archive:", error);
      toast.error("Fehler beim Wiederherstellen");
    }
  };

  const handlePermanentDelete = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("quick_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;
      toast.success("Notiz endgültig gelöscht");
      setConfirmDeleteNote(null);
      loadDeletedNotes();
    } catch (error) {
      console.error("Error permanently deleting note:", error);
      toast.error("Fehler beim Löschen");
    }
  };

  const handleUpdateDeleteDate = async (noteId: string, newDate: Date) => {
    try {
      const { error } = await supabase
        .from("quick_notes")
        .update({ permanent_delete_at: newDate.toISOString() })
        .eq("id", noteId);

      if (error) throw error;
      toast.success(`Löschdatum geändert auf ${format(newDate, "dd.MM.yyyy", { locale: de })}`);
      setDatePickerNote(null);
      loadDeletedNotes();
    } catch (error) {
      console.error("Error updating delete date:", error);
      toast.error("Fehler beim Ändern des Löschdatums");
    }
  };

  const getPreviewText = (html: string) => {
    return html.replace(/<[^>]*>/g, "").substring(0, 80);
  };

  const getDaysRemaining = (deleteDate: string) => {
    return differenceInDays(new Date(deleteDate), new Date());
  };

  if (loading) {
    return null;
  }

  if (notes.length === 0 && archivedNotes.length === 0) {
    return null;
  }

  return (
    <>
      {/* Archived Notes Section */}
      {archivedNotes.length > 0 && (
        <Collapsible open={isArchivedExpanded} onOpenChange={setIsArchivedExpanded}>
          <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2 rounded hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  !isArchivedExpanded && "-rotate-90"
                )}
              />
              <Archive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Archiv</span>
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {archivedNotes.length}
              </Badge>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <ScrollArea className="max-h-[250px]">
              <div className="space-y-2 p-2">
                {archivedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 rounded-lg border bg-card/50 border-l-4 opacity-75"
                    style={{ borderLeftColor: note.color || "#94a3b8" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {note.title && (
                          <h4 className="font-medium text-sm truncate mb-1">
                            {note.title}
                          </h4>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {getPreviewText(note.content)}
                        </p>
                        <span className="text-xs text-muted-foreground mt-1 block">
                          Archiviert: {format(new Date(note.archived_at), "dd.MM.yyyy", { locale: de })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
                          onClick={() => handleRestoreFromArchive(note.id)}
                          title="Wiederherstellen"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Trash Section */}
      {notes.length > 0 && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2 rounded hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  !isExpanded && "-rotate-90"
                )}
              />
              <Trash2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Papierkorb</span>
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {notes.length}
              </Badge>
            </div>
          </CollapsibleTrigger>

        <CollapsibleContent>
          <ScrollArea className="max-h-[250px]">
            <div className="space-y-2 p-2">
              {notes.map((note) => {
                const daysRemaining = getDaysRemaining(note.permanent_delete_at);
                const isUrgent = daysRemaining <= 3;

                return (
                  <div
                    key={note.id}
                    className="p-3 rounded-lg border bg-card/50 border-l-4 opacity-75"
                    style={{ borderLeftColor: note.color || "#94a3b8" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {note.title && (
                          <h4 className="font-medium text-sm truncate mb-1 line-through">
                            {note.title}
                          </h4>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {getPreviewText(note.content)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant={isUrgent ? "destructive" : "secondary"}
                            className="text-xs px-1.5 py-0"
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            {daysRemaining <= 0
                              ? "Heute"
                              : `${daysRemaining} ${daysRemaining === 1 ? "Tag" : "Tage"}`}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Gelöscht: {format(new Date(note.deleted_at), "dd.MM.yyyy", { locale: de })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
                          onClick={() => handleRestore(note.id)}
                          title="Wiederherstellen"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Löschdatum ändern"
                            >
                              <CalendarIcon className="h-3.5 w-3.5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                              mode="single"
                              selected={new Date(note.permanent_delete_at)}
                              onSelect={(date) => {
                                if (date) handleUpdateDeleteDate(note.id, date);
                              }}
                              disabled={(date) => date < new Date()}
                              locale={de}
                            />
                          </PopoverContent>
                        </Popover>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDeleteNote(note)}
                          title="Endgültig löschen"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Confirm Delete Dialog */}
      <AlertDialog
        open={!!confirmDeleteNote}
        onOpenChange={(open) => !open && setConfirmDeleteNote(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notiz endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Die Notiz wird dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteNote && handlePermanentDelete(confirmDeleteNote.id)}
            >
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
