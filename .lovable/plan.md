

# Plan: Mitarbeitergespraeche -- Vollstaendige Ueberarbeitung

## Analyse: Warum funktioniert aktuell nichts?

### Kritisches Problem: RLS-Policy blockiert Zugriff

Die RLS-Policy auf `employee_meetings` erlaubt Mitarbeitern NUR den Zugriff auf **abgeschlossene** Gespraeche:

```
Employees can view their own completed meetings:
  (employee_id = auth.uid()) AND (status = 'completed')
```

Das bedeutet: Wenn ein Gespraech geplant wird (`status = 'scheduled'`), kann der Mitarbeiter es **nicht oeffnen**. Auch waehrend der Durchfuehrung (`status = 'in_progress'`) hat der Mitarbeiter keinen Zugriff. Der Vorgesetzte wiederum braucht eine Zuordnung ueber `employee_settings.admin_id` -- falls diese fehlt, kann auch er nichts sehen.

**Loesung:** Die RLS-Policy muss erweitert werden, damit Mitarbeiter ALLE ihre eigenen Gespraeche sehen koennen (scheduled, in_progress, completed). Zusaetzlich sollte der `conducted_by`-User immer Zugriff haben.

---

## Umsetzungsplan

### 1. RLS-Policies korrigieren (kritisch)

Alte Policy `Employees can view their own completed meetings` ersetzen durch:

**Neue Policies auf `employee_meetings`:**
- `Employees can view their own meetings` (SELECT): `employee_id = auth.uid()`
- `Employees can update their meeting data` (UPDATE): `employee_id = auth.uid()` -- damit sie Vorbereitung und Protokoll bearbeiten koennen
- `Conductors can manage their meetings` (ALL): `conducted_by = auth.uid()` -- als Backup neben der admin_id-Policy

So kann jeder Beteiligte das Gespraech oeffnen, bearbeiten und einsehen -- unabhaengig vom Status.

**Datei:** SQL-Migration

---

### 2. Protokoll-Editor: Textarea durch SimpleRichTextEditor ersetzen

Aktuell nutzt `EmployeeMeetingProtocol.tsx` ueberall `Textarea`-Komponenten (ca. 15 Stueck). Diese werden durch `SimpleRichTextEditor` ersetzt fuer:

- Alle Protokoll-Felder (Stimmung, Arbeitsbelastung, Work-Life-Balance, etc.)
- Vorbereitungs-Notizen (Mitarbeiter + Vorgesetzter)
- Private Notizen
- Action-Item-Beschreibungen

Die gespeicherten Daten werden als HTML in `protocol_data` (JSONB) abgelegt. Die Anzeige im Readonly-Modus nutzt `RichTextDisplay`.

**Datei:** `EmployeeMeetingProtocol.tsx`

---

### 3. Bewertungsskalen hinzufuegen

Im Protokoll-Tab werden fuer drei Felder visuelle 1-5-Skalen hinzugefuegt:

| Feld | Skala | Labels |
|------|-------|--------|
| Zufriedenheit | 1-5 Sterne | Sehr unzufrieden -- Sehr zufrieden |
| Arbeitsbelastung | 1-5 | Zu wenig -- Ueberlastet |
| Work-Life-Balance | 1-5 | Sehr schlecht -- Sehr gut |

Umsetzung: Klickbare Icon-Reihe (z.B. gefuellte/leere Kreise). Die Werte werden als `wellbeing_mood_rating`, `wellbeing_workload_rating`, `wellbeing_balance_rating` im `protocol_data`-JSONB gespeichert.

**Datei:** `EmployeeMeetingProtocol.tsx` (neue Sub-Komponente `RatingScale`)

---

### 4. Action Items mit dem globalen Aufgaben-System verknuepfen

Beim Erstellen eines Action Items wird optional eine Aufgabe in der `tasks`-Tabelle erstellt:

- Checkbox "Als Aufgabe anlegen" im Action-Item-Formular
- Wenn aktiviert: Aufgabe mit Titel = Action-Item-Beschreibung, Deadline = Faelligkeitsdatum, zugewiesen an den `assigned_to`-User
- Die `employee_meeting_action_items`-Tabelle bekommt ein neues Feld `task_id` (UUID, nullable) fuer die Verknuepfung
- Status-Sync: Wenn die Aufgabe erledigt wird, wird auch das Action Item als "completed" markiert (oder umgekehrt)

**Dateien:** SQL-Migration (`task_id`-Spalte), `EmployeeMeetingProtocol.tsx`

---

### 5. Auto-Save-Indikator sichtbar machen

Aktuell speichert der Editor alle 30 Sekunden, aber es gibt keinen visuellen Hinweis. Ergaenzungen:

- Kleine Badge/Text im Header: "Gespeichert um HH:MM" / "Speichere..." / "Ungespeicherte Aenderungen"
- Farblicher Indikator (gruen = gespeichert, gelb = ungespeichert, grau = speichere)
- Debounced Auto-Save (3 Sekunden nach letzter Aenderung statt fixer 30s)

**Datei:** `EmployeeMeetingProtocol.tsx`

---

### 6. Gespraechsdetail-Seite verbessern

Die Seite `EmployeeMeetingDetail.tsx` wird ueberarbeitet:

- Padding an das Sticky-Layout anpassen (analog zu CaseFiles)
- Zurueck-Button entfernen (Navigation ueber Sidebar)
- Breadcrumb oder kontextuelle Info im Header anzeigen (Mitarbeitername + Datum)
- Loading-State verbessern (Skeleton statt Fullscreen-Spinner)

**Datei:** `EmployeeMeetingDetail.tsx`

---

### 7. Gespraechshistorie zugaenglich machen

Die `EmployeeMeetingHistory`-Komponente ist im Admin-Bereich eingebettet (Zeile 1802), aber fuer Mitarbeiter nicht erreichbar. Aenderungen:

- In der Mitarbeiter-Selbstansicht (nicht-Admin) einen Tab oder Abschnitt "Meine Gespraeche" hinzufuegen, der die `EmployeeMeetingHistory` mit `employeeId={user.id}` rendert
- Klick auf eine Zeile oeffnet das Gespraech via `navigate(/employee-meeting/...)`
- Mitarbeiter sehen alle eigenen Gespraeche (scheduled + in_progress + completed), nicht nur abgeschlossene

**Datei:** `EmployeesView.tsx` (Mitarbeiter-Selbstansicht, ca. Zeile 1292-1340)

---

### 8. Abschluss-Workflow verbessern

Wenn ein Gespraech als "abgeschlossen" markiert wird:

- `completed_at`-Timestamp setzen (passiert bereits)
- `employee_settings.last_meeting_date` aktualisieren (fehlt beim Abschluss -- wird nur beim Planen gesetzt)
- Naechstes Gespraech automatisch berechnen und in `employee_settings` aktualisieren
- Benachrichtigung an den Mitarbeiter senden
- Alle offenen Action Items markieren (Warnung, falls noch offene Items existieren)

**Datei:** `EmployeeMeetingProtocol.tsx` (Funktion `markAsCompleted`)

---

### 9. Status-Uebergaenge im Protokoll

Aktuell gibt es keinen Button, um ein Gespraech von "scheduled" auf "in_progress" zu setzen. Ergaenzung:

- Button "Gespraech starten" im Header, wenn Status = "scheduled" (setzt auf "in_progress")
- Button "Gespraech abschliessen" im Header, wenn Status = "in_progress" (setzt auf "completed")
- Visueller Status-Indikator mit Fortschrittsleiste (3 Schritte: Geplant -> In Durchfuehrung -> Abgeschlossen)

**Datei:** `EmployeeMeetingProtocol.tsx`

---

## Technische Zusammenfassung

### SQL-Migration

1. RLS-Policy auf `employee_meetings` aendern: Mitarbeiter sehen ALLE eigenen Gespraeche + conducted_by-User hat vollen Zugriff
2. Spalte `task_id` (UUID, nullable, FK auf tasks) auf `employee_meeting_action_items` hinzufuegen

### Dateien

| Datei | Aenderungen |
|-------|-------------|
| SQL-Migration | RLS-Fix + task_id-Spalte |
| `EmployeeMeetingProtocol.tsx` | Rich-Text-Editor, Bewertungsskalen, Auto-Save-Indikator, Status-Uebergaenge, Abschluss-Workflow, Action-Item-Task-Link |
| `EmployeeMeetingDetail.tsx` | Layout-Fix, Zurueck-Button entfernen, Padding |
| `EmployeesView.tsx` | Gespraechshistorie fuer Mitarbeiter-Selbstansicht |
| `EmployeeMeetingHistory.tsx` | Anzeige auch fuer nicht-abgeschlossene Gespraeche |

