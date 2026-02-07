
# Plan: Drei Verbesserungen fuer Meeting-Agenda

## Uebersicht

| # | Problem | Loesung |
|---|---------|---------|
| 1 | System-Items werden nicht dauerhaft gespeichert | `addSystemAgendaItem` direkt in die Datenbank schreiben (analog zu `addSubItem` und `addTaskToAgenda`) |
| 2 | Aufgabe als Unterpunkt: Zuweisung automatisch setzen | Bei `addTaskToAgenda` automatisch `assigned_to` vom Task-Eigentuemer uebernehmen; bei `addSubItem` den aktuellen User setzen |
| 3 | Sidebar-Layout fuer Meeting-Agenda | Seitenleiste mit Meeting-Liste, Buttons und Details; Hauptbereich nur fuer die Agenda |

---

## 1. System-Items persistent speichern

### Ursache
`addSystemAgendaItem` fuegt Items nur zum lokalen State (`setAgendaItems`) hinzu, ohne sie in die Datenbank zu schreiben. Im Gegensatz dazu speichern `addSubItem` und `addTaskToAgenda` sofort per `supabase.from('meeting_agenda_items').insert(...)`. Beim Verlassen der Seite oder Starten des Meetings werden die Items neu aus der DB geladen - die nur lokal vorhandenen System-Items gehen verloren.

### Loesung (MeetingsView.tsx)

`addSystemAgendaItem` wird zu einer `async`-Funktion umgebaut, die das Item sofort in die DB schreibt (nach dem gleichen Muster wie `addSubItem`):

```tsx
const addSystemAgendaItem = async (
  systemType: 'upcoming_appointments' | 'quick_notes' | 'tasks', 
  parentItem?: AgendaItem
) => {
  if (!selectedMeeting?.id) return;

  // Duplikat-Pruefung bleibt
  if (agendaItems.some(i => i.system_type === systemType)) {
    toast({ title: "Bereits vorhanden", ... });
    return;
  }

  try {
    let parentId: string | null = null;

    if (parentItem) {
      parentId = parentItem.id || null;
      // Falls Parent noch keine DB-ID hat, zuerst speichern
      if (!parentId) {
        const { data: parentData, error: parentError } = await supabase
          .from('meeting_agenda_items')
          .insert({
            meeting_id: selectedMeeting.id,
            title: parentItem.title,
            description: parentItem.description || null,
            order_index: parentItem.order_index,
            is_completed: false,
            is_recurring: false,
          })
          .select().single();
        if (parentError) throw parentError;
        parentId = parentData.id;
        // Local state aktualisieren
        const parentIndex = agendaItems.findIndex(...);
        const updatedItems = [...agendaItems];
        updatedItems[parentIndex] = { ...parentItem, id: parentId };
        setAgendaItems(updatedItems);
      }
    }

    // Order-Index berechnen
    let insertIndex: number;
    if (parentItem) {
      const parentIndex = agendaItems.findIndex(...);
      insertIndex = parentIndex + 1;
      while (insertIndex < agendaItems.length && 
             agendaItems[insertIndex].parent_id === parentId) {
        insertIndex++;
      }
    } else {
      insertIndex = agendaItems.length;
    }

    // In DB speichern
    const { data: savedItem, error } = await supabase
      .from('meeting_agenda_items')
      .insert({
        meeting_id: selectedMeeting.id,
        title: titles[systemType],
        description: null,
        system_type: systemType,
        parent_id: parentId,
        order_index: insertIndex,
        is_completed: false,
        is_recurring: false,
        is_visible: true,
      })
      .select().single();

    if (error) throw error;

    // Lokalen State aktualisieren
    const newItem: AgendaItem = {
      ...savedItem,
      localKey: savedItem.id,
      parentLocalKey: parentId || undefined,
    };

    const next = [...agendaItems];
    next.splice(insertIndex, 0, newItem);
    const reindexed = next.map((it, idx) => ({ ...it, order_index: idx }));
    setAgendaItems(reindexed);

    // Order-Index in DB aktualisieren fuer verschobene Items
    for (const item of reindexed) {
      if (item.id && item.id !== savedItem.id) {
        await supabase
          .from('meeting_agenda_items')
          .update({ order_index: item.order_index })
          .eq('id', item.id);
      }
    }

    toast({ title: "Dynamischer Punkt hinzugefuegt", ... });
  } catch (error) {
    console.error('Error saving system agenda item:', error);
    toast({ title: "Fehler", variant: "destructive", ... });
  }
};
```

---

## 2. Automatische Zuweisung bei Task-Unterpunkten

### Problem
Wenn eine Aufgabe als Unterpunkt hinzugefuegt wird (`addTaskToAgenda`), wird kein `assigned_to` gesetzt. Die Zuweisung soll automatisch den Eigentuemer der Aufgabe (`task.assigned_to` oder `task.user_id`) uebernehmen.

### Loesung (MeetingsView.tsx)

**In `addTaskToAgenda` (Zeile 2081-2093):**

Beim Insert das `assigned_to`-Feld mit dem Aufgaben-Eigentuemer befuellen:

```tsx
// Bestimme den Zustaendigen: assigned_to der Aufgabe, dann user_id der Aufgabe, dann aktueller User
const taskOwner = task.assigned_to || task.user_id || user.id;

const { data: taskData, error: taskError } = await supabase
  .from('meeting_agenda_items')
  .insert({
    meeting_id: selectedMeeting.id,
    title: task.title,
    description: task.description || null,
    task_id: task.id,
    parent_id: parentId,
    order_index: subItemOrderIndex,
    is_completed: false,
    is_recurring: false,
    file_path: documentPath,
    assigned_to: [taskOwner],  // Automatische Zuweisung
  })
  .select().single();
```

**In `addSubItem` (Zeile 2217-2230):**

Beim Erstellen eines freien Unterpunkts den aktuellen User als Standard-Zustaendigen setzen:

```tsx
const { data: subItemData, error: subItemError } = await supabase
  .from('meeting_agenda_items')
  .insert({
    meeting_id: selectedMeeting.id,
    title: title || '',
    description: '',
    parent_id: parentId,
    order_index: subItemOrderIndex,
    is_completed: false,
    is_recurring: false,
    assigned_to: user?.id ? [user.id] : null,  // Aktueller User als Standard
  })
  .select().single();
```

---

## 3. Sidebar-Layout fuer Meeting-Agenda

### Aktuelles Layout
Alles ist vertikal gestapelt:
1. Header (Titel + Buttons "Neues Meeting" und "Archiv")
2. Meeting-Karten (3-spaltig)
3. Aktive Besprechung (wenn gestartet) ODER Agenda-Editor (wenn ausgewaehlt)

### Neues Layout
Ein zweispaltiges Layout mit ResizablePanels:

```text
+-------------------------------+-------------------------------------------+
| SEITENLEISTE (300px)          | HAUPTBEREICH                              |
|                               |                                           |
| [+ Neues Meeting] [Archiv]    | Agenda: Meeting-Titel                     |
|                               | am Freitag, 7. Februar um 10:00 Uhr      |
| --- Naechste Besprechungen -- |                                           |
|                               | [+ Punkt] [System] [Speichern]            |
| > Jour Fixe 07.02.            |                                           |
|   10:00 | Buero               | [Drag] Aktuelles aus dem Landtag          |
|   [Teilnehmer-Avatare]        |   [Drag] Unterpunkt 1                     |
|   [Start]                     |   [Drag] Unterpunkt 2                     |
|                               |                                           |
| > Jour Fixe 14.02.            | [Drag] Wahlkreisarbeit                    |
|   10:00 | Buero               |   [Drag] Meine Notizen (System)           |
|   [Start]                     |                                           |
|                               | [Drag] Organisation                       |
| > Jour Fixe 21.02.            |   [Drag] Aufgaben (System)                |
|   10:00 | Buero               |                                           |
|   [Start]                     |                                           |
|                               |                                           |
| --- Details ---               |                                           |
| Beschreibung: ...             |                                           |
| Ort: Buero                    |                                           |
| Teilnehmer: [Inline Editor]   |                                           |
| Sichtbarkeit: Oeffentlich     |                                           |
+-------------------------------+-------------------------------------------+
```

### Technische Umsetzung

Die bestehenden `ResizablePanel`-Komponenten (`react-resizable-panels`) werden verwendet.

**Aenderungen in MeetingsView.tsx:**

1. Import der Panel-Komponenten:
```tsx
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
```

2. Das bestehende vertikale Layout wird in ein Panel-Layout umgebaut:

```tsx
return (
  <div className="min-h-screen bg-gradient-subtle p-6">
    <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-4rem)]">
      {/* Seitenleiste */}
      <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
        <div className="h-full flex flex-col pr-4 space-y-4">
          {/* Buttons */}
          <div className="flex gap-2">
            <Dialog ...>
              <DialogTrigger asChild>
                <Button className="flex-1">
                  <Plus className="h-4 w-4 mr-2" /> Neues Meeting
                </Button>
              </DialogTrigger>
              {/* DialogContent bleibt gleich */}
            </Dialog>
            <Button variant="outline" onClick={() => setShowArchive(true)}>
              <Archive className="h-4 w-4 mr-2" /> Archiv
            </Button>
          </div>

          {/* Meeting-Liste (vertikal statt 3-spaltig) */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">
              Naechste Besprechungen
            </h3>
            <div className="space-y-2">
              {upcomingMeetings.map((meeting) => (
                <Card 
                  key={meeting.id} 
                  className={cn(
                    "cursor-pointer hover:shadow-sm transition",
                    selectedMeeting?.id === meeting.id && "border-primary ring-1 ring-primary"
                  )}
                  onClick={() => { setSelectedMeeting(meeting); loadAgendaItems(meeting.id); }}
                >
                  {/* Kompakte Karte: Titel, Datum/Uhrzeit, Teilnehmer, Start-Button */}
                </Card>
              ))}
            </div>
          </div>

          {/* Meeting-Details (nur wenn ausgewaehlt) */}
          {selectedMeeting && (
            <div className="border-t pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Details</h3>
              {/* Beschreibung, Ort, Teilnehmer, Sichtbarkeit */}
              {/* Bearbeiten/Loeschen Buttons */}
            </div>
          )}
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Hauptbereich: Agenda */}
      <ResizablePanel defaultSize={75}>
        <div className="h-full pl-4">
          {activeMeeting ? (
            /* Aktive Besprechung - Tagesordnung */
          ) : selectedMeeting ? (
            /* Agenda-Editor */
          ) : (
            /* Kein Meeting ausgewaehlt */
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
);
```

3. Die Meeting-Karten werden von der 3-spaltigen Grid-Ansicht in eine vertikale, kompaktere Liste in der Seitenleiste umgebaut. Jede Karte wird schmaler:
   - Titel (fett, truncated)
   - Datum + Uhrzeit in einer Zeile
   - Ort (wenn vorhanden)
   - Teilnehmer-Avatare (klein)
   - Start-Button (volle Breite)
   - Edit/Delete Buttons (klein, hover-only)

4. Die Meeting-Details (Beschreibung, Ort, Teilnehmer-Editor, Sichtbarkeit, Bearbeiten) werden aus den Karten herausgezogen und in einen eigenen Abschnitt unter der Liste verschoben - nur fuer das aktuell ausgewaehlte Meeting sichtbar.

5. Die Ueberschrift "Meeting Agenda" und der Untertitel koennen in der Seitenleiste als Kopfzeile verbleiben oder entfernt werden, da die Seitenleiste selbst schon den Kontext liefert.

### Kein Inhaltsverlust
Alle Elemente werden beibehalten:
- "Neues Meeting" Dialog (identisch, nur Button in Sidebar)
- "Archiv" Button (in Sidebar)
- Meeting-Karten mit allen Details (kompakter in Sidebar)
- Inline-Editing von Meetings (im Detail-Bereich der Sidebar)
- Teilnehmer-Management (im Detail-Bereich)
- Start/Stop-Buttons (in den Karten)
- Agenda-Editor mit allen Features (im Hauptbereich)
- Aktive Besprechungsansicht (im Hauptbereich)
- Quick Notes/Appointments Previews (im Hauptbereich unter der Agenda)

---

## Zusammenfassung der Dateiaenderungen

| Datei | Aenderungen |
|-------|-------------|
| **MeetingsView.tsx** | 1) `addSystemAgendaItem` zu async umbauen und DB-Insert hinzufuegen, 2) `addTaskToAgenda` um automatisches `assigned_to` erweitern, 3) `addSubItem` um Standard-Zuweisung erweitern, 4) Gesamtes Layout auf ResizablePanelGroup umstellen mit Sidebar fuer Meetings und Hauptbereich fuer Agenda |
