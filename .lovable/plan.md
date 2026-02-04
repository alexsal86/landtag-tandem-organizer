
# Plan: Verbesserungen fuer Jour Fixe, Aufgaben und Planungen

## Uebersicht der Aenderungen

| # | Anforderung | Loesung |
|---|-------------|---------|
| 1 | Dynamische Punkte ohne Card-Rahmen | SystemAgendaItem mit Card-Wrapper auch im embedded-Mode |
| 2 | Farbliche Kennzeichnung fuer dynamische Punkte | Farbiger linker Rand (Blau fuer Termine, Amber fuer Notizen, Gruen fuer Aufgaben) |
| 3 | Dynamische Punkte als eigenstaendige navigierbare Items im Fokus-Mode | Einzelne Notizen/Termine/Aufgaben als Sub-Items mit eigener Checkbox |
| 4 | Aufgabe auf Tagesordnung setzen (Icon in MyWork) | Neues Icon in TaskActionIcons + Meeting-Selector Dialog |
| 5 | Dynamischer Bereich "Aufgaben" in Agenda | Neuer system_type "tasks" mit aehnlicher Logik wie quick_notes |
| 6 | HTML in Aufgaben-Beschreibung rendern | RichTextDisplay fuer Aufgaben in Agenda verwenden |
| 7 | "Erledigt"-Button fuer Planungen | Neues Feld is_completed + UI mit Durchstreichung |

---

## 1. SystemAgendaItem mit konsistentem Card-Wrapper

**Problem:** Im embedded-Mode (`isEmbedded=true`) fehlt der Card-Wrapper, wodurch die dynamischen Punkte anders aussehen als normale Agenda-Punkte.

**Aenderung in `SystemAgendaItem.tsx`:**

```typescript
// Embedded Mode: Mit Card-Wrapper wie normale Agenda-Punkte
if (isEmbedded) {
  return (
    <Card className={cn(
      "border-l-4",
      systemType === 'upcoming_appointments' ? "border-l-blue-500" : 
      systemType === 'quick_notes' ? "border-l-amber-500" :
      systemType === 'tasks' ? "border-l-green-500" : "border-l-muted",
      className
    )}>
      <CardContent className="p-3">
        {/* Content je nach systemType */}
      </CardContent>
    </Card>
  );
}
```

---

## 2. Farbliche Kennzeichnung der dynamischen Punkte

**Farbschema:**
- **Kommende Termine:** Blau (`border-l-blue-500`, `bg-blue-50`)
- **Meine Notizen:** Amber (`border-l-amber-500`, `bg-amber-50`)
- **Aufgaben:** Gruen (`border-l-green-500`, `bg-green-50`)

**Aenderungen:**
- `SystemAgendaItem.tsx`: Konsistente Farblogik in allen Modi
- `FocusModeView.tsx`: Farbige Raender fuer System-Items
- `MeetingsView.tsx`: Farbige Raender bei Sub-Items

---

## 3. Einzelne Items als navigierbare Sub-Items

**Aktuelles Problem:** Im Fokus-Mode werden "Meine Notizen" und "Kommende Termine" als ein Block behandelt. Man kann nicht einzelne Notizen oder Termine im Fokus-Mode markieren.

**Loesung:** Jede einzelne Notiz/Termin/Aufgabe wird als eigenstaendiger Sub-Item in der Navigation behandelt.

### 3.1 Datenbankstruktur (optional - fuer persistente Markierung)

```sql
-- Optional: Tabelle fuer markierte System-Items pro Meeting
CREATE TABLE meeting_system_item_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- 'quick_note', 'appointment', 'task'
  item_id UUID NOT NULL, -- Referenz auf quick_notes.id, appointments.id, tasks.id
  is_completed BOOLEAN DEFAULT false,
  result_text TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 FocusModeView.tsx Anpassungen

**Neue Logik fuer Navigation:**

```typescript
// Erweitere allNavigableItems um einzelne System-Items
const allNavigableItems: NavigableItem[] = useMemo(() => {
  const result: NavigableItem[] = [];
  
  mainItems.forEach((mainItem) => {
    result.push({ item: mainItem, isSubItem: false, ... });
    
    // Regulaere Sub-Items
    const subItems = agendaItems.filter(sub => sub.parent_id === mainItem.id && !sub.system_type);
    subItems.forEach(subItem => {
      result.push({ item: subItem, isSubItem: true, ... });
    });
    
    // System Sub-Items als einzelne navigierbare Items
    if (mainItem.system_type === 'quick_notes') {
      linkedQuickNotes.forEach((note, noteIndex) => {
        result.push({
          item: {
            id: `note-${note.id}`,
            title: note.title || 'Notiz',
            is_completed: noteCompletionStatus[note.id] || false,
            system_type: 'quick_note_item',
            sourceId: note.id,
          },
          isSubItem: true,
          parentItem: mainItem,
          isSystemSubItem: true,
        });
      });
    }
    
    // Aehnlich fuer upcoming_appointments und tasks
  });
  
  return result;
}, [agendaItems, linkedQuickNotes, linkedTasks, appointments]);
```

**Rendering fuer System-Sub-Items:**

```typescript
// Im renderNavigableItem:
if (item.system_type === 'quick_note_item') {
  return (
    <div className="flex items-start gap-4 p-4 rounded-lg border border-l-4 border-l-amber-500">
      <Checkbox 
        checked={item.is_completed}
        onCheckedChange={(checked) => toggleSystemItemComplete(item.sourceId, 'quick_note', checked)}
      />
      <div>
        <span className="font-medium">{item.title}</span>
        <RichTextDisplay content={note.content} className="text-sm text-muted-foreground" />
      </div>
    </div>
  );
}
```

---

## 4. Aufgabe auf Tagesordnung setzen (Icon in MyWork)

### 4.1 TaskActionIcons.tsx erweitern

```typescript
interface TaskActionIconsProps {
  // ... bestehende Props
  onAddToMeeting?: (taskId: string) => void;
  hasMeetingLink?: boolean;
}

// Neues Icon hinzufuegen:
{onAddToMeeting && (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-6 w-6 hover:bg-muted/80 rounded-full",
          hasMeetingLink && "text-purple-600"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onAddToMeeting(taskId);
        }}
      >
        <CalendarDays className="h-3 w-3" />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="top">Jour Fixe</TooltipContent>
  </Tooltip>
)}
```

### 4.2 Neue Komponente: TaskMeetingSelector.tsx

```typescript
// Aehnlich wie MeetingSelectorDialog fuer Quick Notes
interface TaskMeetingSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (meetingId: string, meetingTitle: string) => void;
  onMarkForNextJourFixe: () => void;
}

export function TaskMeetingSelector({ ... }) {
  // Lade verfuegbare Meetings
  // Zeige Liste mit Option "Fuer naechsten Jour Fixe vormerken"
}
```

### 4.3 Tasks-Tabelle erweitern (optional)

```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pending_for_jour_fixe BOOLEAN DEFAULT false;
```

### 4.4 MyWorkTasksTab.tsx anpassen

```typescript
// Neue Handler:
const handleAddToMeeting = (taskId: string) => {
  setMeetingTaskId(taskId);
  setMeetingSelectorOpen(true);
};

const addTaskToMeeting = async (taskId: string, meetingId: string) => {
  // 1. Task mit meeting_id verknuepfen
  await supabase.from('tasks').update({ meeting_id: meetingId }).eq('id', taskId);
  
  // 2. Optional: Als Agenda-Item einfuegen (wie in MeetingsView.addTaskToAgenda)
  toast.success("Aufgabe zum Jour Fixe hinzugefuegt");
};

// In TaskCard:
<TaskCard
  ...
  onAddToMeeting={handleAddToMeeting}
/>
```

---

## 5. Dynamischer Bereich "Aufgaben" in Agenda

### 5.1 Neuer system_type: 'tasks'

**In Meeting-Templates konfigurierbar:**
- "Meine Notizen" (quick_notes)
- "Kommende Termine" (upcoming_appointments)
- "Aufgaben" (tasks) **NEU**

### 5.2 SystemAgendaItem.tsx erweitern

```typescript
if (systemType === 'tasks') {
  return (
    <Card className={cn("border-l-4 border-l-green-500", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-green-500" />
            Aufgaben
            {linkedTasks.length > 0 && (
              <Badge variant="secondary">{linkedTasks.length}</Badge>
            )}
          </CardTitle>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            System
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {linkedTasks.length > 0 ? (
          <div className="space-y-2">
            {linkedTasks.map((task) => (
              <div key={task.id} className="p-3 bg-muted/50 rounded-md">
                <h4 className="font-semibold text-sm mb-1">{task.title}</h4>
                {/* HTML-Rendering mit RichTextDisplay */}
                <RichTextDisplay content={task.description} className="text-sm" />
                {task.due_date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Frist: {format(new Date(task.due_date), "dd.MM.yyyy", { locale: de })}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Keine Aufgaben fuer dieses Meeting vorhanden.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

### 5.3 MeetingsView.tsx: Aufgaben laden

```typescript
// Neue State-Variable:
const [linkedTasks, setLinkedTasks] = useState<any[]>([]);

// Im useEffect fuer Meeting-Laden:
const loadLinkedTasks = async (meetingId: string) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, description, due_date, priority, status')
    .eq('meeting_id', meetingId)
    .neq('status', 'completed');
  
  if (!error) setLinkedTasks(data || []);
};
```

### 5.4 Aufgaben anderen Tagesordnungspunkten zuordnen

**Im Aufgaben-Bereich: Drag-and-Drop oder Kontext-Menue**

```typescript
// Dropdown im Aufgaben-Card:
<DropdownMenu>
  <DropdownMenuTrigger>
    <Button variant="ghost" size="sm">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => reassignTaskToAgendaItem(task.id, targetAgendaItemId)}>
      Anderem Tagesordnungspunkt zuordnen
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## 6. HTML in Aufgaben-Beschreibung rendern

**Problem:** Task-Beschreibungen mit HTML werden als roher Text angezeigt.

**Loesung:** `RichTextDisplay` verwenden.

**Aenderungen:**

1. **MeetingsView.tsx** (beim Anzeigen von Task-Agenda-Items):
```typescript
// Statt:
<p className="text-muted-foreground mb-3">{item.description}</p>

// Neu:
<RichTextDisplay content={item.description} className="text-muted-foreground mb-3 text-sm" />
```

2. **FocusModeView.tsx**:
```typescript
// Bei task_id Items:
{item.description && (
  <RichTextDisplay content={item.description} className="text-muted-foreground mt-2" />
)}
```

---

## 7. "Erledigt"-Button fuer Planungen

### 7.1 Datenbankschema erweitern

```sql
ALTER TABLE event_plannings ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;
ALTER TABLE event_plannings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
```

### 7.2 UI in EventPlanningView.tsx

**Neuer Button neben Archivieren:**

```typescript
// In der Karten-/Listenansicht:
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8",
          planning.is_completed && "text-green-600"
        )}
        onClick={(e) => {
          e.stopPropagation();
          togglePlanningCompleted(planning.id, !planning.is_completed);
        }}
      >
        <CheckCircle className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      {planning.is_completed ? "Als unerledigt markieren" : "Als erledigt markieren"}
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

**Durchstreichung des Titels:**

```typescript
<span className={cn(
  "font-medium",
  planning.is_completed && "line-through text-muted-foreground"
)}>
  {planning.title}
</span>
```

### 7.3 Handler-Funktion

```typescript
const togglePlanningCompleted = async (planningId: string, isCompleted: boolean) => {
  try {
    const { error } = await supabase
      .from('event_plannings')
      .update({ 
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null
      })
      .eq('id', planningId)
      .select();

    if (error) throw error;
    
    toast({
      title: isCompleted ? "Planung als erledigt markiert" : "Markierung entfernt",
    });
    
    fetchEventPlannings();
  } catch (error) {
    console.error('Error toggling completed:', error);
    toast({
      title: "Fehler",
      variant: "destructive",
    });
  }
};
```

---

## Zusammenfassung der Dateiänderungen

| Datei | Aenderungen |
|-------|-------------|
| **Migration** | `is_completed` + `completed_at` fuer `event_plannings`, optional `meeting_id` + `pending_for_jour_fixe` fuer `tasks` |
| **`SystemAgendaItem.tsx`** | Card-Wrapper im embedded-Mode, neuer system_type "tasks", konsistente Farblogik |
| **`FocusModeView.tsx`** | Einzelne Notizen/Termine/Aufgaben als navigierbare Items, RichTextDisplay fuer Beschreibungen |
| **`MeetingsView.tsx`** | linkedTasks laden, RichTextDisplay fuer task descriptions |
| **`TaskActionIcons.tsx`** | Neues Icon `onAddToMeeting` |
| **`MyWorkTasksTab.tsx`** | Meeting-Selector Dialog, Handler fuer Aufgabe-zu-Meeting |
| **Neu: `TaskMeetingSelector.tsx`** | Dialog zur Meeting-Auswahl (aehnlich wie bei Quick Notes) |
| **`EventPlanningView.tsx`** | "Erledigt"-Button, Durchstreichung, Handler |

---

## Technisches Flowchart: Aufgabe zur Agenda hinzufuegen

```text
+------------------+     +---------------------+     +------------------+
| MyWork Tasks Tab |---->| TaskMeetingSelector |---->| MeetingsView     |
| [Jour Fixe Icon] |     | - Meeting waehlen   |     | - Als Agenda-Item|
|                  |     | - Vormerken Option  |     | - Oder zum Pool  |
+------------------+     +---------------------+     +------------------+
                                  |
                                  v
                         +------------------+
                         | tasks Tabelle    |
                         | meeting_id = X   |
                         | oder             |
                         | pending_for_jf   |
                         +------------------+
```

---

## Optionale Erweiterungen

1. **Filter in der Agenda:** Erledigten Aufgaben ausblenden
2. **Drag-and-Drop:** Aufgaben zwischen Tagesordnungspunkten verschieben
3. **Batch-Zuweisung:** Mehrere Aufgaben gleichzeitig zuweisen
4. **Erinnerungen:** Aufgaben-Faelligkeit im Meeting hervorheben
