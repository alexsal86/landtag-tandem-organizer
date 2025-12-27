import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pin, Trash2, StickyNote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface QuickNote {
  id: string;
  title: string | null;
  content: string;
  color: string | null;
  is_pinned: boolean;
  created_at: string;
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

  const loadNotes = useCallback(async () => {
    if (!user || !currentTenant) return;
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("quick_notes")
        .select("id, title, content, color, is_pinned, created_at")
        .eq("user_id", user.id)
        .eq("tenant_id", currentTenant.id)
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
  }, [user, currentTenant]);

  // Load notes on mount and when refreshTrigger changes
  useEffect(() => {
    loadNotes();
  }, [loadNotes, refreshTrigger]);

  // Realtime subscription for synchronization with Dashboard QuickNotes
  useEffect(() => {
    if (!user || !currentTenant) return;

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
  }, [user, currentTenant, loadNotes]);

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
                  className={cn(
                    "p-3 rounded-lg border transition-colors hover:shadow-sm",
                    note.color || "bg-card"
                  )}
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
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(note.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-7 w-7", note.is_pinned && "text-primary")}
                        onClick={() => handleTogglePin(note)}
                      >
                        <Pin className={cn("h-3 w-3", note.is_pinned && "fill-current")} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(note.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
