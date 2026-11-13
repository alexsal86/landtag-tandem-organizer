import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Plus, Edit, Trash2 } from 'lucide-react';
import { type ElectionDistrict, type ElectionDistrictNote, useElectionDistrictNotes } from '@/hooks/useElectionDistricts';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface NoteFormData {
  title: string;
  content: string;
  priority: "low" | "medium" | "high";
  category: "general" | "meeting" | "event" | "contact" | "issue";
  due_date?: string;
}

export function DistrictNotes({ district }: { district: ElectionDistrict }) {
  const { notes, loading, createNote, updateNote, deleteNote } = useElectionDistrictNotes(district.id);
  const [saving, setSaving] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<ElectionDistrictNote | null>(null);
  const [noteForm, setNoteForm] = useState<NoteFormData>({
    title: "",
    content: "",
    priority: "medium",
    category: "general",
  });

  const handleCreateNote = async () => {
    if (saving || !noteForm.title.trim()) return;
    setSaving(true);

    const created = await createNote({
      ...noteForm,
      district_id: district.id,
      due_date: noteForm.due_date || undefined,
      is_completed: false,
    });
    setSaving(false);
    if (!created) return;

    setNoteForm({
      title: "",
      content: "",
      priority: "medium",
      category: "general",
    });
    setIsCreatingNote(false);
  };

  const handleEditNote = (note: ElectionDistrictNote) => {
    setIsCreatingNote(false);
    setEditingNote(note);
    setNoteForm({
      title: note.title,
      content: note.content || "",
      priority: note.priority as "low" | "medium" | "high",
      category: note.category as "general" | "meeting" | "event" | "contact" | "issue",
      due_date: note.due_date ? format(new Date(note.due_date), "yyyy-MM-dd") : undefined,
    });
  };

  const handleUpdateNote = async () => {
    if (saving || !editingNote || !noteForm.title.trim()) return;
    setSaving(true);

    const updated = await updateNote(editingNote.id, {
      ...noteForm,
      due_date: noteForm.due_date ? new Date(noteForm.due_date).toISOString() : null,
    });

    setSaving(false);
    if (!updated) return;
    setEditingNote(null);
    setNoteForm({
      title: "",
      content: "",
      priority: "medium",
      category: "general",
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "default";
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      general: "Allgemein",
      meeting: "Termin",
      event: "Veranstaltung",
      contact: "Kontakt",
      issue: "Anliegen",
    };
    return labels[category as keyof typeof labels] || category;
  };

  return (
    <section aria-label="Arbeitsnotizen" className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h3 className="text-lg font-semibold">Arbeitsnotizen</h3>
        <Button 
          size="sm"
          disabled={saving}
          onClick={() => {
            setEditingNote(null);
            setNoteForm({ title: '', content: '', priority: 'medium', category: 'general' });
            setIsCreatingNote(true);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Neue Notiz
        </Button>
      </div>

      {(isCreatingNote || editingNote) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingNote ? "Notiz bearbeiten" : "Neue Notiz erstellen"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                value={noteForm.title}
                onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                placeholder="Titel der Notiz..."
              />
            </div>

            <div>
              <Label htmlFor="content">Inhalt</Label>
              <Textarea
                id="content"
                value={noteForm.content}
                onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                placeholder="Inhalt der Notiz..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priorität</Label>
                <Select value={noteForm.priority} onValueChange={(value) => setNoteForm({ ...noteForm, priority: value as NoteFormData["priority"] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="category">Kategorie</Label>
                <Select value={noteForm.category} onValueChange={(value) => setNoteForm({ ...noteForm, category: value as NoteFormData["category"] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Allgemein</SelectItem>
                    <SelectItem value="meeting">Termin</SelectItem>
                    <SelectItem value="event">Veranstaltung</SelectItem>
                    <SelectItem value="contact">Kontakt</SelectItem>
                    <SelectItem value="issue">Anliegen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="due_date">Fälligkeitsdatum (optional)</Label>
              <Input
                id="due_date"
                type="date"
                value={noteForm.due_date || ""}
                onChange={(e) => setNoteForm({ ...noteForm, due_date: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <Button disabled={saving || !noteForm.title.trim()} onClick={editingNote ? handleUpdateNote : handleCreateNote}>
                {editingNote ? "Aktualisieren" : "Erstellen"}
              </Button>
              <Button 
                variant="outline" disabled={saving}
                onClick={() => {
                  setIsCreatingNote(false);
                  setEditingNote(null);
                  setNoteForm({
                    title: "",
                    content: "",
                    priority: "medium",
                    category: "general",
                  });
                }}
              >
                Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Notizen werden geladen …</p>}
        {!loading && notes.map((note) => (
          <Card key={note.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{note.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant={getPriorityColor(note.priority) as "default" | "secondary" | "destructive" | "outline"}>
                      {note.priority === "high" ? "Hoch" : note.priority === "medium" ? "Mittel" : "Niedrig"}
                    </Badge>
                    <Badge variant="outline">{getCategoryLabel(note.category ?? '')}</Badge>
                    {note.due_date && (
                      <span className="text-xs flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {format(new Date(note.due_date), "dd.MM.yyyy", { locale: de })}
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    aria-label={`Notiz bearbeiten: ${note.title}`}
                    onClick={() => handleEditNote(note)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    aria-label={`Notiz löschen: ${note.title}`}
                    onClick={() => deleteNote(note.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {note.content && (
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>
              </CardContent>
            )}
          </Card>
        ))}

        {!loading && notes.length === 0 && !isCreatingNote && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Noch keine Notizen für diesen Wahlkreis vorhanden.</p>
            <p className="text-sm">Klicken Sie auf "Neue Notiz", um die erste Notiz zu erstellen.</p>
          </div>
        )}
      </div>
    </section>
  );
}
