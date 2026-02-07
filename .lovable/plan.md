
# Plan: Fuenf Fixes fuer Meeting-System

## 1. System-Items: Korrekte Positionierung und Anzeige

### Problem
`addSystemAgendaItem` fuegt neue System-Items immer am Ende des `agendaItems`-Arrays ein (`order_index: agendaItems.length`) statt direkt nach dem Eltern-Item und dessen bestehenden Kindern. Dadurch erscheint das System-Item visuell am Ende der Tagesordnung, nicht als Unterpunkt des gewaehlten Hauptpunkts.

### Loesung (MeetingsView.tsx)

Die `addSystemAgendaItem`-Funktion aendern, sodass das neue Item direkt nach dem letzten Kind des Eltern-Items eingefuegt wird (analog zu `addSubItem` und `addTaskToAgenda`):

```tsx
const addSystemAgendaItem = (systemType: ..., parentItem?: AgendaItem) => {
  // ... Duplikat-Pruefung bleibt ...

  const localKey = makeLocalKey();

  if (parentItem) {
    // Eltern-Index finden
    const parentIndex = agendaItems.findIndex(
      item => item.id === parentItem.id || item.localKey === parentItem.localKey
    );
    // Nach dem letzten Kind des Eltern-Items einfuegen
    let insertIndex = parentIndex + 1;
    while (insertIndex < agendaItems.length && 
           (agendaItems[insertIndex].parent_id === parentItem.id || 
            agendaItems[insertIndex].parentLocalKey === (parentItem.id || parentItem.localKey))) {
      insertIndex++;
    }
    
    const newItem: AgendaItem = {
      title: titles[systemType],
      description: "",
      assigned_to: [],
      notes: "",
      is_completed: false,
      is_recurring: false,
      order_index: insertIndex,
      localKey,
      system_type: systemType,
      parent_id: parentItem.id || null,
      parentLocalKey: parentItem.id || parentItem.localKey || undefined,
    };

    const next = [...agendaItems];
    next.splice(insertIndex, 0, newItem);
    // Reindex
    setAgendaItems(next.map((it, idx) => ({ ...it, order_index: idx })));
  } else {
    // Ohne Parent: am Ende anfuegen (bestehendes Verhalten)
    const newItem: AgendaItem = {
      title: titles[systemType],
      // ...restliche Felder...
      order_index: agendaItems.length,
      localKey,
      system_type: systemType,
      parent_id: null,
      parentLocalKey: undefined,
    };
    const next = [...agendaItems, newItem].map((it, idx) => ({ ...it, order_index: idx }));
    setAgendaItems(next);
  }
};
```

Zusaetzlich: In `saveAgendaItems` sicherstellen, dass auch System-Items mit `parent_id` (die bereits in der DB existieren) korrekt als Kinder behandelt werden. Derzeit wird `parentLocalKey` geprueft - Items, die aus der DB geladen wurden und `parent_id` haben, behalten ihr `parentLocalKey` (gleich `parent_id`). Das Mapping sollte funktionieren, da `localKey = id` und die Zuordnung `parentIdByLocalKey[parentLocalKey]` den neuen Parent-ID findet.

---

## 2. Avatar + Name: Reihenfolge Titel - Beschreibung - Avatar

### Problem
In `SystemAgendaItem.tsx` steht der `ProfileBadge` bei Notizen VOR `RichTextDisplay` (Zeile 180) und bei Tasks VOR der Beschreibung (Zeile 212). Die Reihenfolge soll sein: Titel, dann Beschreibung/Inhalt, dann Avatar+Name.

### Loesung (SystemAgendaItem.tsx)

**Quick Notes (Zeilen 176-187):**
```tsx
<div key={note.id} className="p-3 bg-muted/50 rounded-md">
  {note.title && (
    <h4 className="font-semibold text-sm mb-1">{note.title}</h4>
  )}
  <RichTextDisplay content={note.content} className="text-sm" />
  <ProfileBadge userId={note.user_id} profiles={profiles} />
  {note.meeting_result && (
    <p className="text-xs text-muted-foreground mt-1">
      Ergebnis: {note.meeting_result}
    </p>
  )}
</div>
```

**Tasks (Zeilen 210-221):**
```tsx
<div key={task.id} className="p-3 bg-muted/50 rounded-md">
  <h4 className="font-semibold text-sm mb-1">{task.title}</h4>
  {task.description && (
    <RichTextDisplay content={task.description} className="text-sm text-muted-foreground" />
  )}
  <ProfileBadge userId={task.user_id} profiles={profiles} />
  {task.due_date && (
    <p className="text-xs text-muted-foreground mt-1">
      Frist: {format(new Date(task.due_date), "dd.MM.yyyy", { locale: de })}
    </p>
  )}
</div>
```

Gleiche Reihenfolge in der **laufenden Meeting-Ansicht** (MeetingsView.tsx): Avatar+Name NACH der Beschreibung/Content platzieren.

- **Notizen Hauptpunkt** (Zeilen 3404-3425): Avatar nach RichTextDisplay verschieben
- **Notizen Sub-Item** (Zeilen 3672-3705): Avatar nach RichTextDisplay verschieben  
- **Aufgaben Hauptpunkt** (Zeilen 3452-3474): Avatar nach Beschreibung verschieben
- **Aufgaben Sub-Item** (Zeilen 3726-3748): Avatar nach Beschreibung verschieben

Gleiche Reihenfolge im **FocusModeView.tsx** (Zeilen 565-585): Bei Notes Avatar nach Content verschieben, bei Tasks Avatar nach Description.

---

## 3. Zuweisung (MultiUserAssignSelect) bei Unterpunkten und Task-Icon-Eintraegen

### Problem
Regulaere Sub-Items haben `MultiUserAssignSelect` (Zeile 3792-3802), aber Items die ueber `addSubItem` (Plus-Popover) oder `addTaskToAgenda` hinzugefuegt werden, haben keine `assigned_to` UI im Agenda-Editor.

### Loesung (MeetingsView.tsx - Agenda Editor)

Die `addSubItem`-Funktion setzt bereits kein `assigned_to` - das ist korrekt (wird erst spaeter zugewiesen). Das Problem ist, dass im Agenda-Editor die Sub-Items kein `MultiUserAssignSelect` anzeigen. Das tun sie aber - Zeile 3792-3802 zeigt es fuer regulaere Sub-Items. Allerdings gilt das nur in der **laufenden Meeting-Ansicht**, nicht im **Agenda-Editor**.

Im Agenda-Editor (Zeile 4196-4522) gibt es kein `MultiUserAssignSelect` fuer Sub-Items. Hier muss es hinzugefuegt werden.

**Agenda-Editor (Zeile 4197-4208):** Fuer Sub-Items eine `MultiUserAssignSelect` in die Zeile einfuegen. Es ist relevant bei dem flex-Container wo Titel und Buttons stehen:

```tsx
<div className="flex items-center gap-2">
  <Input value={item.title} ... />
  
  {/* Zuweisung fuer Sub-Items */}
  {(item.parentLocalKey || item.parent_id) && !item.system_type && (
    <MultiUserAssignSelect
      assignedTo={item.assigned_to}
      profiles={profiles}
      onChange={(userIds) => updateAgendaItem(index, 'assigned_to', userIds.length > 0 ? userIds : null)}
      size="sm"
    />
  )}
  
  {/* Notes button (nur fuer Hauptpunkte) */}
  {/* Plus button (nur fuer Hauptpunkte) */}
  {/* Task button (nur fuer Hauptpunkte) */}
  {/* Delete button */}
</div>
```

Dabei soll der Avatar + Name des Zugewiesenen auch in der Darstellung des Unterpunkts sichtbar sein, nicht nur das Auswahlfeld.

---

## 4. HTML in Beschreibungen beheben

### Problem
An mindestens zwei Stellen wird Notiz-/Beschreibungsinhalt als roher Text gerendert, sodass HTML-Tags sichtbar werden:

1. **Quick Notes Preview** am Ende des Agenda-Editors (Zeile 4587): `<p className="text-sm">{note.content}</p>` - muss `RichTextDisplay` verwenden
2. **Textarea** fuer Sub-Item-Beschreibungen (Zeile 4333-4338): Zeigt HTML als rohen Text, da es ein Textarea ist. Hier sollte stattdessen eine Vorschau mit `RichTextDisplay` gezeigt werden und nur bei Klick in den Bearbeitungsmodus gewechselt werden (oder das Textarea neben einer Vorschau).

### Loesung

**Quick Notes Preview (Zeile 4587):**
```tsx
// Von:
<p className="text-sm">{note.content}</p>
// Zu:
<RichTextDisplay content={note.content} className="text-sm" />
```

**Sub-Item-Beschreibungen (Zeile 4331-4338):**
Da es sich um ein editierbares Feld handelt, muss eine Zweiteilung erfolgen:
- Im Normalzustand: `RichTextDisplay` zeigt den formatierten Inhalt
- Beim Klick oder im Editiermodus: Textarea zum Bearbeiten

Einfachere Alternative: Das Textarea beibehalten (da Nutzer es editieren), aber eine ZUSAETZLICHE Vorschau darunter anzeigen, wenn HTML-Content vorhanden ist. Oder noch einfacher: Das Textarea bleibt, da der Nutzer es ja bearbeiten muss - aber die HTML-Tags muessen bereits beim Speichern in der Aufgabe korrekt als HTML in der DB stehen. Das Problem ist, dass die Beschreibung HTML enthaelt und in einem Textarea editiert wird, was die Tags natuerlich sichtbar macht.

**Empfohlene Loesung:** Die Beschreibung in Sub-Items nur als Vorschau anzeigen (RichTextDisplay, nicht editierbar), da Beschreibungen typischerweise aus importierten Aufgaben stammen und nicht im Agenda-Editor geaendert werden muessen. Falls der Nutzer bearbeiten will, kann ein kleiner "Bearbeiten"-Button das Textarea einblenden.

```tsx
{(item.parentLocalKey || item.parent_id) && item.description && (
  <div className="mb-2">
    <RichTextDisplay content={item.description} className="text-sm text-muted-foreground" />
  </div>
)}
```

---

## 5. Meine Arbeit > Jour Fixe: Einzelne Notizen und Aufgaben anzeigen

### Problem
In `MyWorkJourFixeTab.tsx` werden System-Agenda-Items nur mit ihrem Titel angezeigt ("Meine Notizen", "Aufgaben"), aber nicht die einzelnen Notizen und Aufgaben darunter.

### Loesung (MyWorkJourFixeTab.tsx)

Die `loadAgendaForMeeting`-Funktion erweitern, sodass fuer System-Items auch die zugehoerigen Daten geladen werden:

1. **Neuer State** fuer verknuepfte Notizen und Aufgaben pro Meeting:
```tsx
const [meetingQuickNotes, setMeetingQuickNotes] = useState<Record<string, any[]>>({});
const [meetingTasks, setMeetingTasks] = useState<Record<string, any[]>>({});
```

2. **Lade-Funktionen erweitern:** Wenn in den Agenda-Items ein System-Item mit `system_type === 'quick_notes'` oder `system_type === 'tasks'` vorkommt, die entsprechenden Daten laden:

```tsx
const loadMeetingSystemData = async (meetingId: string, agendaData: AgendaItem[]) => {
  const hasNotes = agendaData.some(i => i.system_type === 'quick_notes');
  const hasTasks = agendaData.some(i => i.system_type === 'tasks');
  
  if (hasNotes) {
    const { data } = await supabase
      .from('quick_notes')
      .select('id, title, user_id')
      .eq('meeting_id', meetingId);
    setMeetingQuickNotes(prev => ({ ...prev, [meetingId]: data || [] }));
  }
  
  if (hasTasks) {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, user_id')
      .eq('meeting_id', meetingId);
    setMeetingTasks(prev => ({ ...prev, [meetingId]: data || [] }));
  }
};
```

3. **Rendering erweitern:** Unter System-Items die einzelnen Eintraege anzeigen:

```tsx
{item.system_type === 'quick_notes' && meetingQuickNotes[meeting.id]?.length > 0 && (
  <ul className="ml-4 mt-0.5 space-y-0.5">
    {meetingQuickNotes[meeting.id].map((note, nIdx) => (
      <li key={note.id} className="flex items-center gap-1.5 text-muted-foreground">
        <StickyNote className="h-2.5 w-2.5 text-amber-500" />
        <span>{note.title || `Notiz ${nIdx + 1}`}</span>
      </li>
    ))}
  </ul>
)}
```

Gleiches fuer Tasks mit ListTodo-Icon in gruen.

---

## Zusammenfassung der Dateiaenderungen

| Datei | Aenderungen |
|-------|-------------|
| **MeetingsView.tsx** | 1) `addSystemAgendaItem`: Einfuegen nach dem Eltern-Item statt am Ende, 2) Quick Notes Preview HTML-Fix (Zeile 4587), 3) Sub-Item-Beschreibungen als RichTextDisplay rendern, 4) Reihenfolge Avatar nach Beschreibung in laufender Ansicht, 5) MultiUserAssignSelect fuer Sub-Items im Agenda-Editor |
| **SystemAgendaItem.tsx** | ProfileBadge NACH Inhalt/Beschreibung statt davor |
| **FocusModeView.tsx** | Avatar-Position nach Content/Description verschieben |
| **MyWorkJourFixeTab.tsx** | System-Item-Kinder (Notizen, Aufgaben) laden und einzeln anzeigen |
