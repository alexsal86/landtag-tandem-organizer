

# Vorgaenge (Case Items) in Meetings integrieren

## Ueberblick

Vorgaenge sollen als neuer System-Typ `case_items` in Meeting-Agendas erscheinen -- analog zu Aufgaben, Entscheidungen und Quick Notes. Dazu braucht es DB-Aenderungen, Daten-Laden, UI-Rendering und die Moeglichkeit, Vorgaenge fuer den naechsten Jour Fixe vorzumerken.

## Technische Aenderungen

### 1. Datenbank-Migration

Zwei neue Spalten auf `case_items`:
- `meeting_id uuid REFERENCES meetings(id) ON DELETE SET NULL` -- Verknuepfung mit einem konkreten Meeting
- `pending_for_jour_fixe boolean DEFAULT false` -- Vormerkung fuer den naechsten Jour Fixe

### 2. Daten laden (`useMyWorkJourFixeSystemData.ts`)

- Neuen State `meetingCaseItems` hinzufuegen (analog zu `meetingTasks`)
- In `loadMeetingSystemData`: wenn Agenda `system_type === 'case_items'` enthaelt, `case_items` mit `meeting_id = meetingId` laden (Spalten: `id, subject, status, priority, due_at, owner_user_id`)
- Im Return-Objekt zurueckgeben

### 3. `SystemAgendaItem.tsx` erweitern

- Neuen `systemType: 'case_items'` unterstuetzen mit:
  - Farbe: Teal (`border-l-teal-500`, Icon `Briefcase`)
  - Titel: "Vorgaenge"
  - Rendering: Liste der verknuepften Case Items mit Subject, Status-Badge und Frist
- Neue Prop `linkedCaseItems` hinzufuegen

### 4. `MeetingsView.tsx` erweitern

- Neuer State `meetingLinkedCaseItems`
- Neue Funktion `loadMeetingLinkedCaseItems(meetingId)` -- laedt `case_items` mit `meeting_id = meetingId`
- Bei Meeting-Auswahl mitladen (wie `loadMeetingLinkedTasks`)
- `addSystemAgendaItem` Typ erweitern um `'case_items'`
- Neuer Button "Vorgaenge" in der System-Agenda-Auswahl (beide Stellen: Top-Level + Sub-Items)
- Rendering-Block fuer `item.system_type === 'case_items'` (analog zum Tasks-Block) mit Ergebnis-Textarea pro Vorgang
- `SystemAgendaItem` Aufruf um `linkedCaseItems` erweitern

### 5. Vorgaenge vormerken / verknuepfen

Im Vorgangs-Tab (CaseItems-Bereich) das bestehende Kontextmenue um zwei Optionen erweitern:
- "Fuer Jour Fixe vormerken" -- setzt `pending_for_jour_fixe = true`
- "Einem Meeting zuordnen" -- setzt `meeting_id`

Analog zum bestehenden Pattern bei Tasks und Quick Notes.

### 6. `PendingJourFixeNotes.tsx`-Aequivalent

Im Meeting-Vorbereitungsbereich die vorgemerkten Vorgaenge (`pending_for_jour_fixe = true`) anzeigen, damit sie beim Erstellen der Agenda zugeordnet werden koennen.

### 7. Archivierung

Beim Archivieren eines Meetings (`archiveMeeting`): Ergebnisse der Vorgaenge-System-Items verarbeiten -- Ergebnis-Text als Timeline-Event oder Kommentar am Vorgang speichern (analog zur Task-Archivierung).

## Betroffene Dateien

| Datei | Aenderung |
|-------|-----------|
| Migration SQL | `meeting_id` + `pending_for_jour_fixe` auf `case_items` |
| `useMyWorkJourFixeSystemData.ts` | Case Items laden |
| `SystemAgendaItem.tsx` | Neuer Typ `case_items` |
| `MeetingsView.tsx` | State, Laden, Buttons, Rendering |
| `FocusModeView.tsx` | `linkedCaseItems` Prop durchreichen |
| `Administration.tsx` | Vorlagen-Editor: neuer System-Typ |
| Vorgangs-Kontextmenue | Jour-Fixe-Vormerkung + Meeting-Zuordnung |

