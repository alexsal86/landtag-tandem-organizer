

# Plan: Vorgänge als Ticketsystem mit Entscheidungsintegration

## Zusammenfassung

Der Bereich "Meine Arbeit / Vorgänge" wird zu einem vollwertigen Ticketsystem ausgebaut. Kernstück ist die bidirektionale Integration mit dem bestehenden Entscheidungssystem: Aus einem Vorgang heraus kann eine Entscheidung erstellt werden, die an den Vorgang gebunden bleibt und deren Ergebnis direkt im Vorgang-Detail und im Zeitstrahl sichtbar ist.

---

## Schritt 1: Build-Fehler beheben

Die JSX-Struktur um Zeile 1120-1126 hat ein fehlerhaftes Closing-Tag-Nesting. Die überflüssige `</div>` auf Zeile 1123 muss entfernt werden, damit `Draggable`, `Droppable` und `DragDropContext` korrekt schließen.

## Schritt 2: Datenbankänderung — Verknüpfungsspalte

Die Tabelle `task_decisions` hat bereits `task_id` (FK zu tasks). Es fehlt eine Spalte zur Verknüpfung mit Vorgängen:

```sql
ALTER TABLE task_decisions
  ADD COLUMN case_item_id uuid REFERENCES case_items(id) ON DELETE SET NULL;

CREATE INDEX idx_task_decisions_case_item_id ON task_decisions(case_item_id);
```

Damit kann eine Entscheidung direkt an einen Vorgang gebunden werden, unabhängig von der tasks-Tabelle.

## Schritt 3: Entscheidung aus Vorgang erstellen

Im Inline-Detail eines Vorgangs (wo aktuell "Entscheidung anfordern" / "Eingegangen" steht, Zeile 1009-1013) wird der "Anfordern"-Button erweitert:

- Klick öffnet den bestehenden `StandaloneDecisionCreator` als Dialog
- Der Titel wird automatisch vorausgefüllt mit dem Vorgang-Betreff
- Die Beschreibung wird mit der Vorgangs-Beschreibung vorausgefüllt
- Nach Erstellung wird die `case_item_id` auf den Vorgang gesetzt
- Der Vorgang-Status wechselt automatisch auf `entscheidung_abwartend`
- Ein Timeline-Event "Entscheidung erstellt" wird eingetragen

Dafür wird `StandaloneDecisionCreator` um optionale Props erweitert:
- `caseItemId?: string` — wird beim Insert als `case_item_id` mitgespeichert
- `defaultTitle?: string` — vorausgefüllter Titel
- `defaultDescription?: string` — vorausgefüllte Beschreibung
- `onCreatedWithId?: (decisionId: string) => void` — Callback mit der neuen Decision-ID

## Schritt 4: Verknüpfte Entscheidungen im Vorgang anzeigen

Im Inline-Detail wird ein neuer Abschnitt "Verknüpfte Entscheidungen" eingefügt (zwischen Bearbeiter und Zeitstrahl):

- Abfrage: `supabase.from("task_decisions").select("id, title, status, created_at, response_deadline").eq("case_item_id", itemId)`
- Jede Entscheidung wird als kompakte Karte angezeigt mit:
  - Titel, Status-Badge (offen/abgeschlossen/archiviert), Deadline
  - Klick öffnet `TaskDecisionDetails` in einem Dialog
- Antwort-Ergebnis wird direkt zusammengefasst angezeigt (z.B. "3x Ja, 1x Nein")
- Button "Weitere Entscheidung stellen" am Ende der Liste

## Schritt 5: Rückspiegelung — Entscheidungsergebnis im Zeitstrahl

Wenn eine verknüpfte Entscheidung abgeschlossen wird (Status → `completed`), soll dies im Vorgang reflektiert werden:

- Beim Laden der Entscheidungen werden abgeschlossene automatisch als Timeline-Event dargestellt
- Im Zeitstrahl: "Entscheidung [Titel] abgeschlossen — Ergebnis: [Zusammenfassung]"
- Der Vorgang-Status kann per Button von `entscheidung_abwartend` zurückgesetzt werden

## Schritt 6: Kontextmenü-Erweiterung

Im bestehenden Rechtsklick-Kontextmenü wird ein neuer Eintrag ergänzt:
- "Entscheidung stellen" → öffnet direkt den Decision-Creator mit vorausgefüllten Daten

## Dateien die geändert werden

1. **Migration (SQL)**: Neue Spalte `case_item_id` auf `task_decisions`
2. **`StandaloneDecisionCreator.tsx`**: Neue optionale Props für Vorausfüllung und `case_item_id`
3. **`MyWorkCasesWorkspace.tsx`**: 
   - Build-Fix (JSX-Nesting)
   - Neuer State + Abfrage für verknüpfte Entscheidungen
   - UI-Abschnitt "Verknüpfte Entscheidungen" im Inline-Detail
   - Erweiterter "Anfordern"-Button → öffnet Creator-Dialog
   - Kontextmenü-Eintrag "Entscheidung stellen"
   - Rückspiegelung im Zeitstrahl

## Was NICHT enthalten ist (bewusst)

- Keine KPIs, Dashboards oder Statistiken
- Keine automatischen SLA-Timer oder Eskalationsregeln
- Kein Kanban-Board — die bestehende Listenansicht bleibt

