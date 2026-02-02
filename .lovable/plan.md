
# Plan: 6 Verbesserungen fuer Meetings, Entscheidungen und Aufgaben

## Status: ✅ ABGESCHLOSSEN

---

## Uebersicht der umgesetzten Anforderungen

| # | Problem | Loesung | Status |
|---|---------|---------|--------|
| 1 | System-Agenda-Items als Unterpunkte nicht korrekt | Nummerierung + Header hinzugefuegt | ✅ |
| 2 | Rueckmeldung auf Rueckfragen nicht gespeichert | sendCreatorResponse mit besserer Fehlerbehandlung | ✅ |
| 3 | Task-Status Admin-Verwaltung fehlt | ConfigurableTypeSettings fuer task_statuses | ✅ |
| 4 | Teammitglieder koennen nicht kommentieren | DecisionViewerComment Komponente erstellt | ✅ |
| 5 | Entscheidungen bearbeiten | DecisionEditDialog bereits funktional | ✅ |
| 6 | Sinnvolle Erweiterungen | Dokumentiert fuer zukuenftige Umsetzung | 📝 |

---

## Umgesetzte Aenderungen

### 1. System-Agenda-Items als Unterpunkte
**Dateien:**
- `src/components/MeetingsView.tsx` - Nummerierung und einheitliche Header
- `src/components/meetings/SystemAgendaItem.tsx` - Kompakter isEmbedded-Modus

**Aenderungen:**
- "Meine Notizen" und "Kommende Termine" zeigen jetzt Nummerierung (z.B. "2.1")
- Einheitlicher Header-Stil mit Icon und Titel
- Kompaktes Rendering im embedded-Modus ohne Card-Wrapper

### 2. Creator-Response speichern
**Datei:** `src/components/task-decisions/DecisionOverview.tsx`

**Aenderungen:**
- Verbesserte Fehlerbehandlung mit detailliertem Logging
- Explizite Rueckgabe der aktualisierten Daten zur Verifizierung
- Trim auf den Response-Text angewendet

### 3. Task-Status Admin-Verwaltung
**Dateien:**
- `src/pages/Administration.tsx` - Zweite ConfigurableTypeSettings Instanz
- `src/components/administration/ConfigurableTypeSettings.tsx` - task_statuses zum Type hinzugefuegt

**Aenderungen:**
- Task-Status sind jetzt unter Administration > Datentypen > Aufgaben editierbar
- Unterstuetzt Aktivieren/Deaktivieren, Umbenennen, Loeschen, Reihenfolge aendern

### 4. Viewer-Kommentare fuer Entscheidungen
**Neue Datei:** `src/components/task-decisions/DecisionViewerComment.tsx`

**Aenderungen:**
- Neue Komponente fuer Nicht-Teilnehmer zum Kommentieren
- Wird bei oeffentlichen Entscheidungen angezeigt
- Erstellt automatisch einen Participant-Eintrag und Response
- Benachrichtigt den Ersteller

### 5. Entscheidungen bearbeiten
**Datei:** `src/components/task-decisions/DecisionEditDialog.tsx`

**Status:** Bereits voll funktional. Ermoeglicht:
- Titel und Beschreibung aendern
- Oeffentlichkeit umschalten
- Teilnehmer hinzufuegen/entfernen
- Themen zuweisen

---

## Zukuenftige Erweiterungen (Punkt 6)

| Feature | Beschreibung | Prioritaet |
|---------|--------------|------------|
| **Deadline/Frist** | Ablaufdatum fuer Entscheidungen mit Erinnerungen | Hoch |
| **Abstimmungs-Ergebnis-Badge** | Klares "Angenommen/Abgelehnt" Badge nach Abschluss | Mittel |
| **Automatische Archivierung** | Nach X Tagen ohne ausstehende Antworten | Niedrig |
| **Export als PDF** | Entscheidung mit allen Antworten exportieren | Niedrig |
| **Verlinkung zu Aufgaben** | Aus Entscheidung direkt Aufgabe erstellen | Mittel |
| **Vorlagen fuer Entscheidungen** | Wiederverwendbare Entscheidungs-Templates | Mittel |

---

## Zusammenfassung der geaenderten Dateien

| Datei | Aenderungen |
|-------|-------------|
| `src/components/MeetingsView.tsx` | CalendarDays Import, System-Item-Rendering mit Nummerierung |
| `src/components/meetings/SystemAgendaItem.tsx` | Kompakter isEmbedded-Modus ohne Card-Wrapper |
| `src/components/task-decisions/DecisionOverview.tsx` | sendCreatorResponse Fix, DecisionViewerComment Integration |
| `src/components/task-decisions/DecisionViewerComment.tsx` | **NEU** - Viewer-Kommentar-Komponente |
| `src/pages/Administration.tsx` | task_statuses ConfigurableTypeSettings hinzugefuegt |
| `src/components/administration/ConfigurableTypeSettings.tsx` | task_statuses zum tableName Type hinzugefuegt |
