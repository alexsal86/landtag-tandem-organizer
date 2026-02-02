

# Plan: 7 Verbesserungen für "Meine Notizen" und Dashboard

## Übersicht der Anforderungen

| # | Anforderung | Lösung |
|---|-------------|--------|
| 1 | Entscheidungsanfrage per Klick zurücknehmen | Toggle-Logik mit Bestätigungsdialog |
| 2 | Gelöschte Aufgaben/Entscheidungen/JF in Details anzeigen + Icon reset | Status-Prüfung bei Laden, UI anpassen |
| 3 | Archivierte Items dauerhaft in Notiz speichern + Pfeil bei Hover | Neue DB-Spalten + Navigation-Pfeil |
| 4 | Freigabesystem: Bearbeiten trotz "edit"-Berechtigung nicht möglich | RLS-Update-Policy + UI-Logik korrigieren |
| 5 | Farbauswahl: Nur Kante oder ganze Card einfärben | Checkbox in Color-Picker + DB-Spalte |
| 6 | Globaler Tastenkürzel für Notizen erstellen | Cmd/Ctrl+Shift+N Shortcut |
| 7 | Dashboard: WidgetQuickAccess und News tauschen | Reihenfolge in CustomizableDashboard ändern |

---

## 1. Entscheidungsanfrage per Klick zurücknehmen

### Aktueller Zustand
Das Decision-Icon ist aktuell disabled wenn `note.decision_id` gesetzt ist (Zeile 1364):
```typescript
disabled={!!note.decision_id}
```

### Lösung
Toggle-Verhalten mit Bestätigungsdialog implementieren.

**Datei:** `src/components/shared/QuickNotesList.tsx`

1. Neuen State für Bestätigungsdialog hinzufügen:
```typescript
const [confirmRemoveDecision, setConfirmRemoveDecision] = useState<QuickNote | null>(null);
```

2. Neue Funktion zum Entfernen der Entscheidungsverknüpfung:
```typescript
const removeDecisionFromNote = async (note: QuickNote) => {
  if (!note.decision_id || !user?.id) return;
  
  try {
    // Entscheidung archivieren (nicht löschen)
    await supabase
      .from('task_decisions')
      .update({ is_archived: true })
      .eq('id', note.decision_id);
    
    // Link aus Notiz entfernen
    await supabase
      .from("quick_notes")
      .update({ 
        decision_id: null,
        decision_archived_at: new Date().toISOString() // Neue Spalte
      })
      .eq("id", note.id)
      .eq("user_id", user.id);
    
    toast.success("Entscheidungsanfrage zurückgenommen");
    setConfirmRemoveDecision(null);
    loadNotes();
  } catch (error) {
    toast.error("Fehler beim Zurücknehmen");
  }
};
```

3. Icon-Click-Handler ändern (Zeile 1357-1363):
```typescript
onClick={(e) => {
  e.stopPropagation();
  if (note.decision_id) {
    setConfirmRemoveDecision(note);
  } else {
    setNoteForDecision(note);
    setDecisionCreatorOpen(true);
  }
}}
disabled={false} // Entfernen
```

4. Bestätigungsdialog hinzufügen:
```typescript
<AlertDialog open={!!confirmRemoveDecision} onOpenChange={() => setConfirmRemoveDecision(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Entscheidungsanfrage zurücknehmen?</AlertDialogTitle>
      <AlertDialogDescription>
        Die Entscheidungsanfrage wird archiviert und von dieser Notiz entfernt.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
      <AlertDialogAction onClick={() => confirmRemoveDecision && removeDecisionFromNote(confirmRemoveDecision)}>
        Zurücknehmen
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## 2. Gelöschte Items erkennen und Icon-Reset ermöglichen

### Problem
Wenn eine Aufgabe, Entscheidung oder Jour Fixe gelöscht wurde, zeigt die Notiz weiterhin das Icon als aktiv an.

### Lösung
Status der verknüpften Items beim Laden prüfen und ggf. automatisch bereinigen.

**Datei:** `src/components/shared/NoteLinkedDetails.tsx`

1. Erweiterte Status-Prüfung für "nicht gefunden":
```typescript
function NoteTaskStatus({ taskId, onNotFound }: { taskId: string; onNotFound?: () => void }) {
  // ... existing code ...
  
  useEffect(() => {
    const loadTask = async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('title, status, due_date, progress, is_archived')
        .eq('id', taskId)
        .single();
      
      if (error || !data) {
        onNotFound?.();
        setTask(null);
      } else {
        setTask(data);
      }
      setLoading(false);
    };
    loadTask();
  }, [taskId, onNotFound]);
  
  if (!task) {
    return (
      <div className="text-xs text-destructive flex items-center gap-1">
        <Trash2 className="h-3 w-3" />
        Aufgabe wurde gelöscht
      </div>
    );
  }
  // ... rest
}
```

**Datei:** `src/components/shared/QuickNotesList.tsx`

2. Icon-Tooltip anpassen wenn Item nicht existiert:
```typescript
// Bei gelöschtem Item: Icon zeigt "Neu erstellen" statt "aktiv"
<TooltipContent side="top">
  {note.task_id 
    ? taskExists ? "Aufgabe entfernen" : "Aufgabe wurde gelöscht - Klick zum Neu-Erstellen"
    : "Als Aufgabe"
  }
</TooltipContent>
```

3. Funktion zum Bereinigen ungültiger Verknüpfungen:
```typescript
const cleanupDeletedLink = async (noteId: string, field: 'task_id' | 'decision_id' | 'meeting_id') => {
  await supabase
    .from("quick_notes")
    .update({ [field]: null })
    .eq("id", noteId)
    .eq("user_id", user?.id);
  
  loadNotes();
};
```

---

## 3. Archivierte Items dauerhaft speichern + Pfeil bei Hover

### Datenbank-Änderung
Neue Spalten für historische Verknüpfungen:

```sql
ALTER TABLE public.quick_notes 
ADD COLUMN IF NOT EXISTS task_archived_info JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS decision_archived_info JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS meeting_archived_info JSONB DEFAULT NULL;

-- Format: { "id": "uuid", "title": "...", "archived_at": "timestamp", "status": "archived/deleted" }
```

### Speicherlogik
Wenn ein Item archiviert wird, Metadaten in die Notiz schreiben:

**Datei:** `src/components/shared/QuickNotesList.tsx`

```typescript
const archiveItemInfo = async (note: QuickNote, field: string, info: object) => {
  await supabase
    .from("quick_notes")
    .update({ [`${field}_archived_info`]: info })
    .eq("id", note.id);
};
```

### UI: Pfeil bei farbigen Detail-Cards

**Datei:** `src/components/shared/NoteLinkedDetails.tsx`

```typescript
// Bei jeder farbigen Card einen Hover-Pfeil hinzufügen
{taskId && (
  <div 
    className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-100 dark:border-blue-900 group/task cursor-pointer"
    onClick={() => navigate(`/tasks?id=${taskId}`)}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-blue-600">
        <CheckSquare className="h-4 w-4" />
        <span className="text-xs font-medium">Aufgabe</span>
      </div>
      <ArrowRight className="h-4 w-4 text-blue-600 opacity-0 group-hover/task:opacity-100 transition-opacity" />
    </div>
    <NoteTaskStatus taskId={taskId} />
  </div>
)}
```

---

## 4. Freigabesystem reparieren (Bearbeiten trotz "edit"-Berechtigung)

### Problem-Analyse
1. **RLS-Policy:** `quick_notes` hat nur eine UPDATE-Policy für `auth.uid() = user_id` - keine für Shared Notes mit Edit-Rechten
2. **UI-Logik:** Alle Edit-Buttons prüfen nur `note.user_id === user?.id`

### Lösung A: RLS-Policy erweitern

```sql
-- Neue Policy für Shared Edit
CREATE POLICY "Shared users with edit permission can update notes"
ON public.quick_notes
FOR UPDATE
USING (
  id IN (
    SELECT note_id FROM quick_note_shares 
    WHERE shared_with_user_id = auth.uid() 
    AND permission_type = 'edit'
  )
)
WITH CHECK (
  id IN (
    SELECT note_id FROM quick_note_shares 
    WHERE shared_with_user_id = auth.uid() 
    AND permission_type = 'edit'
  )
);
```

### Lösung B: UI-Logik anpassen

**Datei:** `src/components/shared/QuickNotesList.tsx`

1. Berechtigungsprüfung in loadNotes erweitern - Edit-Permission laden:
```typescript
// Beim Laden der Shared Notes auch permission_type mitladen
const { data: individualShares } = await supabase
  .from("quick_note_shares")
  .select("note_id, permission_type")
  .eq("shared_with_user_id", user.id);
```

2. Interface erweitern:
```typescript
interface QuickNote {
  // ... existing
  can_edit?: boolean; // Für shared notes
}
```

3. Bedingung für Edit-Button ändern:
```typescript
// Statt: note.user_id === user?.id
// Neu:
const canEdit = note.user_id === user?.id || note.can_edit === true;

{canEdit && (
  <DropdownMenuItem onClick={() => openEditDialog(note)}>
    <Pencil className="h-3 w-3 mr-2" />
    Bearbeiten
  </DropdownMenuItem>
)}
```

4. handleSaveEdit anpassen für Shared Notes:
```typescript
const handleSaveEdit = async () => {
  // Für eigene Notizen
  if (editingNote?.user_id === user?.id) {
    // Bestehende Logik mit user_id filter
  } else if (editingNote?.can_edit) {
    // Für shared notes: Update ohne user_id filter
    const { error } = await supabase
      .from("quick_notes")
      .update({ title: editTitle.trim() || null, content: editContent.trim() })
      .eq("id", editingNote.id);
    
    if (error) throw error;
  }
};
```

---

## 5. Farbauswahl: Nur Kante oder komplette Card

### Datenbank-Änderung
```sql
ALTER TABLE public.quick_notes 
ADD COLUMN IF NOT EXISTS color_full_card BOOLEAN DEFAULT false;
```

### UI-Änderung

**Datei:** `src/components/shared/QuickNotesList.tsx`

1. Farb-Submenu erweitern (nach den Farbkreisen, Zeile ~1595):
```typescript
{/* Color Submenu */}
<DropdownMenuSub>
  <DropdownMenuSubTrigger>
    <Palette className="h-3 w-3 mr-2" />
    Farbe
  </DropdownMenuSubTrigger>
  <DropdownMenuPortal>
    <DropdownMenuSubContent>
      <div className="flex flex-wrap gap-1.5 p-2 max-w-[140px]">
        {noteColors.map((color) => (
          // ... existing color buttons
        ))}
      </div>
      {note.color && (
        <>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox 
                checked={note.color_full_card ?? false}
                onCheckedChange={(checked) => handleSetColorMode(note.id, !!checked)}
              />
              Ganze Card einfärben
            </label>
          </div>
        </>
      )}
    </DropdownMenuSubContent>
  </DropdownMenuPortal>
</DropdownMenuSub>
```

2. Neue Funktion für Farbmodus:
```typescript
const handleSetColorMode = async (noteId: string, fullCard: boolean) => {
  await supabase
    .from("quick_notes")
    .update({ color_full_card: fullCard })
    .eq("id", noteId)
    .eq("user_id", user?.id);
  
  loadNotes();
};
```

3. Card-Rendering anpassen (Zeile ~1143):
```typescript
style={{ 
  borderLeftColor: note.color || "#3b82f6",
  backgroundColor: note.color && note.color_full_card 
    ? `${note.color}40` // 25% Opacity für full card
    : note.color 
      ? `${note.color}20` // 12% Opacity nur für Hintergrund-Akzent
      : undefined
}}
```

---

## 6. Globaler Tastenkürzel für Notizen-Erstellung

### Tastenkombination
**Cmd/Ctrl + Shift + N** - Universell verständlich, nicht belegt

### Implementierung

**Datei:** `src/App.tsx` oder neuer Hook `src/hooks/useGlobalNoteShortcut.tsx`

```typescript
// Neuer Hook für globale Notiz-Erstellung
export function useGlobalNoteShortcut() {
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + N
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'n') {
        e.preventDefault();
        setNoteDialogOpen(true);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  return { noteDialogOpen, setNoteDialogOpen };
}
```

**Neue Komponente:** `src/components/GlobalQuickNoteDialog.tsx`

```typescript
export function GlobalQuickNoteDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  
  const handleSave = async () => {
    if (!content.trim() && !title.trim()) {
      toast.error("Bitte Inhalt eingeben");
      return;
    }
    
    const { error } = await supabase
      .from('quick_notes')
      .insert({
        user_id: user.id,
        title: title.trim() || null,
        content: content.trim() || title.trim(),
        is_pinned: false,
        priority_level: 0
      });
    
    if (error) {
      toast.error("Fehler beim Erstellen");
      return;
    }
    
    toast.success("Notiz erstellt");
    onOpenChange(false);
    setTitle("");
    setContent("");
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Schnelle Notiz
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Titel (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <Textarea
            placeholder="Notiz eingeben..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Datei:** `src/App.tsx`

Integration in App:
```typescript
import { GlobalQuickNoteDialog } from "@/components/GlobalQuickNoteDialog";

// Im App component:
const [quickNoteOpen, setQuickNoteOpen] = useState(false);

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'n') {
      e.preventDefault();
      setQuickNoteOpen(true);
    }
  };
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);

// Im Return:
<GlobalQuickNoteDialog open={quickNoteOpen} onOpenChange={setQuickNoteOpen} />
```

---

## 7. Dashboard: Position von WidgetQuickAccess und News tauschen

### Aktueller Zustand (CustomizableDashboard.tsx Zeilen 274-293)
```
1. DashboardGreetingSection (enthält WidgetQuickAccess rechts)
2. QuickActionsWidget
3. "Aktuelle Nachrichten" + NewsWidget
```

### Gewünschte Reihenfolge
Die Widgets in DashboardGreetingSection und News-Section tauschen.

### Lösung

**Datei:** `src/components/CustomizableDashboard.tsx`

Reihenfolge ändern (Zeilen 279-293):
```typescript
{/* News Section - VORHER unten, jetzt oben */}
<div className="mb-6">
  <h2 className="text-2xl font-bold text-foreground mb-4">
    Aktuelle Nachrichten
  </h2>
  <NewsWidget />
</div>

{/* Quick Actions - bleibt in der Mitte */}
<div className="mb-6">
  <QuickActionsWidget 
    className="shadow-sm"
    widgetSize="full-width"
  />
</div>
```

Alternativ falls WidgetQuickAccess gemeint ist (innerhalb von DashboardGreetingSection), muss die Komponente angepasst werden.

---

## Zusammenfassung der Dateien

| Datei | Änderungen |
|-------|------------|
| **DB-Migration** | 3 neue Spalten für archived_info, 1 für color_full_card |
| **RLS-Policy** | UPDATE-Policy für Shared Notes mit edit-Permission |
| `src/components/shared/QuickNotesList.tsx` | Decision-Toggle, Delete-Detection, Color-Mode, Edit-Permission |
| `src/components/shared/NoteLinkedDetails.tsx` | Hover-Pfeil für Navigation, Delete-Status |
| `src/components/CustomizableDashboard.tsx` | Reihenfolge tauschen |
| `src/components/GlobalQuickNoteDialog.tsx` | **Neue Komponente** für schnelle Notizen |
| `src/App.tsx` | Globaler Tastenkürzel Cmd+Shift+N |

---

## Umsetzungsreihenfolge

1. **Dashboard-Reihenfolge** - Einfache Änderung
2. **Entscheidung zurücknehmen** - Toggle mit Bestätigung
3. **Farbmodus-Checkbox** - UI-Erweiterung
4. **Globaler Shortcut** - Neue Komponente
5. **Freigabesystem reparieren** - RLS + UI-Logik
6. **Gelöschte Items erkennen** - Status-Prüfung
7. **Archivierte Items speichern** - DB-Migration + Logik

