
# Plan: Fehlerbehebungen und neue Funktionen

## Übersicht der Änderungen

| # | Problem | Ursache | Lösung |
|---|---------|---------|--------|
| 1 | Veranstaltungsplanung Archiv fehlt | Keine `is_archived` Spalte | Migration + Archiv-UI erstellen |
| 2 | News Task-Erstellung Fehler | `category` wird als UUID statt Text gespeichert | Kategorie-Name statt ID verwenden |
| 3 | Aufgaben-Checkbox instabil | Race Condition + fehlende Fehlerbehandlung | Optimistisches Update + bessere Fehlerbehandlung |
| 4 | Alle sehen alle Aufgaben | Nur Tenant-Filter, kein User-Filter | Frontend-Filter für eigene/zugewiesene Tasks |
| 5 | HTML in Task-Beschreibung | Beschreibung enthält HTML absichtlich | RichTextDisplay in TasksView verwenden |
| 6 | Jour Fixe nicht bearbeitbar | Keine Bearbeitungsfunktion + nur eigene Meetings | Edit-Dialog + Teilnehmer-Filter hinzufügen |
| 7 | Notizen aufteilen fehlt | Funktion nicht implementiert | "In Einzelnotizen aufteilen" im Menü |

---

## 1. Veranstaltungsplanung Archiv

### Datenbankänderung
```sql
ALTER TABLE event_plannings ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE event_plannings ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
```

### Code-Änderungen in `EventPlanningView.tsx`

**a) State für Archiv hinzufügen:**
```typescript
const [showArchive, setShowArchive] = useState(false);
const [archivedPlannings, setArchivedPlannings] = useState<EventPlanning[]>([]);
```

**b) Archiv-Funktionen:**
```typescript
const archivePlanning = async (planningId: string) => {
  const planning = plannings.find(p => p.id === planningId);
  if (planning?.user_id !== user?.id) {
    toast({ title: "Keine Berechtigung", variant: "destructive" });
    return;
  }
  
  const { error } = await supabase
    .from("event_plannings")
    .update({ is_archived: true, archived_at: new Date().toISOString() })
    .eq("id", planningId)
    .eq("user_id", user?.id);
    
  if (!error) {
    toast({ title: "Planung archiviert" });
    fetchPlannings();
  }
};

const restorePlanning = async (planningId: string) => {
  const { error } = await supabase
    .from("event_plannings")
    .update({ is_archived: false, archived_at: null })
    .eq("id", planningId)
    .eq("user_id", user?.id);
    
  if (!error) {
    toast({ title: "Planung wiederhergestellt" });
    fetchPlannings();
    fetchArchivedPlannings();
  }
};
```

**c) Archiv-Button in UI:**
```typescript
<Button variant="outline" onClick={() => setShowArchive(true)}>
  <Archive className="h-4 w-4 mr-2" />
  Archiv
</Button>
```

**d) Archiv-Ansicht als Sheet/Dialog** (analog zu MeetingArchiveView)

---

## 2. News Task-Erstellung Fehler

### Problem
In `NewsToTaskDialog.tsx` Zeile 126:
```typescript
category: selectedCategory,  // selectedCategory ist eine UUID (Kategorie-ID)
```

Die `tasks.category` Spalte erwartet aber einen Text-String wie `'personal'`, `'legislation'`.

### Lösung in `NewsToTaskDialog.tsx`

```typescript
// Vorher:
const { data: categoriesData } = await supabase
  .from('todo_categories')  // Falsche Tabelle!
  .select('id, label')

// Nachher: task_categories verwenden
const { data: categoriesData } = await supabase
  .from('task_categories')
  .select('name, label')
  .eq('is_active', true)
  .order('order_index');

setCategories(categoriesData || []);

// Und beim Erstellen:
category: selectedCategory,  // selectedCategory ist jetzt der 'name' (z.B. 'personal')
```

---

## 3. Aufgaben-Checkbox instabil

### Problem
- `toggleTaskStatus` in `TasksView.tsx` führt Update durch, aber bei schnellen Klicks kann es zu Race Conditions kommen
- Archivierung und Löschung erfolgen sequentiell ohne Absicherung

### Lösung in `TasksView.tsx`

```typescript
const [processingTaskIds, setProcessingTaskIds] = useState<Set<string>>(new Set());

const toggleTaskStatus = async (taskId: string) => {
  // Verhindere doppelte Klicks
  if (processingTaskIds.has(taskId)) return;
  
  const task = tasks.find(t => t.id === taskId);
  if (!task || !user) return;

  const newStatus = task.status === "completed" ? "todo" : "completed";
  
  // Optimistisches Update
  setTasks(prev => prev.map(t => 
    t.id === taskId ? { ...t, status: newStatus } : t
  ));
  
  setProcessingTaskIds(prev => new Set(prev).add(taskId));
  
  try {
    const { error } = await supabase
      .from('tasks')
      .update({ 
        status: newStatus,
        progress: newStatus === "completed" ? 100 : task.progress || 0
      })
      .eq('id', taskId);

    if (error) throw error;

    if (newStatus === "completed") {
      // Archivieren
      await supabase.from('archived_tasks').insert({
        task_id: taskId,
        user_id: user.id,
        // ... weitere Felder
      });
      
      // Löschen
      await supabase.from('tasks').delete().eq('id', taskId);
      
      setShowUnicorn(true);
    }

    toast({ title: "Status aktualisiert" });
    loadTasks();
  } catch (error) {
    // Rollback bei Fehler
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: task.status } : t
    ));
    toast({ title: "Fehler", variant: "destructive" });
  } finally {
    setProcessingTaskIds(prev => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  }
};
```

---

## 4. Alle User sehen alle Aufgaben

### Problem
Die RLS-Policy erlaubt tenant-weiten Zugriff. Für Aufgaben sollten nur:
- Eigene Aufgaben (user_id = current_user)
- Zugewiesene Aufgaben (assigned_to enthält current_user)

sichtbar sein.

### Lösung in `TasksView.tsx`

```typescript
const loadTasks = async () => {
  if (!user) return;
  
  try {
    // Eigene Aufgaben + zugewiesene Aufgaben laden
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .or(`user_id.eq.${user.id},assigned_to.cs.{${user.id}}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    // ... Rest wie bisher
  } catch (error) {
    console.error('Error loading tasks:', error);
  }
};
```

Alternative: Filter im Frontend nach dem Laden:
```typescript
const filteredTasks = tasks.filter(task => 
  task.user_id === user.id || 
  (task.assignedTo && task.assignedTo.includes(user.id))
);
```

---

## 5. HTML in Task-Beschreibung aus Notizen

### Problem
Die Task-Beschreibung enthält HTML-Tags, die in der Anzeige roh dargestellt werden.

### Lösung in `TasksView.tsx`

Bei der Anzeige der Beschreibung `RichTextDisplay` verwenden:

```typescript
// Import hinzufügen
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";

// In der Task-Karte:
{task.description && (
  <RichTextDisplay 
    content={task.description} 
    className="text-sm text-muted-foreground line-clamp-2"
  />
)}
```

---

## 6. Jour Fixe Einstellungen bearbeitbar machen

### Problem
- Nur eigene Meetings werden geladen (`user_id = current_user`)
- Keine Bearbeitungsfunktion für existierende Meetings

### Lösung in `MeetingsView.tsx`

**a) Meetings laden inkl. Teilnehmer:**
```typescript
const loadMeetings = async () => {
  try {
    // 1. Meetings laden, wo User Ersteller ist
    const { data: ownMeetings } = await supabase
      .from('meetings')
      .select('*')
      .eq('user_id', user?.id)
      .neq('status', 'archived');
    
    // 2. Meetings laden, wo User Teilnehmer ist
    const { data: participantMeetings } = await supabase
      .from('meeting_participants')
      .select('meeting_id, meetings(*)')
      .eq('user_id', user?.id);
    
    // Kombinieren und Duplikate entfernen
    const allMeetingIds = new Set([
      ...(ownMeetings || []).map(m => m.id),
      ...(participantMeetings || []).map(p => p.meeting_id)
    ]);
    
    // ... Meetings zusammenführen
  } catch (error) {
    console.error('Error loading meetings:', error);
  }
};
```

**b) Edit-Dialog für Meetings hinzufügen:**
```typescript
const [editingMeetingDetails, setEditingMeetingDetails] = useState<Meeting | null>(null);
const [isEditMeetingOpen, setIsEditMeetingOpen] = useState(false);

const updateMeeting = async () => {
  if (!editingMeetingDetails?.id) return;
  
  const { error } = await supabase
    .from('meetings')
    .update({
      title: editingMeetingDetails.title,
      description: editingMeetingDetails.description,
      location: editingMeetingDetails.location,
    })
    .eq('id', editingMeetingDetails.id);
    
  if (!error) {
    toast({ title: "Meeting aktualisiert" });
    loadMeetings();
    setIsEditMeetingOpen(false);
  }
};
```

**c) Teilnehmer nachträglich hinzufügen:**
- `MeetingParticipantsManager` Komponente nutzen im Edit-Dialog

---

## 7. Notizen in Einzelnotizen aufteilen

### Konzept
Wenn eine Notiz Bullets/Listen enthält (z.B. `<li>` oder `- Text`), kann der User diese in separate Notizen aufteilen.

### Implementierung in `QuickNotesList.tsx`

**a) Funktion zum Aufteilen:**
```typescript
const splitNoteIntoBullets = async (note: QuickNote) => {
  if (!user) return;
  
  // HTML-Bullets erkennen
  const listItemRegex = /<li[^>]*>(.*?)<\/li>/gi;
  const dashBulletRegex = /^[-•*]\s+(.+)$/gm;
  
  let items: string[] = [];
  
  // HTML-Listen extrahieren
  let match;
  while ((match = listItemRegex.exec(note.content)) !== null) {
    const text = match[1].replace(/<[^>]*>/g, '').trim();
    if (text) items.push(text);
  }
  
  // Falls keine HTML-Listen, nach Dash-Bullets suchen
  if (items.length === 0) {
    const plainText = note.content.replace(/<[^>]*>/g, '');
    while ((match = dashBulletRegex.exec(plainText)) !== null) {
      if (match[1].trim()) items.push(match[1].trim());
    }
  }
  
  if (items.length <= 1) {
    toast.info("Keine Aufzählungspunkte gefunden");
    return;
  }
  
  // Neue Notizen erstellen
  const newNotes = items.map((content, index) => ({
    user_id: user.id,
    content,
    title: content.substring(0, 30) + (content.length > 30 ? '...' : ''),
    color: note.color,
    priority_level: note.priority_level,
  }));
  
  const { error } = await supabase
    .from('quick_notes')
    .insert(newNotes);
    
  if (!error) {
    // Original-Notiz optional löschen oder archivieren
    toast.success(`${items.length} Notizen erstellt`);
    loadNotes();
  }
};
```

**b) Menü-Eintrag hinzufügen:**
```typescript
<DropdownMenuItem onClick={() => splitNoteIntoBullets(note)}>
  <ListTree className="h-3 w-3 mr-2" />
  In Einzelnotizen aufteilen
</DropdownMenuItem>
```

---

## Zusammenfassung der Dateien

| Datei | Änderung |
|-------|----------|
| **Migration** | `is_archived`, `archived_at` Spalten für `event_plannings` |
| `EventPlanningView.tsx` | Archiv-Funktionen + Archiv-Button + Archiv-Dialog |
| `NewsToTaskDialog.tsx` | `task_categories` statt `todo_categories`, `name` statt `id` |
| `TasksView.tsx` | Race-Condition-Fix, User-Filter, RichTextDisplay |
| `MeetingsView.tsx` | Teilnehmer-basierte Meetings laden, Edit-Dialog |
| `QuickNotesList.tsx` | splitNoteIntoBullets Funktion + Menü-Eintrag |

---

## Technische Details

### Event Planning Archiv Flow
```text
┌─────────────────────────────────────────────────────────────┐
│ Aktive Planungen                                            │
│ ┌─────────────────┐  [Archivieren] → ┌─────────────────┐   │
│ │ Planung A       │ ─────────────────→│ Archiv          │   │
│ │ Planung B       │                   │ (is_archived)   │   │
│ └─────────────────┘  [Wiederherstellen] ← └─────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### News Task Kategorie Fix
```text
Vorher:                          Nachher:
todo_categories.id (UUID)   →    task_categories.name (text)
"ab12-cd34-..."             →    "personal"
```

### Aufgaben-Sichtbarkeit
```text
SELECT * FROM tasks
WHERE user_id = current_user         -- Eigene Aufgaben
   OR assigned_to LIKE '%user_id%'   -- Zugewiesene Aufgaben
```

---

## Geschätzter Aufwand

| Änderung | Zeit |
|----------|------|
| Event Planning Archiv | 30 Min |
| News Task Fix | 10 Min |
| Checkbox Stabilität | 15 Min |
| Task-Sichtbarkeit | 10 Min |
| HTML-Beschreibung | 5 Min |
| Jour Fixe Edit | 40 Min |
| Notizen aufteilen | 25 Min |
| **Gesamt** | **~135 Min** |
