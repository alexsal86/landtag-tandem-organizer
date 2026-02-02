
# Plan: 6 Verbesserungen fuer Meetings, Entscheidungen und Aufgaben

## Uebersicht der Anforderungen

| # | Problem | Loesung |
|---|---------|---------|
| 1 | System-Agenda-Items (Meine Notizen, Kommende Termine) als Unterpunkte werden nicht korrekt angezeigt | Rendering-Logik korrigieren - Nummerierung und Header hinzufuegen |
| 2 | Rueckmeldung auf Rueckfragen bei Entscheidungen wird nicht gespeichert | `sendCreatorResponse`-Funktion debuggen und korrigieren |
| 3 | Task-Status: Admin-Verwaltung fehlt + Fehler bei Status-Aenderung | `task_statuses` in ConfigurableTypeSettings einbinden |
| 4 | Teammitglieder sollen Entscheidungen kommentieren koennen ohne Teilnehmer zu sein | Kommentar-Funktionalitaet fuer alle Viewer hinzufuegen |
| 5 | Noch nicht entschiedene Entscheidungen bearbeiten | Bearbeiten-Button fuer nicht-archivierte Entscheidungen aktivieren |
| 6 | Sinnvolle Erweiterungen fuer Entscheidungen | Vorschlaege fuer weitere Features |

---

## 1. System-Agenda-Items als Unterpunkte korrigieren

### Problem
Wenn "Meine Notizen" oder "Kommende Termine" als Unterpunkte platziert werden, fehlt:
- Die Nummerierung (z.B. "2.1")
- Ein einheitlicher Header wie bei regulaeren Unterpunkten
- Die visuelle Einreihung in die Unterpunkt-Liste

### Loesung
Die `SystemAgendaItem`-Komponente zeigt derzeit einen eigenen Header. Wenn `isEmbedded=true` ist, sollte stattdessen ein kompakter Header ohne Card-Wrapper verwendet werden.

**Datei:** `src/components/MeetingsView.tsx` (Zeilen 3164-3188)

Aenderung der Rendering-Logik fuer System-Unterpunkte:
- Hinzufuegen einer Nummerierung (index.subIndex) vor dem System-Item
- Einheitlicher Header-Stil wie bei regulaeren Unterpunkten
- SystemAgendaItem ohne eigene Card-Struktur rendern

**Datei:** `src/components/meetings/SystemAgendaItem.tsx`

Erweiterung fuer `isEmbedded`-Modus:
- Card-Header ausblenden bei `isEmbedded=true`
- Nur den Inhalt rendern
- Header-Logik nach MeetingsView verlagern

---

## 2. Rueckmeldung auf Rueckfragen speichern

### Problem
Die `sendCreatorResponse`-Funktion in `DecisionOverview.tsx` speichert die Antwort anscheinend nicht korrekt.

### Analyse
Die Funktion sieht korrekt aus:
1. Holt Response-Details
2. Aktualisiert `creator_response` in `task_decision_responses`
3. Sendet Benachrichtigung

### Moegliche Ursachen
- RLS-Policy verhindert das Update
- Falscher `responseId` wird uebergeben
- State wird nicht korrekt zurueckgesetzt

### Loesung
**Datei:** `src/components/task-decisions/DecisionOverview.tsx`

Debugging-Verbesserungen:
```typescript
const sendCreatorResponse = async (responseId: string) => {
  const responseText = creatorResponses[responseId];
  
  if (!responseText?.trim()) {
    console.warn('No response text for responseId:', responseId);
    return;
  }

  console.log('Sending creator response:', { responseId, responseText });
  setIsLoading(true);
  
  try {
    // Update response
    const { data, error } = await supabase
      .from('task_decision_responses')
      .update({ creator_response: responseText })
      .eq('id', responseId)
      .select();

    console.log('Update result:', { data, error });
    
    if (error) throw error;

    toast({ title: "Erfolgreich", description: "Antwort wurde gesendet." });
    setCreatorResponses(prev => ({ ...prev, [responseId]: '' }));
    
    if (user?.id) {
      await loadDecisionRequests(user.id);
    }
  } catch (error) {
    console.error('Error sending creator response:', error);
    toast({
      title: "Fehler",
      description: "Antwort konnte nicht gesendet werden.",
      variant: "destructive"
    });
  } finally {
    setIsLoading(false);
  }
};
```

### RLS-Pruefung
Sicherstellen, dass der Ersteller die Response aktualisieren darf:
```sql
-- Pruefe ob UPDATE Policy korrekt ist
-- Der Ersteller muss berechtigt sein, creator_response zu setzen
```

---

## 3. Task-Status Admin-Verwaltung + Fehler beheben

### 3a. Admin-Verwaltung fuer Task-Status

Die Tabelle `task_statuses` existiert bereits mit:
- id, name, label, is_active, order_index, created_at, updated_at

**Datei:** `src/pages/Administration.tsx`

Hinzufuegen einer weiteren `ConfigurableTypeSettings`-Instanz:

```typescript
case "tasks":
  return (
    <div className="space-y-6">
      <ConfigurableTypeSettings
        title="Aufgaben-Kategorien"
        tableName="task_categories"
        // ... bestehende Props
      />
      <ConfigurableTypeSettings
        title="Aufgaben-Status"
        tableName="task_statuses"
        entityName="Status"
        hasIcon={false}
        hasColor={false}
        deleteWarning="Sind Sie sicher, dass Sie diesen Status loeschen moechten?"
      />
    </div>
  );
```

**Datei:** `src/components/administration/ConfigurableTypeSettings.tsx`

Erweiterung des `tableName`-Union-Types:
```typescript
tableName: 'task_categories' | 'todo_categories' | 'case_file_types' | 
           'document_categories' | 'appointment_categories' | 
           'appointment_statuses' | 'appointment_locations' | 'task_statuses';
```

### 3b. Fehler bei Status-Aenderung

### Problem
Wenn man den Status einer Aufgabe im TaskDetailSidebar aendert, kommt ein Fehler.

### Ursache
Die `task_statuses`-Tabelle hat keinen `icon` und `color` Spalte, aber die Component versucht moeglicherweise, diese zu lesen.

### Loesung
Sicherstellen, dass die Task-Status-Aenderung korrekt funktioniert:

**Datei:** `src/components/TaskDetailSidebar.tsx`

Debugging der `saveTask`-Funktion (Zeilen 200-316):
- Status-Wert wird korrekt in die DB geschrieben
- Kein zusaetzliches icon/color Mapping noetig

---

## 4. Teammitglieder koennen Entscheidungen kommentieren

### Anforderung
Auch Nicht-Teilnehmer (aber Viewer) sollen Kommentare zu Entscheidungen abgeben koennen.

### Aktueller Zustand
- `TaskDecisionResponse` wird nur angezeigt wenn `decision.isParticipant && decision.participant_id`
- Nur Teilnehmer koennen abstimmen und kommentieren

### Loesung
Neuer Kommentar-Bereich fuer alle Viewer (nicht nur Teilnehmer):

**Datei:** `src/components/task-decisions/DecisionOverview.tsx`

1. Neue DB-Tabelle oder erweiterte Nutzung von `task_decision_responses`:
   - Option A: Neue `task_decision_comments` Tabelle fuer allgemeine Kommentare
   - Option B: Erlauben, dass Nicht-Teilnehmer in `task_decision_responses` mit type='comment' schreiben

**Empfehlung: Option B** - weniger Schema-Aenderungen

2. UI-Aenderung in `renderDecisionCard`:
```typescript
{/* Kommentar-Bereich fuer alle Viewer */}
{!decision.isParticipant && (
  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
    <DecisionViewerComment 
      decisionId={decision.id}
      onCommentSubmitted={handleResponseSubmitted}
    />
  </div>
)}
```

3. Neue Komponente `DecisionViewerComment.tsx`:
   - SimpleRichTextEditor fuer Kommentar-Eingabe
   - Speichert in `task_decision_responses` mit type='viewer_comment'
   - Benachrichtigt den Ersteller

**DB-Migration (optional):**
```sql
-- Erweiterung des response_type um 'viewer_comment'
-- Oder neue Spalte 'is_viewer_comment' boolean
```

---

## 5. Entscheidungen bearbeiten (noch nicht archiviert)

### Aktueller Zustand
Der "Bearbeiten"-Button existiert bereits und oeffnet `DecisionEditDialog`:
```typescript
<DropdownMenuItem onClick={(e) => { 
  e.stopPropagation(); 
  setEditingDecisionId(decision.id); 
}}>
  <Edit className="h-4 w-4 mr-2" />
  Bearbeiten
</DropdownMenuItem>
```

### Problem
Der Button ist nur fuer `decision.isCreator` sichtbar. Falls der Ersteller bereits bearbeiten kann, funktioniert es bereits.

### Loesung
Falls es nicht funktioniert, muss die `DecisionEditDialog`-Logik geprueft werden:

**Datei:** `src/components/task-decisions/DecisionEditDialog.tsx`

1. Pruefen, ob alle Felder editierbar sind
2. Sicherstellen, dass die Update-Abfrage korrekt ist
3. Evtl. zusaetzliche Felder wie `deadline` oder `response_options` editierbar machen

### Erweiterungen fuer besseres Bearbeiten:
- Deadline aendern
- Response-Optionen anpassen
- Beschreibung erweitern
- Anhang hinzufuegen/entfernen

---

## 6. Sinnvolle Erweiterungen fuer Entscheidungen

### Vorschlaege:

| Feature | Beschreibung | Prioritaet |
|---------|--------------|------------|
| **Deadline/Frist** | Ablaufdatum fuer Entscheidungen mit Erinnerungen | Hoch |
| **Abstimmungs-Ergebnis-Badge** | Klares "Angenommen/Abgelehnt" Badge nach Abschluss | Mittel |
| **Automatische Archivierung** | Nach X Tagen ohne ausstehende Antworten | Niedrig |
| **Export als PDF** | Entscheidung mit allen Antworten exportieren | Niedrig |
| **Verlinkung zu Aufgaben** | Aus Entscheidung direkt Aufgabe erstellen | Mittel |
| **Abstimmungs-Statistiken** | Dashboard mit Entscheidungs-Metriken | Niedrig |
| **Vorlagen fuer Entscheidungen** | Wiederverwendbare Entscheidungs-Templates | Mittel |

### Sofort umsetzbar:
1. **Deadline-Feld** - Neue Spalte in `task_decisions`, UI in Creator/Editor
2. **Automatische Benachrichtigung** bei nahender Deadline
3. **Direkte Aufgaben-Erstellung** aus der Entscheidungs-Karte

---

## Zusammenfassung der Dateiaenderungen

| Datei | Aenderungen |
|-------|-------------|
| `src/components/MeetingsView.tsx` | System-Item-Rendering als Unterpunkte verbessern |
| `src/components/meetings/SystemAgendaItem.tsx` | isEmbedded-Modus ohne Card-Wrapper |
| `src/components/task-decisions/DecisionOverview.tsx` | sendCreatorResponse debuggen, Viewer-Kommentare |
| `src/components/task-decisions/DecisionViewerComment.tsx` | Neue Komponente fuer Viewer-Kommentare |
| `src/pages/Administration.tsx` | task_statuses in Admin hinzufuegen |
| `src/components/administration/ConfigurableTypeSettings.tsx` | task_statuses im Type hinzufuegen |
| `src/components/task-decisions/DecisionEditDialog.tsx` | Erweiterte Bearbeitungsoptionen |

---

## Umsetzungsreihenfolge

1. **Task-Status Admin** - Einfache Erweiterung
2. **System-Agenda-Items Rendering** - UI-Korrektur
3. **Creator-Response speichern** - Debugging
4. **Viewer-Kommentare** - Neue Funktionalitaet
5. **Bearbeiten erweitern** - Feature-Ausbau
