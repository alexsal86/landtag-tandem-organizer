import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarIcon, Phone, Mail, Globe, Users, MapPin, Plus, Edit, Trash2, Crown, Award } from "lucide-react";
import { ElectionDistrict, ElectionDistrictNote, useElectionDistrictNotes } from "@/hooks/useElectionDistricts";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface DistrictDetailDialogProps {
  district: ElectionDistrict | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NoteFormData {
  title: string;
  content: string;
  priority: "low" | "medium" | "high";
  category: "general" | "meeting" | "event" | "contact" | "issue";
  due_date?: string;
}

export function DistrictDetailDialog({ district, open, onOpenChange }: DistrictDetailDialogProps) {
  const { notes, createNote, updateNote, deleteNote } = useElectionDistrictNotes(district?.id);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<ElectionDistrictNote | null>(null);
  const [noteForm, setNoteForm] = useState<NoteFormData>({
    title: "",
    content: "",
    priority: "medium",
    category: "general",
  });

  const handleCreateNote = async () => {
    if (!noteForm.title.trim()) return;

    await createNote({
      ...noteForm,
      district_id: district!.id,
      is_completed: false,
    });

    setNoteForm({
      title: "",
      content: "",
      priority: "medium",
      category: "general",
    });
    setIsCreatingNote(false);
  };

  const handleEditNote = (note: ElectionDistrictNote) => {
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
    if (!editingNote || !noteForm.title.trim()) return;

    await updateNote(editingNote.id, {
      ...noteForm,
      due_date: noteForm.due_date ? new Date(noteForm.due_date).toISOString() : undefined,
    });

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

  if (!district) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Wahlkreis {district.district_number}: {district.district_name}
          </DialogTitle>
          <DialogDescription>
            Detailinformationen und Arbeitsnotizen für {district.district_name}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Informationen</TabsTrigger>
            <TabsTrigger value="notes">Arbeitsnotizen ({notes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    Abgeordnete
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {district.representatives && district.representatives.length > 0 ? (
                    <div className="space-y-3">
                      {district.representatives.map((rep) => (
                        <div key={rep.id} className="p-3 bg-gray-50 rounded-md">
                          <div className="flex items-center gap-2 mb-1">
                            {rep.mandate_type === 'direct' && <Award className="h-4 w-4 text-yellow-600" />}
                            <span className="font-medium">{rep.name}</span>
                            <Badge variant="outline">{rep.party}</Badge>
                          </div>
                          <p className="text-xs text-gray-600">
                            {rep.mandate_type === 'direct' ? 'Direktmandat' : 'Listenmandat'}
                          </p>
                          {rep.email && (
                            <p className="text-xs text-gray-600 mt-1">📧 {rep.email}</p>
                          )}
                          {rep.phone && (
                            <p className="text-xs text-gray-600">📞 {rep.phone}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">Keine Abgeordneten-Daten verfügbar</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Statistiken</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Einwohner</span>
                      <span className="font-medium">{district.population?.toLocaleString() || "Unbekannt"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Fläche</span>
                      <span className="font-medium">{district.area_km2 || "Unbekannt"} km²</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {district.contact_info && (
              <Card>
                <CardHeader>
                  <CardTitle>Kontaktinformationen</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {district.contact_info.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{district.contact_info.phone}</span>
                      </div>
                    )}
                    {district.contact_info.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>{district.contact_info.email}</span>
                      </div>
                    )}
                    {district.website_url && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <a 
                          href={district.website_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Website
                        </a>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="notes" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Arbeitsnotizen</h3>
              <Button 
                onClick={() => setIsCreatingNote(true)}
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
                      <Select value={noteForm.priority} onValueChange={(value: any) => setNoteForm({ ...noteForm, priority: value })}>
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
                      <Select value={noteForm.category} onValueChange={(value: any) => setNoteForm({ ...noteForm, category: value })}>
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
                    <Button onClick={editingNote ? handleUpdateNote : handleCreateNote}>
                      {editingNote ? "Aktualisieren" : "Erstellen"}
                    </Button>
                    <Button 
                      variant="outline" 
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
              {notes.map((note) => (
                <Card key={note.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{note.title}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Badge variant={getPriorityColor(note.priority) as any}>
                            {note.priority === "high" ? "Hoch" : note.priority === "medium" ? "Mittel" : "Niedrig"}
                          </Badge>
                          <Badge variant="outline">{getCategoryLabel(note.category)}</Badge>
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
                          onClick={() => handleEditNote(note)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
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

              {notes.length === 0 && !isCreatingNote && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Noch keine Notizen für diesen Wahlkreis vorhanden.</p>
                  <p className="text-sm">Klicken Sie auf "Neue Notiz", um die erste Notiz zu erstellen.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
