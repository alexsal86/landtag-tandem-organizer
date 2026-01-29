
# Plan: Quick Notes Card UI-Fixes und Lösch-Bestätigungen

## Übersicht der 6 Änderungen

| # | Problem | Lösung |
|---|---------|--------|
| 1 | Details-Button unten rechts beim Hovern für Beschreibung | Entfernen - nur der inline "→" nach "..." für Beschreibungserweiterung |
| 2 | Details-Button bei Indikatoren: zeigt "> Details" statt nur ">" | Nur ">" zeigen, beim Hover "→ Details" für Navigations-Links |
| 3 | Elemente am unteren Rand der Card vereinheitlichen | Indikatoren, Hover-Icons und Details-Navigation in einer Zeile unten |
| 4 | Fehler beim Wiederherstellen von archivierten/gelöschten Notizen | RLS-Problem beheben: `user_id` Filter bei UPDATE hinzufügen |
| 5 | Aufgabe löschen: Bestätigungsdialog | AlertDialog vor dem Löschen von Aufgaben |
| 6 | Notiz mit verknüpften Elementen löschen: erweiterte Bestätigung | Zusätzliche Optionen zum Löschen von Aufgabe/Entscheidung/Meeting |

---

## 1. Details-Button für Beschreibung entfernen

**Problem:** Zeilen 1389-1398 zeigen beim Hovern unten rechts einen grünen "→ Details" Button zum Erweitern der Beschreibung. Dieser ist überflüssig, da bereits ein inline-Pfeil in der Beschreibung existiert (Zeile 1030-1035).

**Lösung:** Den Details-Button für die Beschreibungserweiterung komplett entfernen.

```typescript
// ENTFERNEN (Zeilen 1389-1403):
{/* Details expand button - only when truncated and not expanded */}
{needsTruncation && !isExpanded && (
  <button ... >
    <ArrowRight ... />
    <span className="ml-0.5">Details</span>
  </button>
)}

{/* Vertical separator */}
{note.user_id === user?.id && needsTruncation && !isExpanded && (
  <div className="h-4 w-px bg-border mx-1" />
)}
```

---

## 2 & 3. Bottom-Bereich neu strukturieren: Eine Zeile mit Indikatoren, Details-Links, Quick-Icons

**Neues Layout am unteren Rand der Card:**

```
┌────────────────────────────────────────────────────────────────────────┐
│ [■ ■ ■]    [→ Details-Links bei Hover]     [Hover Icons: ✏️ ☑️ 🗳️ 📅 ≡] │
│   Links            Mitte                              Rechts           │
└────────────────────────────────────────────────────────────────────────┘
```

**Ohne Hover:**
- Links: Kleine farbige Quadrate (Task/Decision/Meeting/Shared)
- Mitte: Leer
- Rechts: Leer

**Mit Hover:**
- Links: Badges mit "→ Details" Button für Task/Entscheidung/JourFixe
- Rechts: Quick-Action Icons

**Neue Struktur (Zeilen 1043-1134 und 1384-1526 zusammenführen):**

```typescript
{/* BOTTOM BAR - Unified bottom section */}
{(hasLinkedItems || hasShared || note.user_id === user?.id) && (
  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between gap-2">
    {/* LEFT: Status indicators and badges */}
    <div className="flex items-center gap-2 flex-1 min-w-0">
      {/* Small squares - visible when NOT hovering card */}
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
          <div className="w-1.5 h-1.5 bg-violet-500" title="Geteilt" />
        )}
      </div>
      
      {/* Full badges with "→ Details" - visible on card hover */}
      <div className="hidden group-hover:flex items-center gap-1.5 flex-wrap">
        {note.task_id && (
          <NoteLinkedBadge type="task" id={note.task_id} label="Aufgabe" />
        )}
        {note.decision_id && (
          <NoteLinkedBadge type="decision" id={note.decision_id} label="Entscheidung" />
        )}
        {note.meeting_id && (
          <NoteLinkedBadge type="meeting" id={note.meeting_id} 
            label={note.meetings?.meeting_date 
              ? `JF: ${format(new Date(note.meetings.meeting_date), "dd.MM.", { locale: de })}`
              : "Jour Fixe"
            } />
        )}
        {/* Shared badges */}
        {/* ... shared badge logic remains the same ... */}
      </div>
    </div>
    
    {/* RIGHT: Quick action icons - only on hover, only for own notes */}
    {note.user_id === user?.id && (
      <div className={cn(
        "flex items-center gap-1 flex-shrink-0",
        "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      )}>
        {/* Edit, Task, Decision, Follow-up, Jour Fixe icons */}
        <TooltipProvider>
          {/* ... existing tooltip-wrapped buttons ... */}
        </TooltipProvider>
        
        {/* Drag Handle - LAST */}
        {dragHandleProps && (
          <div {...dragHandleProps} className="cursor-grab p-1 hover:bg-muted/80 rounded-full">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
      </div>
    )}
  </div>
)}
```

---

## 4. Archiv/Papierkorb Wiederherstellung: RLS-Fehler beheben

**Problem:** Bei `handleRestore` und `handleRestoreFromArchive` in `NotesArchive.tsx` fehlt möglicherweise die korrekte RLS-Handhabung oder ein SELECT nach dem UPDATE.

**Aktuelle Implementierung (Zeilen 150-163 und 172-191):**

```typescript
const handleRestore = async (noteId: string) => {
  const { error } = await supabase
    .from("quick_notes")
    .update({ deleted_at: null, permanent_delete_at: null })
    .eq("id", noteId)
    .eq("user_id", user.id);  // ✅ user_id ist vorhanden
  ...
};
```

**Lösung:** Fehlerbehandlung verbessern und SELECT hinzufügen um sicherzustellen, dass Update erfolgreich war:

```typescript
const handleRestore = async (noteId: string) => {
  if (!user?.id) {
    toast.error("Nicht angemeldet");
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from("quick_notes")
      .update({ deleted_at: null, permanent_delete_at: null })
      .eq("id", noteId)
      .eq("user_id", user.id)
      .select();  // ← WICHTIG: SELECT hinzufügen für RLS-Validierung

    if (error) throw error;
    
    if (!data || data.length === 0) {
      toast.error("Keine Berechtigung zum Wiederherstellen dieser Notiz");
      return;
    }
    
    // Optimistic UI update
    setNotes(prev => prev.filter(n => n.id !== noteId));
    
    toast.success("Notiz wiederhergestellt");
    onRestore?.();
  } catch (error) {
    console.error("Error restoring note:", error);
    toast.error("Fehler beim Wiederherstellen");
    // Reload on error to ensure consistent state
    loadDeletedNotes();
  }
};

const handleRestoreFromArchive = async (noteId: string) => {
  if (!user?.id) {
    toast.error("Nicht angemeldet");
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from("quick_notes")
      .update({ is_archived: false, archived_at: null })
      .eq("id", noteId)
      .eq("user_id", user.id)
      .select();  // ← Bereits vorhanden, aber Fehlerbehandlung verbessern

    if (error) throw error;
    
    if (!data || data.length === 0) {
      toast.error("Keine Berechtigung zum Wiederherstellen dieser Notiz");
      return;
    }
    
    // Optimistic state update
    setArchivedNotes(prev => prev.filter(n => n.id !== noteId));
    
    toast.success("Notiz aus Archiv wiederhergestellt");
    onRestore?.();
  } catch (error) {
    console.error("Error restoring from archive:", error);
    toast.error("Fehler beim Wiederherstellen");
    loadArchivedNotes();
  }
};
```

---

## 5. Aufgabe löschen: Bestätigungsdialog

**Problem:** `removeTaskFromNote` löscht die Aufgabe direkt ohne Bestätigung (Zeilen 620-654).

**Lösung:** AlertDialog State hinzufügen und vor dem Löschen anzeigen.

**Neue State-Variablen:**
```typescript
const [confirmDeleteTaskNote, setConfirmDeleteTaskNote] = useState<QuickNote | null>(null);
```

**Angepasster Flow:**
```typescript
// Statt sofortigem Löschen:
// onClick={() => removeTaskFromNote(note)}
// 
// Jetzt:
// onClick={() => setConfirmDeleteTaskNote(note)}

// AlertDialog hinzufügen:
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
          setConfirmDeleteTaskNote(null);
        }}
        className="bg-destructive text-destructive-foreground"
      >
        Aufgabe löschen
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## 6. Notiz mit verknüpften Elementen löschen: Erweiterte Bestätigung

**Problem:** `handleDelete` löscht die Notiz ohne Warnung, wenn Task/Decision/Meeting verknüpft sind.

**Lösung:** 
1. Prüfen ob Notiz verknüpfte Elemente hat
2. Dialog mit Checkboxen für jedes verknüpfte Element anzeigen
3. Benutzer kann wählen, welche verknüpften Elemente auch gelöscht werden sollen

**Neue State-Variablen:**
```typescript
const [confirmDeleteLinkedNote, setConfirmDeleteLinkedNote] = useState<QuickNote | null>(null);
const [deleteLinkedTask, setDeleteLinkedTask] = useState(true);
const [deleteLinkedDecision, setDeleteLinkedDecision] = useState(true);
const [deleteLinkedMeeting, setDeleteLinkedMeeting] = useState(false); // Default: Meeting nicht löschen
```

**Angepasster handleDelete:**
```typescript
const handleDeleteWithConfirmation = (note: QuickNote) => {
  const hasLinks = note.task_id || note.decision_id || note.meeting_id;
  
  if (hasLinks) {
    // Reset checkboxes
    setDeleteLinkedTask(!!note.task_id);
    setDeleteLinkedDecision(!!note.decision_id);
    setDeleteLinkedMeeting(false); // Default: Meeting nicht löschen
    setConfirmDeleteLinkedNote(note);
  } else {
    // Direkt löschen ohne zusätzliche Bestätigung
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
      await supabase.from('decisions').delete().eq('id', note.decision_id);
    }
    
    // 3. Remove from meeting if selected (not delete the meeting itself)
    if (note.meeting_id && deleteLinkedMeeting) {
      // Just remove the link, don't delete the meeting
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
```

**AlertDialog mit Checkboxen:**
```typescript
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
          <label htmlFor="delete-task" className="text-sm flex items-center gap-2">
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
          <label htmlFor="delete-decision" className="text-sm flex items-center gap-2">
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
          <label htmlFor="delete-meeting" className="text-sm flex items-center gap-2">
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
        className="bg-destructive text-destructive-foreground"
      >
        Löschen
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Visuelle Darstellung des neuen Card-Layouts

**Ohne Hover:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ [🔶]                                                              [⋮]  │
│ Notiz-Titel                                                            │
│ Beschreibung mit maximal zwei Zeilen und dann nicht auf               │
│ Beschwerden reagieren...→                                              │
│                                                                         │
│ ■ ■ ■ ■                                                                │
└─────────────────────────────────────────────────────────────────────────┘
```

**Mit Hover:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ [🔶]                                                              [⋮]  │
│ Notiz-Titel                                                            │
│ Beschreibung mit maximal zwei Zeilen und dann nicht auf               │
│ Beschwerden reagieren...→                                              │
│                                                                         │
│ [Aufgabe→] [Entscheidung→] [JF:28.01.→] [Geteilt]   [✏️ ☑️ 🗳️ 🕐 📅 ≡] │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Zusammenfassung der Dateien

| Datei | Änderungen |
|-------|------------|
| `src/components/shared/QuickNotesList.tsx` | Punkte 1-3, 5-6: UI-Struktur, AlertDialogs |
| `src/components/shared/NotesArchive.tsx` | Punkt 4: Restore-Fehler beheben |

---

## Zusätzliche Imports für QuickNotesList.tsx

```typescript
import { Checkbox } from "@/components/ui/checkbox";
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
```

---

## Geschätzter Aufwand

| Änderung | Zeit |
|----------|------|
| Details-Button entfernen | 5 Min |
| Bottom-Bar neu strukturieren | 20 Min |
| Archiv/Papierkorb Restore-Fix | 10 Min |
| Aufgabe-Lösch-Bestätigung | 15 Min |
| Verknüpfte-Elemente-Lösch-Dialog | 25 Min |
| **Gesamt** | **~75 Min** |
