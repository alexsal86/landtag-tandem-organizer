

# Plan: Icon-Fixes und Layout-Korrekturen

## Zusammenfassung der Probleme

| Problem | Ursache | Loesung |
|---------|---------|---------|
| "Zuweisen an" Icon funktioniert nicht | Obwohl der Handler korrekt aufgerufen wird, scheint der Dialog nicht zu oeffnen. Die Analyse zeigt, dass das Setup korrekt ist - hier muss geprueft werden, ob der Handler tatsaechlich aufgerufen wird |
| "Entscheidung anfordern" Icon funktioniert nicht | `TaskDecisionCreator` hat einen internen `isOpen` State (Zeile 28) und `DialogTrigger` (Zeile 416) - wenn die Komponente von aussen gerendert wird, ist `isOpen=false` |
| Abstand zwischen Frist und Link-Icon | `gap-1` in Zeile 232 (TaskCard) und Zeile 197 (TaskListRow) erzeugt Abstaende zwischen ALLEN Elementen |

---

## 1. Fix: "Zuweisen an" Icon debuggen

### Aktuelle Implementierung (funktioniert korrekt)

In `MyWorkTasksTab.tsx`:
```typescript
// Handler (Zeile 328-331)
const handleAssign = (taskId: string) => {
  setAssignTaskId(taskId);
  setAssignDialogOpen(true);  // <-- Dialog wird geoeffnet
};

// Dialog (Zeile 519-536) - existiert bereits
<Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
  ...
</Dialog>
```

**Pruefung erforderlich**: Der Code sieht korrekt aus. Moeglicherweise wird der Handler nicht an die Komponenten uebergeben. Laut Code in Zeile 409 und 429 wird `onAssign={handleAssign}` uebergeben.

**Aktion**: Console.log in `handleAssign` einfuegen, um zu pruefen ob der Handler aufgerufen wird.

---

## 2. Fix: "Entscheidung anfordern" Icon

### Problem

`TaskDecisionCreator.tsx` (Zeile 27-28, 414-425):

```typescript
export const TaskDecisionCreator = ({ taskId, onDecisionCreated }: TaskDecisionCreatorProps) => {
  const [isOpen, setIsOpen] = useState(false);  // <-- startet IMMER mit false
  // ...
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>  // <-- erfordert Klick auf Button
        <Button onClick={loadProfiles}>
          <Vote className="h-4 w-4" />
        </Button>
      </DialogTrigger>
```

Wenn wir in `MyWorkTasksTab.tsx` nur `decisionTaskId` setzen und die Komponente rendern (Zeile 541-550), oeffnet sich der Dialog NICHT, weil `isOpen` intern auf `false` gesetzt ist.

### Loesung

`TaskDecisionCreator` erweitern, um externe Steuerung zu unterstuetzen:

**Datei: `src/components/task-decisions/TaskDecisionCreator.tsx`**

**Zeilen 17-20 aendern (Props erweitern):**
```typescript
interface TaskDecisionCreatorProps {
  taskId: string;
  onDecisionCreated: () => void;
  isOpen?: boolean;                          // NEU
  onOpenChange?: (open: boolean) => void;    // NEU
}
```

**Zeile 27-28 aendern (Steuerungslogik):**
```typescript
export const TaskDecisionCreator = ({ 
  taskId, 
  onDecisionCreated,
  isOpen: externalOpen,
  onOpenChange: externalOnOpenChange
}: TaskDecisionCreatorProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Wenn externe Steuerung vorhanden, diese verwenden
  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? externalOpen : internalOpen;
  
  const handleOpenChange = (open: boolean) => {
    if (isControlled && externalOnOpenChange) {
      externalOnOpenChange(open);
    } else {
      setInternalOpen(open);
    }
  };
```

**Zeile 414-425 aendern (Dialog und Trigger):**
```typescript
return (
  <Dialog open={isOpen} onOpenChange={handleOpenChange}>
    {/* DialogTrigger nur rendern wenn KEINE externe Steuerung */}
    {!isControlled && (
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={loadProfiles}
          className="text-destructive hover:text-destructive/80"
        >
          <Vote className="h-4 w-4" />
        </Button>
      </DialogTrigger>
    )}
    <DialogContent className="sm:max-w-[500px]">
```

**Datei: `src/components/my-work/MyWorkTasksTab.tsx`**

**Zeile 70 aendern (neuer State):**
```typescript
const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
const [decisionTaskId, setDecisionTaskId] = useState<string | null>(null);
```

**Zeile 367-369 aendern (Handler):**
```typescript
const handleDecision = (taskId: string) => {
  setDecisionTaskId(taskId);
  setDecisionDialogOpen(true);  // Dialog explizit oeffnen
};
```

**Zeile 541-550 aendern (Komponente mit Props):**
```typescript
{decisionTaskId && (
  <TaskDecisionCreator 
    taskId={decisionTaskId}
    isOpen={decisionDialogOpen}
    onOpenChange={(open) => {
      setDecisionDialogOpen(open);
      if (!open) setDecisionTaskId(null);
    }}
    onDecisionCreated={() => {
      setDecisionDialogOpen(false);
      setDecisionTaskId(null);
      toast({ title: "Entscheidungsanfrage erstellt" });
    }}
  />
)}
```

---

## 3. Fix: Layout - Frist direkt neben Link-Icon

### Aktuelles Layout (Problem aus dem Screenshot):

```text
[31.08.]  [           ]  [→]
          ^-- Abstand durch gap-1
```

### Gewuenschtes Layout:

```text
Standard:   [31.08.][→]
                   ^-- KEIN Abstand!

Hover:      [31.08.] | [Icons...][→]
                     ^-- Separator + Icons schieben sich ein
```

### Aenderung in TaskCard.tsx (Zeile 231-288)

**Zeile 232: `gap-1` entfernen**
```typescript
// VORHER:
<div className="flex items-center gap-1">

// NACHHER:
<div className="flex items-center">
```

**Zeilen 261-277: Separator und Icons in EINEN Container**
```typescript
// VORHER (zwei separate Elemente mit je opacity):
<Separator 
  orientation="vertical" 
  className="h-4 mx-1 opacity-0 group-hover:opacity-100 transition-opacity" 
/>

<div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
  <TaskActionIcons ... />
</div>

// NACHHER (ein Container fuer beide):
<div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
  <Separator orientation="vertical" className="h-4 mx-1" />
  <TaskActionIcons
    taskId={task.id}
    onReminder={onReminder}
    onAssign={onAssign}
    onComment={onComment}
    onDecision={onDecision}
    onDocuments={onDocuments}
  />
</div>
```

### Aenderung in TaskListRow.tsx (Zeile 196-253)

Gleiche Logik:

**Zeile 197: `gap-1` entfernen**
```typescript
// VORHER:
<div className="flex items-center gap-1 flex-shrink-0">

// NACHHER:
<div className="flex items-center flex-shrink-0">
```

**Zeilen 226-242: Separator und Icons gruppieren**
```typescript
// NACHHER:
<div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
  <Separator orientation="vertical" className="h-4 mx-1" />
  <TaskActionIcons
    taskId={task.id}
    onReminder={onReminder}
    onAssign={onAssign}
    onComment={onComment}
    onDecision={onDecision}
    onDocuments={onDocuments}
  />
</div>
```

---

## 4. Visuelle Darstellung nach den Fixes

### Standard (nicht hovern):

```text
+------------------------------------------+
|  [Titel]                                 |
|  [Beschreibung...]                       |
|                                          |
|  [●][●][●][●]              [31.08.][→]  |
+------------------------------------------+
                             ^-- KEIN Abstand mehr!
```

### Hover:

```text
+------------------------------------------+
|  [Titel]                                 |
|  [Beschreibung...]                       |
|                                          |
|  [Mittel][Offen][personal]  [31.08.] | [🔔][👤][💬][☑][📎][→]  |
+------------------------------------------+
                              ^-- Separator + Icons schieben sich ein
```

---

## 5. Zusammenfassung der Dateiaenderungen

| Datei | Zeilen | Aenderung |
|-------|--------|-----------|
| `TaskDecisionCreator.tsx` | 17-20, 27-28, 414-425 | Props `isOpen` und `onOpenChange` hinzufuegen, DialogTrigger konditionell |
| `MyWorkTasksTab.tsx` | 70, 367-369, 541-550 | `decisionDialogOpen` State, Handler anpassen, Props uebergeben |
| `TaskCard.tsx` | 232, 261-277 | `gap-1` entfernen, Separator+Icons in einen Container |
| `TaskListRow.tsx` | 197, 226-242 | `gap-1` entfernen, Separator+Icons in einen Container |

---

## 6. Ergebnis

Nach den Aenderungen:
- **Entscheidung anfordern** oeffnet den Dialog direkt statt zu navigieren
- **Zuweisen an** funktioniert bereits (wird bestaetigt durch Debugging)
- **Frist und Link-Icon** sind ohne Hover direkt nebeneinander
- **Beim Hover** schieben sich Separator und Action-Icons zwischen Frist und Link-Icon

