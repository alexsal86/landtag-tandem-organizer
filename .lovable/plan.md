

# Plan: Meine Arbeit - Aufgabenansicht Verbesserungen

## Uebersicht der Aenderungen

| Aenderung | Beschreibung |
|-----------|--------------|
| Spalten tauschen | "Von mir erstellt" links, "Mir zugewiesen" rechts |
| Icon-Funktionalitaet | Aktions-Icons funktional machen (Dialoge statt Navigation) |
| Frist bearbeiten | Datum klickbar machen mit Kalender-Popover |
| Frist-Position | Unten rechts, beim Hover links neben Icons mit Trennstrich |

---

## 1. Spalten tauschen

**Datei:** `src/components/my-work/MyWorkTasksTab.tsx`

Die Reihenfolge der `renderTaskList` Aufrufe wird getauscht:

```text
Vorher:
[Mir zugewiesen]  |  [Von mir erstellt]

Nachher:
[Von mir erstellt]  |  [Mir zugewiesen]
```

**Aenderung in Zeilen 348-351:**
```typescript
// Vorher
{renderTaskList(assignedTasks, "Mir zugewiesen", ...)}
{renderTaskList(createdTasks, "Von mir erstellt", ...)}

// Nachher
{renderTaskList(createdTasks, "Von mir erstellt", ...)}
{renderTaskList(assignedTasks, "Mir zugewiesen", ...)}
```

---

## 2. Icon-Funktionalitaet implementieren

Aktuell navigieren die Icons zur Aufgaben-Seite. Stattdessen sollen sie Dialoge/Sidebars oeffnen, wie auf der Aufgaben-Seite.

### Neue States in MyWorkTasksTab:

```typescript
// Wiedervorlage
const [snoozeDialogOpen, setSnoozeDialogOpen] = useState(false);
const [snoozeTaskId, setSnoozeTaskId] = useState<string | null>(null);
const [snoozeDate, setSnoozeDate] = useState<string>("");

// Zuweisung
const [assignDialogOpen, setAssignDialogOpen] = useState(false);
const [assignTaskId, setAssignTaskId] = useState<string | null>(null);

// Kommentare
const [commentSidebarOpen, setCommentSidebarOpen] = useState(false);
const [commentTaskId, setCommentTaskId] = useState<string | null>(null);

// Entscheidung
const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
const [decisionTaskId, setDecisionTaskId] = useState<string | null>(null);

// Dokumente
const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
const [documentTaskId, setDocumentTaskId] = useState<string | null>(null);
```

### Handler-Funktionen:

```typescript
// Wiedervorlage - Snooze setzen
const handleReminder = (taskId: string) => {
  setSnoozeTaskId(taskId);
  setSnoozeDialogOpen(true);
};

const handleSetSnooze = async (date: Date) => {
  if (!snoozeTaskId || !user) return;
  
  await supabase.from("task_snoozes").upsert({
    user_id: user.id,
    task_id: snoozeTaskId,
    snoozed_until: date.toISOString()
  });
  
  toast({ title: "Wiedervorlage gesetzt", ... });
  setSnoozeDialogOpen(false);
  setSnoozeTaskId(null);
};

// Zuweisung aendern
const handleAssign = (taskId: string) => {
  setAssignTaskId(taskId);
  setAssignDialogOpen(true);
};

// Kommentare anzeigen
const handleComment = (taskId: string) => {
  setCommentTaskId(taskId);
  setCommentSidebarOpen(true);
};

// Entscheidung erstellen
const handleDecision = (taskId: string) => {
  setDecisionTaskId(taskId);
  setDecisionDialogOpen(true);
};

// Dokumente
const handleDocuments = (taskId: string) => {
  setDocumentTaskId(taskId);
  setDocumentDialogOpen(true);
};
```

### Dialoge hinzufuegen:

**a) Wiedervorlage-Dialog (Kalender-Popover)**
```typescript
<Dialog open={snoozeDialogOpen} onOpenChange={setSnoozeDialogOpen}>
  <DialogContent className="sm:max-w-[350px]">
    <DialogHeader>
      <DialogTitle>Wiedervorlage setzen</DialogTitle>
    </DialogHeader>
    <Calendar
      mode="single"
      selected={snoozeDate ? new Date(snoozeDate) : undefined}
      onSelect={(date) => date && handleSetSnooze(date)}
      locale={de}
    />
  </DialogContent>
</Dialog>
```

**b) Zuweisungs-Dialog**
```typescript
<Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Aufgabe zuweisen</DialogTitle>
    </DialogHeader>
    <Select onValueChange={handleUpdateAssignee}>
      <SelectTrigger>
        <SelectValue placeholder="Person auswaehlen" />
      </SelectTrigger>
      <SelectContent>
        {users.map(user => (
          <SelectItem key={user.user_id} value={user.user_id}>
            {user.display_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </DialogContent>
</Dialog>
```

**c) Kommentar-Sidebar** - TaskDetailSidebar wiederverwenden oder einfache Kommentar-Liste

**d) Entscheidungs-Dialog** - TaskDecisionCreator wiederverwenden:
```typescript
{decisionTaskId && (
  <TaskDecisionCreator 
    taskId={decisionTaskId}
    isOpen={decisionDialogOpen}
    onOpenChange={setDecisionDialogOpen}
    onDecisionCreated={() => {
      setDecisionDialogOpen(false);
      setDecisionTaskId(null);
    }}
  />
)}
```

**e) Dokumente-Dialog** - Aehnlich wie in TaskDetailSidebar

---

## 3. Frist bearbeiten

### Neuer Handler in MyWorkTasksTab:

```typescript
const handleUpdateDueDate = async (taskId: string, newDate: Date | null) => {
  try {
    const { error } = await supabase
      .from("tasks")
      .update({ due_date: newDate?.toISOString() || null })
      .eq("id", taskId)
      .select();

    if (error) throw error;
    
    setAssignedTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, due_date: newDate?.toISOString() || null } : t
    ));
    setCreatedTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, due_date: newDate?.toISOString() || null } : t
    ));
    toast({ title: "Frist aktualisiert" });
  } catch (error) {
    toast({ title: "Fehler beim Speichern", variant: "destructive" });
  }
};
```

### Neue Props fuer TaskCard und TaskListRow:

```typescript
interface TaskCardProps {
  // ... existing props
  onUpdateDueDate?: (taskId: string, date: Date | null) => void;
}
```

---

## 4. Frist-Position aendern (TaskCard)

### Neues Layout-Verhalten:

```text
Standard (nicht hovern):
+------------------------------------------+
|  [✓] [Titel]                             |
|      [Beschreibung...]                   |
|                                          |
|  [■][■][■][■]              [05.02] [→]  |
+------------------------------------------+

Beim Hovern:
+------------------------------------------+
|  [✓] [Titel]                             |
|      [Beschreibung...]                   |
|                                          |
|  [Hoch][Status][...]  [05.02] | [🔔][👤][💬][📎] [→]  |
+------------------------------------------+
```

### Aenderung in TaskCard.tsx (Zeilen 198-250):

```typescript
{/* Bottom bar with badges and actions */}
<div className="px-3 pb-2 flex items-center justify-between">
  {/* Left: Badges */}
  <div className="flex-1">
    {/* Badges wie bisher */}
  </div>

  {/* Right: Due date + Actions + Navigate */}
  <div className="flex items-center gap-1">
    {/* Frist - IMMER sichtbar, aber Position aendert sich */}
    {task.due_date && (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 px-2 text-xs",
              getDueDateColor(task.due_date)
            )}
          >
            <Calendar className="h-3 w-3 mr-1" />
            {format(new Date(task.due_date), "dd.MM.", { locale: de })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={new Date(task.due_date)}
            onSelect={(date) => onUpdateDueDate?.(task.id, date || null)}
            locale={de}
          />
        </PopoverContent>
      </Popover>
    )}

    {/* Trennstrich - nur bei Hover */}
    <Separator 
      orientation="vertical" 
      className="h-4 mx-1 opacity-0 group-hover:opacity-100 transition-opacity" 
    />

    {/* Action icons - bei Hover */}
    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <TaskActionIcons ... />
    </div>
    
    {/* Navigate button */}
    <Button variant="ghost" size="icon" ...>
      <ExternalLink className="h-3 w-3" />
    </Button>
  </div>
</div>
```

---

## 5. Frist-Position aendern (TaskListRow)

Aehnliche Logik wie bei TaskCard:

```typescript
{/* Due date + Separator + Actions */}
<div className="flex items-center gap-1 flex-shrink-0">
  {/* Frist */}
  <Popover>
    <PopoverTrigger asChild>
      <button className={cn("flex items-center gap-1 text-xs", getDueDateColor(task.due_date))}>
        <Calendar className="h-3 w-3" />
        {task.due_date ? format(new Date(task.due_date), "dd.MM.", { locale: de }) : "–"}
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0">
      <Calendar ... />
    </PopoverContent>
  </Popover>

  {/* Trennstrich - nur bei Hover */}
  <Separator 
    orientation="vertical" 
    className="h-4 mx-1 opacity-0 group-hover:opacity-100 transition-opacity" 
  />

  {/* Actions - bei Hover */}
  <div className="opacity-0 group-hover:opacity-100 ...">
    <TaskActionIcons ... />
  </div>
</div>
```

---

## Zusammenfassung der Dateiaenderungen

| Datei | Aenderung |
|-------|-----------|
| `src/components/my-work/MyWorkTasksTab.tsx` | Spalten tauschen, neue States/Handler, Dialoge hinzufuegen |
| `src/components/tasks/TaskCard.tsx` | Frist-Position, Popover fuer Datum, onUpdateDueDate prop |
| `src/components/tasks/TaskListRow.tsx` | Frist-Position, Popover fuer Datum, onUpdateDueDate prop |

## Neue Importe

```typescript
// MyWorkTasksTab.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskDecisionCreator } from "@/components/task-decisions/TaskDecisionCreator";

// TaskCard.tsx / TaskListRow.tsx
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
```

