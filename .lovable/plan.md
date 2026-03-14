

# Jour Fixe / Agenda: UI-Verbesserungen und Fehlerbehebungen

## Übersicht

6 Punkte werden adressiert: Build-Fehler beheben, Checkbox-Position klären, Card-UI redesignen, Einrückung konsistent machen, "System"-Badge entfernen, Count-Badge verschieben, und Entscheidungen im Fokus-Modus ergänzen.

## Änderungen

### 0. Build-Fehler beheben (Priorität)

In `SystemAgendaItem.tsx` Zeile 271 wird `decision.user_id` referenziert, aber `RelevantDecision` hat kein `user_id`-Feld (nur `created_by`). Fix: `user_id` durch `created_by` ersetzen.

### 1. Checkbox im Agenda-Editor (Punkt 1)

Die Checkbox nach dem Drag-Handle in `AgendaEditorPanel.tsx` (Zeile 293) markiert einen Agenda-Punkt als "erledigt" (`is_completed`). Sie wird nur für Hauptpunkte angezeigt (nicht für Unterpunkte). **Vorschlag**: Checkbox ans Ende der Zeile verschieben (nach den Aktions-Buttons), da sie während der Agenda-Planung weniger relevant ist und erst im aktiven Meeting gebraucht wird.

### 2. Card-Ansicht redesignen (Punkt 2)

Aktuell werden Agenda-Punkte als vollständige `<Card>`-Komponenten mit Padding, Border und Schatten gerendert. **Neues UI**: Umstellen auf eine kompakte, listenbasierte Darstellung:
- Statt Card: einfache `div` mit `border-b` als Trenner und leichtem Hover-Effekt
- Hauptpunkte: Nummer + Titel in einer Zeile, Aktionen rechts
- Unterpunkte: eingerückt mit `pl-8`, ebenfalls einzeilig
- System-Items behalten ihre farbige linke Kante, aber ohne Card-Wrapper
- Ergebnis: weniger visuelles Rauschen, bessere Übersicht

### 3. Einrückung konsistent machen (Punkt 3)

Aktuell: Unterpunkte haben `ml-8 border-l-4 border-l-primary/30`, aber die Nummerierung (`getAgendaNumber`) ist nicht immer konsistent dargestellt. Fix:
- Hauptpunkte: `pl-0`, Nummer als `1.`, `2.` etc.
- Unterpunkte: `pl-8` + linke Kante, Nummer als `1.1`, `1.2` etc.
- System-Unterpunkte: gleiche Einrückung wie reguläre Unterpunkte
- System-Sub-Items (einzelne Notizen/Aufgaben innerhalb eines System-Blocks): `pl-12` mit `a)`, `b)` etc.

### 4. "System"-Badge entfernen (Punkt 4)

In `SystemAgendaItem.tsx` `renderHeader()` (Zeile 167-170): Den Badge `<Badge variant="outline">System</Badge>` samt Icon entfernen. Die farbige linke Kante und das Icon im Titel reichen zur Unterscheidung.

### 5. Count-Badge ans Ende verschieben (Punkt 5)

In `SystemAgendaItem.tsx` `renderHeader()` (Zeile 164): Das Count-Badge steht nach dem Titel-Icon. Es soll ans Ende der Header-Zeile verschoben werden (vor dem Delete-Button, im rechten Bereich).

### 6. Entscheidungen im Fokus-Modus (Punkt 6)

`FocusModeView` akzeptiert kein `relevantDecisions`-Prop und `injectSystemChildren` hat keinen `decisions`-Branch. Änderungen:
- **`FocusModeViewProps`**: `relevantDecisions?: RelevantDecision[]` ergänzen (Import aus `./types`)
- **`MeetingsView.tsx`**: `relevantDecisions={data.meetingRelevantDecisions}` als Prop übergeben
- **`injectSystemChildren`**: Neuen Block für `systemItem.system_type === 'decisions'` analog zu tasks/case_items
- **`NavigableItem.sourceType`**: Um `'decision'` erweitern
- **Rendering**: Entscheidungs-Items im Fokus-Modus mit violet Icon und Titel/Frist anzeigen

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/components/meetings/SystemAgendaItem.tsx` | Build-Fix (`user_id` → `created_by`), System-Badge entfernen, Count-Badge verschieben |
| `src/components/meetings/AgendaEditorPanel.tsx` | Checkbox verschieben, Card → kompakte Liste, Einrückung vereinheitlichen |
| `src/components/meetings/FocusModeView.tsx` | `relevantDecisions` Prop + `decisions`-Branch in `injectSystemChildren` |
| `src/components/MeetingsView.tsx` | `relevantDecisions` Prop an FocusModeView übergeben |

