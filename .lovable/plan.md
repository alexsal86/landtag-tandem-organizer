

# Plan: FallAkten-Detailansicht ueberarbeiten (10 Punkte)

Das ist ein umfangreiches Refactoring der FallAkten-Detailansicht mit UI-Anpassungen, neuen Features und einer neuen Datenbank-Tabelle. Hier die Umsetzung:

---

## 1. Abstand und Zurueck-Link entfernen

**Problem:** Der Abstand zum Header/Navigation stimmt nicht und der "Zurueck"-Button auf der Detail-Seite stoert.

**Loesung:**
- In `CaseFilesView.tsx`: Das `p-6` Padding anpassen, damit es zum Sticky-Layout passt
- In `CaseFileDetailHeader.tsx`: Den gesamten "Zurueck"-Button-Bereich entfernen
- In `CaseFileDetail.tsx`: Die Navigation zurueck ueber den Browser oder die Seitennavigation loesen (der Zurueck-Button im Dropdown-Menue bleibt als Fallback)

---

## 2. Badges nach rechts unten im Header verschieben

**Problem:** Badges (Status, Prioritaet) stehen ueber dem Titel. Titel und Beschreibung sollen prominent sein.

**Loesung:**
- In `CaseFileDetailHeader.tsx`: Layout umbauen -- Titel und Beschreibung oben, Badges (Status, Prioritaet) nach rechts unten in der Card
- Kategorie-Badge und Sichtbarkeits-Badge in die linke Sidebar "Metadaten"-Card verschieben (`CaseFileLeftSidebar.tsx`)

---

## 3. Beteiligte aufteilen: Personen vs. Institutionen

**Problem:** Alle Kontakte werden in einer Liste angezeigt, unabhaengig ob Person oder Institution.

**Loesung:**
- In `CaseFileLeftSidebar.tsx`: Kontakte anhand von `contact_type` gruppieren
  - `contact_type = 'person'` (oder null) -> Abschnitt "Personen"
  - `contact_type = 'organization'` -> Abschnitt "Institutionen"
- Zwei separate Abschnitte mit eigenen Icons (Users fuer Personen, Building2 fuer Institutionen)
- Die `contacts`-Tabelle hat bereits ein `contact_type`-Feld

---

## 4. Chronologie: Verknuepfungen als kompakte Eintraege

**Problem:** Reine Verknuepfungen (z.B. "Kontakt verknuepft") werden als eigenstaendige Ereignisse in der Timeline angezeigt. Das ist zu viel Rauschen.

**Loesung:**
- In `CaseFileUnifiedTimeline.tsx`: Timeline-Eintraege mit `source_type` wie 'contact', 'task', 'document', etc. nicht als separate Karten anzeigen
- Stattdessen: Verknuepfte Elemente direkt als kompakte Zeilen darstellen: "Dokument XY hinzugefuegt" mit kleinem Icon und Datum
- Manuelle Timeline-Eintraege (`source_type = 'manual'`) behalten ihre volle Darstellung
- Alternativ: Die automatischen Timeline-Eintraege (`createTimelineEntry` in `useCaseFileDetails.tsx`) gar nicht mehr erzeugen, sondern die verknuepften Items (Dokumente, Aufgaben, etc.) direkt chronologisch aus ihrem `created_at` in den Feed einmischen (das passiert bereits). Die doppelte "Verknuepft"-Meldung entfaellt.

---

## 5. Monats-Header in der Chronologie prominenter

**Problem:** Monats-Ueberschriften sind klein und grau (`text-xs text-muted-foreground`).

**Loesung:**
- In `CaseFileUnifiedTimeline.tsx`: Die `h3`-Klasse aendern von `text-xs font-semibold text-muted-foreground` zu `text-sm font-bold text-foreground` -- groesser, schwarz/fett, gut lesbar

---

## 6. Zustaendiger Bearbeiter zuweisen

**Problem:** Die FallAkte hat bereits ein `assigned_to`-Feld (UUID) in der Datenbank, aber es gibt keine UI dafuer.

**Loesung:**
- In `CaseFileDetailHeader.tsx` oder `CaseFileLeftSidebar.tsx` (Metadaten-Bereich): Einen `UserSelector` einbauen, um den zustaendigen Bearbeiter zu setzen
- In `useCaseFileDetails.tsx`: Neue Funktion `updateAssignedTo(userId)` die `case_files.assigned_to` aktualisiert
- In `CaseFileCreateDialog.tsx`: Optional auch dort ein Feld fuer den Bearbeiter hinzufuegen
- Den zugewiesenen Bearbeiter mit Avatar und Name im Header oder in der Sidebar anzeigen

---

## 7. Schnell-Aufgabe als Unteraufgabe mit Eltern-Aufgabe

**Problem:** Die Schnell-Aufgabe erstellt eine einzelne Aufgabe, aber der Wunsch ist: Eine Hauptaufgabe (Titel = Fallakte-Titel) existiert, und Schnell-Aufgaben werden als Unteraufgaben davon erstellt.

**Loesung:**
- In `CaseFileNextSteps.tsx`: Beim ersten Schnell-Aufgabe-Klick pruefen, ob bereits eine Hauptaufgabe fuer diese FallAkte existiert (z.B. ueber eine Konvention: Aufgabe mit identischem Titel + Verknuepfung)
- Falls nicht: Automatisch eine Hauptaufgabe erstellen mit dem Titel der FallAkte
- Die Schnell-Aufgabe wird als Unteraufgabe (`parent_task_id`) dieser Hauptaufgabe erstellt
- Beide Aufgaben werden dem `assigned_to`-Bearbeiter zugewiesen (falls gesetzt)
- Die Hauptaufgabe wird zur FallAkte verknuepft

Voraussetzung: Die `tasks`-Tabelle muss ein `parent_task_id`-Feld haben. Falls nicht vorhanden, wird dieses per Migration hinzugefuegt.

---

## 8. Aktueller Stand mit besserem Editor + Versionierung

**Problem:** Der aktuelle Stand ist nur ein einfaches Textarea. Es fehlt ein Rich-Text-Editor und eine Versionierung.

**Loesung:**
- In `CaseFileCurrentStatus.tsx`: Das `Textarea` durch den `SimpleRichTextEditor` ersetzen (wie bei Quick Notes)
- Neue DB-Tabelle `case_file_status_history`:
  ```text
  id (uuid), case_file_id (uuid), content (text), 
  user_id (uuid), created_at (timestamptz)
  ```
- Bei jedem Speichern: Alten Stand in die History-Tabelle schreiben, neuen Stand in `current_status_note` speichern
- Im UI: Ein kleines Dropdown oder eine ausklappbare Liste mit den letzten Versionen, jeweils mit Autor (UserBadge) und Zeitstempel

---

## 9. Bearbeitungsstatus (Processing Status) mit Checkbox-Auswahl

**Problem:** Es gibt keinen strukturierten Bearbeitungsstatus fuer die Akte.

**Loesung:**
- Neue DB-Tabelle `case_file_processing_statuses`:
  ```text
  id (uuid), name (text), label (text), icon (text), 
  color (text), order_index (int), is_active (boolean),
  created_at (timestamptz), updated_at (timestamptz)
  ```
- Neue DB-Spalte auf `case_files`: `processing_status` (text, nullable)
- Default-Eintraege per Migration:
  | Name | Label | Icon | Farbe |
  |------|-------|------|-------|
  | new | Neu eingegangen | Inbox | #3b82f6 (blau) |
  | in_review | In Pruefung | Search | #8b5cf6 (lila) |
  | in_progress_ministry | In Bearbeitung (Ministerium) | Building2 | #f59e0b (gelb) |
  | awaiting_response | Antwort ausstehend | Clock | #ef4444 (rot) |
  | politically_sensitive | Politisch sensibel | AlertTriangle | #dc2626 (dunkelrot) |
  | completed | Erledigt / Abgeschlossen | CheckCircle | #22c55e (gruen) |

- Im "Aktueller Stand"-Bereich: Radio-Buttons oder Dropdown mit farbigen Icons zur Auswahl des Processing-Status
- Der gesetzte Status wird als Badge im Header der Akte angezeigt (farbig, mit Icon)
- Auch in der FallAkten-Uebersicht (`CaseFileCard.tsx`) als Badge sichtbar

---

## 10. Admin-Bereich: Bearbeitungsstatus konfigurierbar

**Loesung:**
- In `Administration.tsx` unter dem "casefiles"-Tab: Eine zweite `ConfigurableTypeSettings`-Instanz hinzufuegen:
  ```text
  <ConfigurableTypeSettings
    title="Bearbeitungsstatus"
    tableName="case_file_processing_statuses"
    entityName="Status"
    hasIcon={true}
    hasColor={true}
    defaultIcon="Circle"
    defaultColor="#6b7280"
  />
  ```
- Die `ConfigurableTypeSettings`-Komponente unterstuetzt bereits Icon, Farbe, Drag-and-Drop-Sortierung und Aktivierung/Deaktivierung -- passt also perfekt
- Den `tableName`-Union-Type in der Komponente um `'case_file_processing_statuses'` erweitern

---

## 11. Weitere Ideen und Einschaetzung

Hier einige zusaetzliche Verbesserungsvorschlaege:

- **Aktivitaetsprotokoll**: Wer hat wann welche Aenderung an der Akte vorgenommen (Audit-Trail)
- **Deadline-Warnung**: Wenn das Zieldatum naht, visuelle Warnung im Header und in der Uebersicht
- **Fortschrittsbalken**: Basierend auf erledigten vs. offenen Aufgaben einen Fortschritt anzeigen
- **Druckansicht / PDF-Export**: FallAkte als Zusammenfassung exportieren
- **Kommentar-Thread**: Anstelle einzelner Notizen einen echten Kommentar-Feed mit Antwortmoeglichkeit
- **Benachrichtigungen**: Bei Statusaenderung oder neuer Zuweisung den Bearbeiter benachrichtigen

Die aktuelle UI hat ein solides Fundament (Drei-Spalten-Layout, Timeline, Metadaten). Die vorgeschlagenen Aenderungen machen die Detailansicht deutlich praxistauglicher fuer den parlamentarischen Alltag.

---

## Technische Zusammenfassung

### SQL-Migrationen

1. Tabelle `case_file_processing_statuses` erstellen (mit Default-Eintraegen und RLS)
2. Spalte `processing_status` auf `case_files` hinzufuegen
3. Tabelle `case_file_status_history` erstellen (mit RLS)
4. Spalte `parent_task_id` auf `tasks` pruefen/hinzufuegen (falls nicht vorhanden)

### Dateien

| Datei | Aenderung |
|-------|-----------|
| SQL-Migration | 4 Schema-Aenderungen |
| `CaseFilesView.tsx` | Padding anpassen |
| `CaseFileDetailHeader.tsx` | Zurueck-Button entfernen, Badges umordnen, Processing-Status-Badge, Bearbeiter anzeigen |
| `CaseFileLeftSidebar.tsx` | Beteiligte splitten (Personen/Institutionen), Kategorie + Sichtbarkeit in Metadaten |
| `CaseFileUnifiedTimeline.tsx` | Verknuepfungs-Eintraege kompakt, Monats-Header fetter |
| `CaseFileCurrentStatus.tsx` | SimpleRichTextEditor, Processing-Status-Auswahl, Versionierung, User-Badge |
| `CaseFileNextSteps.tsx` | Eltern-Aufgabe + Unteraufgaben-Logik, assigned_to |
| `CaseFileRightSidebar.tsx` | Props durchreichen |
| `CaseFileDetail.tsx` | Neue Props/Funktionen durchreichen |
| `useCaseFileDetails.tsx` | `updateAssignedTo()`, `updateProcessingStatus()`, Status-History-Funktionen |
| `useCaseFiles.tsx` | `processing_status` im CaseFile-Interface |
| `CaseFileCard.tsx` | Processing-Status-Badge anzeigen |
| `CaseFileCreateDialog.tsx` | Optional: Bearbeiter-Feld |
| `Administration.tsx` | Zweite ConfigurableTypeSettings fuer Bearbeitungsstatus |
| `ConfigurableTypeSettings.tsx` | `tableName`-Type erweitern |
| Neuer Hook: `useCaseFileProcessingStatuses.tsx` | Bearbeitungsstatus aus DB laden |

