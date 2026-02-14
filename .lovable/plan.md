
# EventPlanningView Refactoring und RSVP-Integration

## Ziel

Die 4991-Zeilen-Datei `EventPlanningView.tsx` wird in sinnvolle Module aufgeteilt. Dabei geht kein Inhalt und keine UI verloren. Gleichzeitig wird die `EventRSVPManager`-Komponente in die Detailansicht eingebunden.

---

## Neue Dateistruktur

```text
src/components/event-planning/
  types.ts                          -- Alle Interfaces (EventPlanning, ChecklistItem, etc.)
  useEventPlanningData.ts           -- Custom Hook: State, Data-Fetching, Mutations
  EventPlanningListView.tsx         -- Uebersichtsseite (Cards + Tabelle, Archiv-Dialog, Create-Dialog)
  EventPlanningDetailView.tsx       -- Detailansicht (Grunddaten, Termine, Kontakte, Referenten, Dokumente)
  EventPlanningTable.tsx            -- Tabellenansicht fuer Planungen
  AppointmentPreparationTable.tsx   -- Tabellenansicht fuer Terminvorbereitungen
  ChecklistSection.tsx              -- Checkliste mit Drag&Drop, Subtasks, Kommentare, Dokumente
  ChecklistItemEmailDialog.tsx      -- (bereits vorhanden)
  PlanningDefaultCollaboratorsDialog.tsx -- (bereits vorhanden)
src/components/EventPlanningView.tsx -- Wird zum duennen Orchestrator (~50 Zeilen)
```

---

## Modulaufteilung im Detail

### 1. `types.ts` (Zeilen 40-184)
Alle Interfaces werden hierhin verschoben:
- EventPlanning, EventPlanningContact, EventPlanningSpeaker, EventPlanningDate
- ChecklistItem, PlanningSubtask, PlanningComment, PlanningDocument
- GeneralPlanningDocument, Collaborator, Profile, AppointmentPreparation

### 2. `useEventPlanningData.ts` (Zeilen 185-2815)
Alle State-Variablen und Funktionen werden in einen Custom Hook extrahiert:
- ~80 useState-Variablen
- fetchPlannings, fetchPlanningDetails, fetchAllProfiles, fetchAvailableContacts, etc.
- CRUD-Operationen: createPlanning, deletePlanning, archivePlanning, etc.
- Checklist-Operationen: toggleChecklistItem, addChecklistItem, onDragEnd, etc.
- Kontakt/Referenten-Operationen: addContact, removeContact, addSpeaker, etc.
- Dokument-Operationen: handleItemFileUpload, deleteItemDocument, etc.
- Subtask/Kommentar-Operationen
- Der Hook gibt alle States und Handler als Objekt zurueck

### 3. `EventPlanningListView.tsx` (Zeilen 2817-3250)
Die Ansicht wenn `!selectedPlanning`:
- Header mit Buttons (Standard-Mitarbeiter, Archiv, View-Toggle, Neue Planung)
- Card-Ansicht und Tabellenansicht der Planungen
- Terminvorbereitungen-Bereich
- Archiv-Dialog
- Create-Dialog
- Props: alle benoetigten States und Handler aus dem Hook

### 4. `EventPlanningDetailView.tsx` (Zeilen 3250-4991)
Die Detailansicht einer ausgewaehlten Planung:
- Header mit Zurueck-Button, Mitarbeiter-Dialog, Erledigt/Archiv/Loeschen-Buttons
- Grunddaten-Card (Titel, Beschreibung, Ort, Digital, Hintergruende, Termine)
- Ansprechpersonen-Card
- Referenten-Card
- Dokumente-Card
- Checkliste (wird als eigene Komponente `ChecklistSection` eingebettet)
- **NEU: EventRSVPManager-Komponente** wird hier eingebunden
- Alle Dialoge (Digital, Subtask-Result, Email)

### 5. `EventPlanningTable.tsx` (Zeilen 735-873)
Tabellenkomponente fuer Veranstaltungsplanungen.

### 6. `AppointmentPreparationTable.tsx` (Zeilen 875-949)
Tabellenkomponente fuer Terminvorbereitungen.

### 7. `ChecklistSection.tsx` (Zeilen ~4130-4870)
Die gesamte Checklisten-UI mit:
- DragDropContext / Droppable / Draggable
- Checklist-Items mit Toggle, Rename, Delete
- Inline Subtasks, Kommentare, Dokumente
- Neuen Punkt hinzufuegen

### 8. `EventPlanningView.tsx` (Orchestrator)
Wird auf ca. 50 Zeilen reduziert:
```
export function EventPlanningView() {
  const data = useEventPlanningData();
  
  if (!data.selectedPlanning) {
    return <EventPlanningListView {...data} />;
  }
  
  return <EventPlanningDetailView {...data} />;
}
```

---

## RSVP-Integration

Die `EventRSVPManager`-Komponente wird in `EventPlanningDetailView.tsx` eingebunden, direkt nach den Dokumenten und vor der Checkliste:

```tsx
<EventRSVPManager 
  eventPlanningId={selectedPlanning.id} 
  eventTitle={selectedPlanning.title} 
/>
```

---

## Technische Hinweise

- Alle Imports werden auf die neuen Pfade umgestellt
- Der Custom Hook `useEventPlanningData` gibt ein typisiertes Objekt zurueck, das als Props an die Sub-Komponenten weitergegeben wird
- Bestehende Funktionslogik wird 1:1 uebernommen -- keine Logik-Aenderungen
- Die Komponenten `ChecklistItemEmailDialog` und `PlanningDefaultCollaboratorsDialog` bleiben unveraendert an ihrem bestehenden Platz

---

## Zusammenfassung

| Datei | Inhalt | Geschaetzte Groesse |
|-------|--------|---------------------|
| types.ts | Interfaces | ~150 Zeilen |
| useEventPlanningData.ts | State + Logic | ~2600 Zeilen |
| EventPlanningListView.tsx | Uebersicht | ~500 Zeilen |
| EventPlanningDetailView.tsx | Details + RSVP | ~1200 Zeilen |
| EventPlanningTable.tsx | Tabelle Planungen | ~140 Zeilen |
| AppointmentPreparationTable.tsx | Tabelle Vorbereitungen | ~80 Zeilen |
| ChecklistSection.tsx | Checkliste komplett | ~750 Zeilen |
| EventPlanningView.tsx | Orchestrator | ~50 Zeilen |
