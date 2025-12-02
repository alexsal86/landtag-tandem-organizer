import { useState } from "react";
import { CaseFileNote } from "@/hooks/useCaseFileDetails";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, MessageSquare, Pin, Edit2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
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

interface CaseFileNotesTabProps {
  notes: CaseFileNote[];
  onAdd: (content: string) => Promise<boolean>;
  onUpdate: (id: string, content: string, isPinned?: boolean) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export function CaseFileNotesTab({ notes, onAdd, onUpdate, onDelete }: CaseFileNotesTabProps) {
  const [newNote, setNewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    setIsSubmitting(true);
    const success = await onAdd(newNote);
    setIsSubmitting(false);
    if (success) {
      setNewNote("");
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editContent.trim()) return;
    await onUpdate(id, editContent);
    setEditingId(null);
    setEditContent("");
  };

  const handleTogglePin = async (note: CaseFileNote) => {
    await onUpdate(note.id, note.content, !note.is_pinned);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Notizen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new note */}
        <div className="space-y-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Neue Notiz hinzufügen..."
            rows={3}
          />
          <Button 
            onClick={handleAdd} 
            disabled={!newNote.trim() || isSubmitting}
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            {isSubmitting ? "Füge hinzu..." : "Notiz hinzufügen"}
          </Button>
        </div>

        {/* Notes list */}
        {notes.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Noch keine Notizen vorhanden
          </p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className={cn(
                  "p-4 rounded-lg border bg-card",
                  note.is_pinned && "border-primary/50 bg-primary/5"
                )}
              >
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleUpdate(note.id)}>
                        Speichern
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setEditingId(null);
                          setEditContent("");
                        }}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm whitespace-pre-wrap flex-1">{note.content}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleTogglePin(note)}
                        >
                          <Pin className={cn(
                            "h-4 w-4",
                            note.is_pinned && "fill-current text-primary"
                          )} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingId(note.id);
                            setEditContent(note.content);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(note.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                      {note.updated_at !== note.created_at && " (bearbeitet)"}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notiz löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (deleteId) onDelete(deleteId);
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
