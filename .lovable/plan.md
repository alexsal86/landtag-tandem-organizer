
# Plan: Umfassende Überarbeitung des Meeting-Systems

## Zusammenfassung der identifizierten Probleme

Nach eingehender Analyse des Codes und der Datenbankstruktur wurden folgende Probleme identifiziert:

---

## 1. Meeting-Daten können nicht bearbeitet werden (Fehlermeldung erscheint)

**Ursache:** Die `updateMeeting`-Funktion (Zeilen 1990-2041) aktualisiert erfolgreich die Datenbank, aber es gibt Timing-Probleme und fehlende Fehlerbehandlung. Die Uhrzeit wird nicht separat in der `meetings`-Tabelle gespeichert (nur `meeting_date` als DATE, nicht TIMESTAMP).

**Probleme im Detail:**
- Die `meetings`-Tabelle hat `meeting_date` als `date` (nicht timestamp) - Uhrzeitinformationen gehen verloren
- Die Fehlermeldung erscheint, aber die Änderungen werden übernommen = optimistisches Update fehlt teilweise
- Bei Appointments wird versucht, `start_time` und `end_time` zu aktualisieren, aber die Zeit kommt aus `newMeetingTime`-State, der nicht meeting-spezifisch ist

**Lösung:**
- Schema erweitern: `meeting_time` Spalte zur `meetings`-Tabelle hinzufügen (oder `meeting_date` zu `timestamp` ändern)
- `updateMeeting`-Funktion: lokalen State sofort optimistisch aktualisieren
- Fehlerbehandlung verbessern mit spezifischen Fehlermeldungen

---

## 2. Archiv-Button Position

**Aktuelle Position:** Zeile 2368 - als Link unterhalb der Überschrift

**Lösung:** Button nach rechts neben "+ Neues Meeting" verschieben in der Header-Leiste (Zeile 2163-2169)

---

## 3. Agenda-Titel fehlt Datum und Uhrzeit

**Aktuelle Anzeige (Zeile 3065-3067):**
```tsx
<h2 className="text-xl font-semibold">
  Agenda: {selectedMeeting.title}
</h2>
```

**Lösung:**
```tsx
<h2 className="text-xl font-semibold">
  Agenda: {selectedMeeting.title} am {format(selectedMeeting.meeting_date, "EEEE, d. MMMM 'um' HH:mm 'Uhr'", { locale: de })}
</h2>
```

---

## 4. Aufgaben-Auswahl zeigt alle Tenant-Aufgaben

**Aktuelle Logik (Zeile 369-376):** `loadTasks` lädt alle Aufgaben mit `status = 'todo'` ohne Benutzerfilter

**Lösung:** Filter hinzufügen für:
- `created_by = auth.uid()` ODER
- `assigned_to` enthält aktuellen Benutzer

```typescript
const loadTasks = async () => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'todo')
    .or(`created_by.eq.${user?.id},assigned_to.cs.{${user?.id}}`)
    .order('created_at', { ascending: false });
  // ...
};
```

---

## 5. Notizen zu Hauptagendapunkten fehlen

**Aktuell:** Nur Unterpunkte haben Notizen- und Beschreibungsfelder (Zeilen 3222-3288)

**Lösung:** Auch für Hauptpunkte (ohne `parent_id`) ein Notizfeld hinzufügen:
- Nach dem Titel-Input: Collapsible-Bereich für "Beschreibung/Notizen" zu Hauptpunkten hinzufügen
- Nur in der Planungsphase (nicht im aktiven Meeting) sichtbar

---

## 6. Fehler beim Löschen von Agendapunkten

**Ursache (Zeilen 1747-1793):** Die `deleteAgendaItem`-Funktion löscht optimistisch, zeigt aber eine Fehlermeldung wenn das Netzwerk verzögert antwortet (analog zum bekannten "Failed to fetch"-Muster)

**Lösung:** Resilientes Lösch-Pattern implementieren:
```typescript
const deleteAgendaItem = async (item: AgendaItem, index: number) => {
  // Optimistisches Löschen
  const previousItems = [...agendaItems];
  setAgendaItems(items => items.filter((_, i) => i !== index));
  
  if (item.id) {
    try {
      const { error } = await supabase
        .from('meeting_agenda_items')
        .delete()
        .eq('id', item.id);
      
      if (error && !error.message?.includes('Failed to fetch')) {
        setAgendaItems(previousItems);
        throw error;
      }
      // Bei "Failed to fetch" - optimistisch bleiben
    } catch (error) {
      // Nur bei echten Fehlern rollback
    }
  }
};
```

---

## 7. Stern-Markierung für Termine

**Anforderung:** In "Kommende Termine" sollen einzelne Termine mit einem Stern markiert werden können, um mehr Besprechungsbedarf zu signalisieren.

**Lösung:**
1. Schema erweitern: Neue Tabelle `starred_appointments`:
   ```sql
   CREATE TABLE starred_appointments (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
     meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
     user_id UUID NOT NULL,
     created_at TIMESTAMPTZ DEFAULT now()
   );
   ```
2. In `UpcomingAppointmentsSection.tsx`: Star-Icon neben jedem Termin
3. Markierte Termine visuell hervorheben (goldener Stern, Hintergrundfarbe)

---

## 8. Personen-Zuweisung zu Agendapunkten mit Aufgabenerstellung

**Aktuelle Situation:** Im aktiven Meeting gibt es bereits eine Zuweisungs-Dropdown (Zeilen 2603-2622), aber keine automatische Aufgabenerstellung beim Archivieren

**Lösung in `archiveMeeting` (ab Zeile 1038):**
- Für jeden Agendapunkt mit `assigned_to` UND `result_text`: Eigene Aufgabe erstellen (nicht nur Subtask)
- Aufgabe enthält:
  - Titel: Agendapunkt-Titel
  - Beschreibung: Ergebnis + Verweis auf Meeting + Link zum Archiv
  - Zugewiesen an: `assigned_to`
  - Referenz: `source_meeting_id`

---

## 9. Archivierungs-Popup und Fehler

**Aktuell (Zeile 2531-2536):**
```tsx
onClick={() => {
  console.log('=== ARCHIVE BUTTON CLICKED ===');
  alert('Button wurde geklickt!'); // <-- Dieses Alert entfernen!
  archiveMeeting(activeMeeting);
}}
```

**Probleme:**
- Debug-Alert muss entfernt werden
- `archiveMeeting` hat potenzielle Fehlerquellen (Zeilen 970-1189):
  - Fehler bei `followUpTask`-Erstellung blockiert den gesamten Prozess
  - Fehler bei Subtask-Erstellung wird nicht ordentlich behandelt

**Lösung:**
1. Alert entfernen
2. Archivierungs-Prozess robuster gestalten mit Try-Catch pro Schritt
3. AlertDialog für Bestätigung vor dem Archivieren (optional)

---

## 10. Carryover-Punkte (auf nächste Besprechung übertragen)

**Aktuelle Implementierung (Zeilen 1191-1297):** 
- `processCarryoverItems` prüft ob es ein nächstes Meeting gibt
- Falls ja: direkt übertragen mit `transferItemsToMeeting`
- Falls nein: in `carryover_items` Tabelle speichern

**Problem:** Die `carryover_items` werden nicht beim Erstellen eines neuen Meetings automatisch geladen und als "Offene Punkte aus letzter Besprechung" angezeigt

**Lösung:**
1. Beim Laden der Agenda prüfen ob es `carryover_items` für dieses Template gibt
2. Diese als spezielle Agenda-Sektion "Offene Punkte aus letzter Besprechung" anzeigen
3. UI zeigt: Ursprungs-Meeting-Titel, Datum, Inhalt des Punktes
4. Trigger `handle_meeting_insert` (bereits vorhanden) fügt diese automatisch ein

**Frontend-Änderung:**
- Punkte mit `source_meeting_id IS NOT NULL` in eigener Sektion "Übertragene Punkte" anzeigen

---

## 11. Grafische und inhaltliche Verbesserungen

### Meeting-Card Verbesserungen (Zeilen 2371-2512)

**Aktuelle Card zeigt:**
- Titel
- Ort und Datum
- Start/Bearbeiten-Button

**Verbesserungen:**
1. **Beschreibung unter Titel anzeigen** (wenn vorhanden)
2. **Uhrzeit neben Datum anzeigen** (aus `meeting_time` wenn implementiert)
3. **Teilnehmer als Avatare anzeigen** (wie bei Planung)
4. **Icons passend machen:**
   - CalendarIcon für Datum
   - Clock für Uhrzeit
   - MapPin für Ort
   - Users für Teilnehmer

### Teilnehmer-Feld in Card-Bearbeitung

**Problem:** Das Teilnehmer-Feld fehlt bei der Inline-Bearbeitung der Meeting-Card

**Lösung:** In den Bearbeitungs-Modus (Zeilen 2382-2471) den `MeetingParticipantsManager` integrieren

### Weitere UI-Verbesserungen:

1. **Visueller Fortschritt im aktiven Meeting:**
   - Abgehakte Punkte durchgestrichen darstellen
   - Fortschrittsbalken oben (X von Y Punkten besprochen)

2. **Timer für Meeting-Dauer:**
   - Anzeige der verstrichenen Zeit seit Meeting-Start

3. **Exportfunktion:**
   - Meeting-Protokoll als PDF exportieren

4. **Tastaturnavigation:**
   - Enter zum Speichern von Änderungen
   - Tab zum Wechseln zwischen Feldern

---

## Technischer Implementierungsplan

### Datenbank-Änderungen

```sql
-- 1. Uhrzeit-Spalte für Meetings
ALTER TABLE meetings ADD COLUMN meeting_time TIME;

-- 2. Stern-Markierungen für Termine
CREATE TABLE starred_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(appointment_id, meeting_id, user_id)
);

ALTER TABLE starred_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their starred appointments"
ON starred_appointments FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### Frontend-Änderungen

| # | Datei | Änderung |
|---|-------|----------|
| 1 | `MeetingsView.tsx` | Alert entfernen, Archiv-Button nach oben, Uhrzeit in Agenda-Titel |
| 2 | `MeetingsView.tsx` | `loadTasks` filtern auf eigene/zugewiesene Aufgaben |
| 3 | `MeetingsView.tsx` | Notizen für Hauptpunkte in Planungsphase hinzufügen |
| 4 | `MeetingsView.tsx` | Resilientes Löschen implementieren |
| 5 | `MeetingsView.tsx` | Meeting-Card mit Beschreibung, Uhrzeit, Teilnehmern erweitern |
| 6 | `MeetingsView.tsx` | Teilnehmer-Editor bei Card-Bearbeitung hinzufügen |
| 7 | `MeetingsView.tsx` | Carryover-Punkte-Sektion anzeigen |
| 8 | `MeetingsView.tsx` | `archiveMeeting` für Aufgabenerstellung bei Zuweisung erweitern |
| 9 | `UpcomingAppointmentsSection.tsx` | Stern-Markierung für Termine |

### Erwartete Ergebnisse

1. **Meetings bearbeitbar** - Alle Felder inkl. Uhrzeit und Teilnehmer änderbar
2. **Archiv-Button** - Gut sichtbar in der Header-Zeile
3. **Informativer Agenda-Titel** - Mit Datum und Uhrzeit
4. **Relevante Aufgaben** - Nur eigene und zugewiesene sichtbar
5. **Hauptpunkt-Notizen** - Vorbereitungsnotizen möglich
6. **Fehlerfreies Löschen** - Keine falschen Fehlermeldungen
7. **Stern-Termine** - Wichtige Termine hervorheben
8. **Automatische Aufgaben** - Bei Zuweisung nach Meeting-Ende
9. **Fehlerfreies Archivieren** - Kein Debug-Popup, robuster Prozess
10. **Carryover-Übersicht** - Punkte aus vorheriger Besprechung sichtbar
11. **Verbesserte UI** - Mehr Informationen, bessere Übersicht
