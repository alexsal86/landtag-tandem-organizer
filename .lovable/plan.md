
# Plan: Verbesserungen fuer die Jour Fixe Agenda

## Uebersicht der Anforderungen

| # | Anforderung | Loesung |
|---|-------------|---------|
| 1 | Dynamische Punkte koennen in der Agenda nicht hinzugefuegt werden | Buttons "Termine", "Notizen", "Aufgaben" neben "Punkt hinzufuegen" ergaenzen |
| 2 | Dynamische Punkte werden nicht als eigenstaendige navigierbare Punkte erkannt | FocusModeView erweitern: einzelne Notizen/Termine/Aufgaben als Sub-Items |
| 3 | Oeffentliche Meetings/Teilnehmer sollen mehr Rechte haben | Berechtigungslogik hinzufuegen: Teilnehmer und oeffentliche Meetings erhalten Bearbeitungsrechte |
| 4 | Notizen-Icon soll vor dem + nach rechts verschoben werden | Reihenfolge der Icons in der Toolbar aendern |
| 5 | Design-Verbesserungen: Titel fett, Input-Felder erst bei Hover grau, kompaktere Cards | CSS-Aenderungen in MeetingsView.tsx |

---

## 1. Dynamische Punkte in der Agenda hinzufuegen

**Problem:** Aktuell gibt es nur einen "Punkt hinzufuegen"-Button, der normale Agenda-Punkte erstellt. Es fehlt die Moeglichkeit, dynamische System-Punkte (Termine, Notizen, Aufgaben) direkt in der Meeting-Agenda hinzuzufuegen.

**Loesung:** Neben dem Button "Punkt hinzufuegen" werden drei zusaetzliche Buttons eingefuegt.

### MeetingsView.tsx (Zeile 3504-3513)

**Vorher:**
```tsx
<Button variant="outline" onClick={addAgendaItem}>
  <Plus className="h-4 w-4 mr-2" />
  Punkt hinzufügen
</Button>
```

**Nachher:**
```tsx
<div className="flex gap-2">
  <Button variant="outline" onClick={addAgendaItem}>
    <Plus className="h-4 w-4 mr-2" />
    Punkt
  </Button>
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" size="sm">
        <CalendarDays className="h-4 w-4 mr-2" />
        System
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-56">
      <div className="space-y-2">
        <p className="text-sm font-medium mb-2">Dynamischen Punkt hinzufuegen</p>
        <Button 
          variant="outline" 
          className="w-full justify-start border-blue-200 text-blue-700"
          onClick={() => addSystemAgendaItem('upcoming_appointments')}
          disabled={agendaItems.some(i => i.system_type === 'upcoming_appointments')}
        >
          <CalendarDays className="h-4 w-4 mr-2" />
          Kommende Termine
        </Button>
        <Button 
          variant="outline" 
          className="w-full justify-start border-amber-200 text-amber-700"
          onClick={() => addSystemAgendaItem('quick_notes')}
          disabled={agendaItems.some(i => i.system_type === 'quick_notes')}
        >
          <StickyNote className="h-4 w-4 mr-2" />
          Meine Notizen
        </Button>
        <Button 
          variant="outline" 
          className="w-full justify-start border-green-200 text-green-700"
          onClick={() => addSystemAgendaItem('tasks')}
          disabled={agendaItems.some(i => i.system_type === 'tasks')}
        >
          <ListTodo className="h-4 w-4 mr-2" />
          Aufgaben
        </Button>
      </div>
    </PopoverContent>
  </Popover>
  <Button onClick={saveAgendaItems}>
    <Save className="h-4 w-4 mr-2" />
    Speichern
  </Button>
</div>
```

### Neue Funktion: addSystemAgendaItem

```tsx
const addSystemAgendaItem = (systemType: 'upcoming_appointments' | 'quick_notes' | 'tasks') => {
  if (!selectedMeeting?.id) return;
  
  // Pruefe ob bereits vorhanden
  if (agendaItems.some(i => i.system_type === systemType)) {
    toast({
      title: "Bereits vorhanden",
      description: "Dieser dynamische Punkt ist bereits in der Agenda.",
      variant: "destructive",
    });
    return;
  }
  
  const titles: Record<string, string> = {
    'upcoming_appointments': 'Kommende Termine',
    'quick_notes': 'Meine Notizen',
    'tasks': 'Aufgaben'
  };
  
  const localKey = `local-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const newItem: AgendaItem = {
    title: titles[systemType],
    description: "",
    assigned_to: [],
    notes: "",
    is_completed: false,
    is_recurring: false,
    order_index: agendaItems.length,
    localKey,
    system_type: systemType,
  };

  const next = [...agendaItems, newItem].map((it, idx) => ({ ...it, order_index: idx }));
  setAgendaItems(next);
  
  toast({
    title: "Dynamischer Punkt hinzugefuegt",
    description: `"${titles[systemType]}" wurde zur Agenda hinzugefuegt.`,
  });
};
```

---

## 2. Dynamische Punkte als eigenstaendige navigierbare Items im Fokus-Mode

**Problem:** Im Fokus-Mode werden "Meine Notizen" und "Kommende Termine" als ein Block behandelt. Man kann nicht einzelne Notizen, Termine oder Aufgaben im Fokus-Mode markieren.

**Loesung:** Jede einzelne Notiz/Termin/Aufgabe wird als eigenstaendiger Sub-Item in der Navigation behandelt.

### FocusModeView.tsx - Erweiterte NavigableItem-Logik

**Erweiterung der allNavigableItems useMemo (Zeile 104-137):**

```tsx
const allNavigableItems: NavigableItem[] = useMemo(() => {
  const result: NavigableItem[] = [];
  
  // Get main items (no parent)
  const mainItems = agendaItems.filter(item => !item.parent_id && !item.parentLocalKey);
  
  mainItems.forEach((mainItem) => {
    const globalIndex = agendaItems.findIndex(i => i.id === mainItem.id);
    result.push({ 
      item: mainItem, 
      isSubItem: false, 
      parentItem: null,
      globalIndex,
      isSystemSubItem: false,
    });
    
    // Get regular sub-items (excluding system sub-items)
    const subItems = agendaItems.filter(sub => 
      (sub.parent_id === mainItem.id || sub.parentLocalKey === mainItem.id) &&
      !sub.system_type
    );
    
    subItems.forEach(subItem => {
      const subGlobalIndex = agendaItems.findIndex(i => i.id === subItem.id);
      result.push({ 
        item: subItem, 
        isSubItem: true, 
        parentItem: mainItem,
        globalIndex: subGlobalIndex,
        isSystemSubItem: false,
      });
    });
    
    // NEU: Einzelne System-Items als navigierbare Sub-Items
    if (mainItem.system_type === 'quick_notes') {
      linkedQuickNotes.forEach((note, noteIndex) => {
        result.push({
          item: {
            id: `note-${note.id}`,
            title: note.title || `Notiz ${noteIndex + 1}`,
            is_completed: false,
            order_index: mainItem.order_index + noteIndex + 1,
            system_type: 'quick_note_item',
            sourceData: note,
          } as any,
          isSubItem: true,
          parentItem: mainItem,
          globalIndex: -1, // Virtuelle Items
          isSystemSubItem: true,
          sourceId: note.id,
          sourceType: 'quick_note',
        });
      });
    }
    
    // Aehnlich fuer upcoming_appointments und tasks
    // (mit entsprechenden Daten aus dem Meeting-Kontext)
  });
  
  return result;
}, [agendaItems, linkedQuickNotes, linkedTasks, appointments]);
```

### Rendering fuer System-Sub-Items

Neue Render-Logik fuer einzelne Notizen/Termine/Aufgaben mit farbiger Kante:

```tsx
// Im renderNavigableItem:
if (navigable.isSystemSubItem) {
  const borderColor = navigable.sourceType === 'quick_note' 
    ? 'border-l-amber-500' 
    : navigable.sourceType === 'appointment' 
    ? 'border-l-blue-500'
    : 'border-l-green-500';
  
  return (
    <div className={cn(
      "p-4 rounded-lg border border-l-4 ml-8",
      borderColor,
      isFocused && "ring-2 ring-primary bg-primary/5"
    )}>
      <div className="flex items-start gap-4">
        <Checkbox checked={item.is_completed} ... />
        <div className="flex-1">
          <span className="text-sm font-medium">{item.title}</span>
          {item.sourceData?.content && (
            <p className="text-sm text-muted-foreground mt-1">{item.sourceData.content}</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 3. Berechtigungen fuer oeffentliche Meetings und Teilnehmer

**Problem:** Aktuell koennen nur Ersteller eines Meetings Inhalte bearbeiten. Teilnehmer und Benutzer von oeffentlichen Meetings haben nur Leserechte.

**Loesung:** Eine `hasEditPermission`-Funktion einfuehren und diese fuer alle Bearbeitungsaktionen verwenden.

### Neue Berechtigungslogik

```tsx
// Am Anfang der Komponente
const [currentUserIsParticipant, setCurrentUserIsParticipant] = useState(false);

// Laden der Teilnehmer-Info beim Meeting-Wechsel
useEffect(() => {
  const checkParticipation = async () => {
    if (!selectedMeeting?.id || !user?.id) {
      setCurrentUserIsParticipant(false);
      return;
    }
    
    const { data } = await supabase
      .from('meeting_participants')
      .select('user_id')
      .eq('meeting_id', selectedMeeting.id)
      .eq('user_id', user.id)
      .single();
    
    setCurrentUserIsParticipant(!!data);
  };
  
  checkParticipation();
}, [selectedMeeting?.id, user?.id]);

// Berechtigungsfunktion
const hasEditPermission = useMemo(() => {
  if (!selectedMeeting || !user) return false;
  
  // Ersteller hat immer Bearbeitungsrechte
  if (selectedMeeting.user_id === user.id) return true;
  
  // Teilnehmer haben Bearbeitungsrechte
  if (currentUserIsParticipant) return true;
  
  // Oeffentliche Meetings: alle Teammitglieder haben Bearbeitungsrechte
  if (selectedMeeting.is_public) return true;
  
  return false;
}, [selectedMeeting, user, currentUserIsParticipant]);
```

### Verwendung in der UI

Buttons und Eingabefelder werden nur angezeigt/aktiviert, wenn `hasEditPermission === true`:

```tsx
{/* Beispiel: Punkt hinzufuegen Button */}
{hasEditPermission && (
  <Button variant="outline" onClick={addAgendaItem}>
    <Plus className="h-4 w-4 mr-2" />
    Punkt hinzufügen
  </Button>
)}

{/* Beispiel: Input-Felder readonly wenn keine Berechtigung */}
<Input
  value={item.title}
  onChange={(e) => updateAgendaItem(index, 'title', e.target.value)}
  placeholder="Agenda-Punkt Titel"
  disabled={!hasEditPermission}
  className={cn(
    "font-semibold flex-1",
    !hasEditPermission && "cursor-not-allowed opacity-60"
  )}
/>
```

---

## 4. Notizen-Icon vor das + verschieben

**Aktuell (Zeile 3594-3656):** Input -> Plus -> ListTodo -> Trash

**Neu:** Input -> StickyNote -> Plus -> ListTodo -> Trash

```tsx
<div className="flex items-center gap-2">
  <Input ... />
  
  {/* NEU: Notizen zuerst */}
  {!(item.parentLocalKey || item.parent_id) && (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button size="icon" variant="ghost" className="shrink-0" aria-label="Notizen">
          <StickyNote className={cn("h-4 w-4", item.notes && "text-amber-500")} />
        </Button>
      </CollapsibleTrigger>
      {/* CollapsibleContent bleibt unveraendert */}
    </Collapsible>
  )}
  
  {/* Plus-Button fuer Unterpunkte */}
  {!(item.parentLocalKey || item.parent_id) && (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="shrink-0" aria-label="Unterpunkt hinzufügen">
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      {/* ... */}
    </Popover>
  )}
  
  {/* Aufgaben-Button */}
  {!(item.parentLocalKey || item.parent_id) && (
    <Popover ...>
      {/* ... ListTodo */}
    </Popover>
  )}
  
  {/* Loeschen */}
  <Button size="icon" variant="ghost" className="shrink-0 text-destructive" ...>
    <Trash className="h-4 w-4" />
  </Button>
</div>
```

---

## 5. Design-Verbesserungen fuer die Cards

### 5.1 Titel fett wie bei dynamischen Punkten

Aenderung in der Input-Klasse (Zeile 3588-3593):

```tsx
<Input
  value={item.title}
  onChange={(e) => updateAgendaItem(index, 'title', e.target.value)}
  placeholder={(item.parentLocalKey || item.parent_id) ? 'Unterpunkt' : 'Agenda-Punkt Titel'}
  className={cn(
    "flex-1 border-none shadow-none p-0 h-auto",
    // NEU: fett wie bei dynamischen Punkten
    "font-semibold text-base",
    // NEU: transparent, erst bei Hover grau
    "bg-transparent hover:bg-muted/50 focus:bg-muted/50 transition-colors"
  )}
/>
```

### 5.2 Kompaktere Cards

Aenderung in CardContent (Zeile 3577):

```tsx
<CardContent className="p-3"> {/* statt p-4 */}
  <div className="flex items-start gap-2"> {/* statt gap-3 */}
    ...
  </div>
</CardContent>
```

### 5.3 Weisse Cards mit Hover-Effekt

```tsx
<Card 
  ref={provided.innerRef}
  {...provided.draggableProps}
  className={cn(
    (item.parentLocalKey || item.parent_id) && 'ml-6 border-l border-border',
    snapshot.isDragging && 'shadow-glow',
    // NEU: Hover-Effekt
    "hover:bg-muted/30 transition-colors"
  )}
>
```

---

## Zusammenfassung der Dateiänderungen

| Datei | Aenderungen |
|-------|-------------|
| **`MeetingsView.tsx`** | 1) addSystemAgendaItem Funktion, 2) System-Buttons in der Toolbar, 3) hasEditPermission-Logik, 4) Icon-Reihenfolge, 5) Design-Anpassungen |
| **`FocusModeView.tsx`** | Einzelne Notizen/Termine/Aufgaben als navigierbare Sub-Items mit farbiger Kante |

---

## Technische Details

### Neue Props fuer FocusModeView

```tsx
interface FocusModeViewProps {
  // ... bestehende Props
  linkedTasks?: any[]; // NEU: Aufgaben fuer das Meeting
  appointments?: any[]; // NEU: Termine aus dem Kalender
}
```

### Erweitertes NavigableItem Interface

```tsx
interface NavigableItem {
  item: AgendaItem;
  isSubItem: boolean;
  parentItem: AgendaItem | null;
  globalIndex: number;
  isSystemSubItem?: boolean; // NEU
  sourceId?: string;         // NEU: ID der Notiz/Termin/Aufgabe
  sourceType?: 'quick_note' | 'appointment' | 'task'; // NEU
}
```
