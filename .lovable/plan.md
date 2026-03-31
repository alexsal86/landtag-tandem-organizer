

# Meeting-Abschluss: Analyse, Protokoll-Verbesserung und Bestätigungsansicht

## Ist-Zustand: Was passiert beim Archivieren?

Der `archiveMeeting`-Flow in `useMeetingArchive.ts` verarbeitet folgende System-Punkte:

| System-Typ | Verarbeitung beim Archivieren | Status |
|---|---|---|
| **Agenda-Punkte mit Zuweisung** (ohne task_id) | Aufgabe erstellt mit Beschreibung + Ergebnis | Funktioniert |
| **Agenda-Punkte mit verknupfter Aufgabe** (task_id) | Kind-Aufgabe unter bestehender Aufgabe erstellt | Funktioniert |
| **Geburtstage** (`system_type='birthdays'`) | Aufgaben pro Kontakt mit Aktion (Karte/Mail/etc.) | Funktioniert |
| **Markierte Termine** (starred_appointments) | Eltern-Aufgabe + Kind-Aufgaben pro Termin | Funktioniert |
| **Quick Notes** (Ergebnisse) | `meeting_result` in quick_notes gespeichert | Funktioniert |
| **Vorgange/Case Items** (Ergebnisse) | Notiz in `case_item_notes` erstellt | Funktioniert |
| **Ubertrag-Punkte** (carry_over_to_next) | In nachstes Meeting oder Buffer ubertragen | Funktioniert |
| **Entscheidungen** (`system_type='decisions'`) | **NICHT verarbeitet** — offene Entscheidungen werden beim Archivieren ignoriert |
| **Aufgaben** (`system_type='tasks'`) | Nur indirekt uber task_id-Verknupfung — der System-Punkt selbst wird nicht separat verarbeitet |

### Lucken
1. **Entscheidungen werden nicht aktualisiert** — wenn im Fokus-Modus ein Ergebnis fur eine Entscheidung eingetragen wurde, wird dieses nicht in die `decisions`-Tabelle zuruckgeschrieben
2. **Das Protokoll zeigt nur Basis-Daten** — keine Quick Notes, keine Entscheidungen, keine erstellten Aufgaben, keine Vorgange, keine Geburtstags-Aktionen

### Nach dem Archivieren
- Der State wird komplett zuruckgesetzt (`setActiveMeeting(null)`, etc.)
- Der User sieht nur einen kurzen Toast: "Besprechung archiviert"
- Kein Protokoll, keine Zusammenfassung

---

## Umsetzungsplan

### 1. Protokoll-Ansicht erweitern (`MeetingProtocolView.tsx`)

Das aktuelle Protokoll ladt nur `meeting_agenda_items` mit Basis-Feldern. Es soll zusatzlich laden und anzeigen:

- **Teilnehmer**: Meeting-Ersteller + `meeting_participants` mit Profilnamen
- **Entscheidungen**: Aus `decisions`-Tabelle, die mit dem Meeting verknupft sind (uber `meeting_agenda_items` mit `system_type='decisions'`)
- **Quick Notes mit Ergebnissen**: Notes die `meeting_id` haben und `meeting_result` enthalten
- **Vorgange/Case Items**: Verknupfte Case Items mit ihren Meeting-Ergebnissen
- **Erstellte Aufgaben**: Aufgaben mit `category='meeting'` die bei der Archivierung erstellt wurden (uber Beschreibung mit Meeting-Titel/Datum identifizierbar)
- **Hierarchische Agenda**: `parent_id` berucksichtigen fur Haupt-/Unterpunkte
- **System-Typ-Icons**: Visuell unterscheiden zwischen normalen Punkten, Geburtstagen, Quick Notes, etc.

### 2. Protokoll nach Archivierung anzeigen

In `useMeetingArchive.ts` und `MeetingsView.tsx`:

- Neuen State `archivedMeetingId` in `useMeetingsData` einfuhren
- Nach erfolgreichem Archivieren: statt nur Toast + Reset, zusatzlich `archivedMeetingId` setzen
- In `MeetingsView.tsx`: wenn `archivedMeetingId` gesetzt ist, das erweiterte Protokoll als Bestatigungs-Overlay/Ansicht rendern
- Mit Button "Zuruck zur Ubersicht" den State zurucksetzen
- Auch aus dem Fokus-Modus heraus soll nach Archivierung das Protokoll erscheinen

### 3. Entscheidungs-Ergebnisse beim Archivieren zuruckschreiben (optional)

In `useMeetingArchive.ts` einen neuen Schritt einfugen:
- Agenda-Items mit `system_type='decisions'` und `result_text` finden
- Die verknupfte Entscheidung in der `decisions`-Tabelle mit dem Ergebnis aktualisieren (Status auf 'decided' setzen, `result` fullen)

---

## Technische Details

**Betroffene Dateien:**
- `src/components/MeetingProtocolView.tsx` — erweitern um Teilnehmer, Entscheidungen, Quick Notes, Case Items, erstellte Tasks, Hierarchie
- `src/components/meetings/hooks/useMeetingArchive.ts` — nach Archivierung Meeting-ID zuruckgeben statt nur Reset
- `src/components/meetings/hooks/useMeetingsData.ts` — neuer State `archivedMeetingId`
- `src/components/MeetingsView.tsx` — Protokoll-Ansicht nach Archivierung rendern

**Protokoll-Sektionen (neu):**
```text
Besprechungsprotokoll
├── Header (Titel, Datum, Ort)
├── Teilnehmer
├── Tagesordnung mit Ergebnissen (hierarchisch)
│   ├── Hauptpunkte mit Unterpunkten
│   ├── Notizen + Ergebnisse
│   └── Zuweisungen
├── Entscheidungen (violett markiert)
├── Besprochene Notizen (amber markiert)
├── Besprochene Vorgänge (mit Ergebnissen)
├── Markierte Termine
├── Erstellte Aufgaben (Zusammenfassung)
└── Footer
```

