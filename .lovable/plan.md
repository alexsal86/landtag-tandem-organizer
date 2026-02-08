
# Plan: Benachrichtigungssystem ueberarbeiten -- Gruppierung, fehlende Typen, Deeplinks und Hervorhebung

## Analyse: Status Quo

### Vorhandene Benachrichtigungstypen (31 in der DB)

| Sektion | Typ (name) | Label | Navigation-Mapping | Deeplink vorhanden? |
|---------|------------|-------|-------------------|---------------------|
| **Aufgaben** | `task_created` | Neue Aufgabe | tasks | Nein (nur /tasks) |
| | `task_assigned` | Aufgabe zugewiesen | tasks | Nein |
| | `task_updated` | Task Updated | tasks | Nein |
| | `task_due` | Aufgabe faellig | -- fehlt -- | Nein |
| **Entscheidungen** | `task_decision_request` | Entscheidungsanfrage erhalten | decisions | Nein (nur /decisions) |
| | `task_decision_completed` | Entscheidungsergebnis verfuegbar | decisions | Nein |
| | `task_decision_complete` | Entscheidungsanfrage abgeschlossen | decisions | Nein |
| | `task_decision_comment_received` | Kommentar zu Entscheidungsanfrage | decisions | Nein |
| | `task_decision_creator_response` | Antwort auf Ihren Kommentar | decisions | Nein |
| **Termine & Kalender** | `appointment_reminder` | Termin-Erinnerung | calendar | Nein |
| **Nachrichten** | `message_received` | Neue Nachricht | messages | Nein |
| **Dokumente** | `document_created` | Neues Dokument | documents | Nein |
| | `document_mention` | Erwaehnung in Dokument | -- fehlt -- | Nein |
| **Wissen** | `knowledge_document_created` | Neues Wissensdokument | knowledge | Nein |
| **Jour fixe** | `meeting_created` | Neuer Jour fixe | meetings | Nein |
| **Mitarbeiter** | `employee_meeting_overdue` | Gespraech ueberfaellig | employee | Teilweise (meeting_id) |
| | `employee_meeting_due_soon` | Gespraech bald faellig | employee | Teilweise |
| | `employee_meeting_due` | Gespraech faellig | -- fehlt -- | Nein |
| | `employee_meeting_reminder` | Gespraechserinnerung | -- fehlt -- | Nein |
| | `employee_meeting_request_overdue` | Offene Gespraechsanfrage | employee | Nein |
| | `employee_meeting_requested` | Gespraechswunsch | -- fehlt -- | Nein |
| | `employee_meeting_scheduled` | Gespraech terminiert | -- fehlt -- | Teilweise (meeting_id) |
| | `employee_meeting_action_item_overdue` | Ueberfaellige Massnahme | employee | Nein |
| **Zeiterfassung** | `vacation_request_pending` | Urlaubsantrag eingereicht | time | Nein |
| | `sick_leave_request_pending` | Krankmeldung eingereicht | time | Nein |
| **Notizen** | `note_follow_up` | Faellige Wiedervorlage | -- fehlt -- | Nein |
| **Abstimmungen** | `poll_auto_cancelled` | Abstimmung abgebrochen | -- fehlt -- | Nein |
| | `poll_auto_completed` | Abstimmung abgeschlossen | -- fehlt -- | Nein |
| | `poll_restored` | Abstimmung wiederhergestellt | -- fehlt -- | Nein |
| **System** | `budget_exceeded` | Budget ueberschritten | -- fehlt -- | Nein |
| | `system_update` | System-Update | -- fehlt -- | Nein |

---

### Fehlende Benachrichtigungstypen (im Code verwendet, aber NICHT in der DB)

| Typ | Wo im Code verwendet | Problem |
|-----|---------------------|---------|
| `employee_meeting_request_declined` | `EmployeeMeetingRequestManager.tsx` | create_notification schlaegt fehl (Typ existiert nicht in DB) |
| `task_decision_requested` | `NoteDecisionCreator.tsx` | Tippfehler -- sollte `task_decision_request` sein |

### Systemfunktionen OHNE Benachrichtigungen (Luecken)

| Feature | Was fehlt |
|---------|-----------|
| **Brief: Zur Pruefung gesendet** | Wenn ein Brief zur Pruefung an Reviewer gesendet wird, erhaelt der Reviewer keine Benachrichtigung |
| **Brief: Genehmigt/Zurueckgewiesen** | Wenn ein Reviewer einen Brief genehmigt oder zurueckgibt, erhaelt der Ersteller keine Benachrichtigung |
| **Brief: Versendet** | Keine Benachrichtigung wenn ein Brief als versendet markiert wird |
| **Planungen: Mitarbeiter hinzugefuegt** | Wenn jemand als Collaborator zu einer Planung hinzugefuegt wird |
| **Planungen: Aenderungen** | Keine Benachrichtigungen bei wichtigen Aenderungen an geteilten Planungen |
| **Team-Mitteilungen** | Neue Mitteilungen erzeugen keine Benachrichtigung in der Glocke |
| **Urlaubsantrag: Genehmigt/Abgelehnt** | Keine Rueckmeldung an den Antragsteller |
| **Krankmeldung: Status-Aenderung** | Keine Rueckmeldung an den Mitarbeiter |
| **FallAkten: Aenderungen** | Keine Benachrichtigungen bei Status-Aenderungen oder Kommentaren |
| **Kontakte: Zusammenfuehrung/Aenderung** | Keine Benachrichtigungen (niedrige Prioritaet) |

### Fehlende Navigation-Mappings (in DB)

Die folgenden Typen existieren, haben aber KEIN `notification_navigation_mapping` -- das bedeutet, sie erzeugen keinen Badge in der Navigation:

- `task_due`
- `document_mention`
- `employee_meeting_due`
- `employee_meeting_reminder`
- `employee_meeting_requested`
- `employee_meeting_scheduled`
- `note_follow_up`
- `poll_auto_cancelled` / `poll_auto_completed` / `poll_restored`
- `budget_exceeded`
- `system_update`

---

## Umsetzungsplan

### Schritt 1: DB-Migration -- Kategorie-Feld und fehlende Typen

Neues Feld `category` in `notification_types` hinzufuegen, um Gruppierung zu ermoeglichen:

```text
Kategorien:
- tasks           (Aufgaben)
- decisions       (Entscheidungen)
- calendar        (Termine & Kalender)
- messages        (Nachrichten)
- documents       (Dokumente & Briefe)
- knowledge       (Wissen)
- meetings        (Jour fixe)
- employee        (Mitarbeiter)
- time            (Zeiterfassung)
- notes           (Notizen)
- polls           (Abstimmungen)
- planning        (Veranstaltungsplanung)
- system          (System)
```

Neue Benachrichtigungstypen registrieren:

| name | label | category |
|------|-------|----------|
| `employee_meeting_request_declined` | Gespraechsanfrage abgelehnt | employee |
| `letter_review_requested` | Brief zur Pruefung | documents |
| `letter_review_completed` | Brief geprueft | documents |
| `letter_sent` | Brief versendet | documents |
| `planning_collaborator_added` | Zu Planung hinzugefuegt | planning |
| `team_announcement_created` | Neue Team-Mitteilung | system |
| `leave_request_approved` | Antrag genehmigt | time |
| `leave_request_rejected` | Antrag abgelehnt | time |

Fehlende Navigation-Mappings nachtragen fuer alle bestehenden Typen.

Alle bestehenden Typen erhalten ein `category`-Update.

### Schritt 2: NotificationSettings.tsx komplett neu gestalten -- Gruppierte Sektionen

Statt einer flachen Liste aller Benachrichtigungstypen wird die Einstellungsseite nach Sektionen gruppiert:

```text
+-----------------------------------------------+
| Aufgaben                            [An/Aus]  |
| Neue Aufgabe, Zuweisung, Updates    [Push|Mail]|
+-----------------------------------------------+
| Entscheidungen                      [An/Aus]  |
| Anfragen, Kommentare, Ergebnisse    [Push|Mail]|
+-----------------------------------------------+
| Termine & Kalender                  [An/Aus]  |
| Erinnerungen                        [Push|Mail]|
+-----------------------------------------------+
| ...weitere Sektionen...                        |
+-----------------------------------------------+
```

Pro Sektion:
- Ein Master-Toggle (alles in der Sektion an/aus)
- Wahl zwischen "Nur In-App", "In-App + Push", "In-App + E-Mail", "Alles"
- Aufklappbar: Einzelne Typen innerhalb der Sektion koennen einzeln deaktiviert werden

### Schritt 3: Granulare Deeplinks im NotificationCenter

Die `handleClick`-Funktion im `NotificationCenter.tsx` wird erweitert um praezise Navigation basierend auf `notification.data`:

| Typ | Aktuell | Neu (Deeplink) |
|-----|---------|----------------|
| `task_created/assigned/updated` | `/tasks` | `/tasks?highlight={task_id}` |
| `task_due` | `/tasks` | `/tasks?highlight={task_id}` |
| `task_decision_*` | `/decisions` | `/decisions?highlight={decision_id}` |
| `appointment_reminder` | `/calendar` | `/calendar?date={start_time}` |
| `message_received` | `/messages` | `/messages?highlight={message_id}` |
| `document_created` | `/documents` | `/documents?tab=letters&highlight={document_id}` |
| `document_mention` | `/` (!) | `/documents?tab=letters&highlight={documentId}` oder `/documents?tab=press&highlight={documentId}` |
| `meeting_created` | `/meetings` | `/meetings?highlight={meeting_id}` |
| `employee_meeting_*` | `/employees` | `/employee-meeting/{meeting_id}` (bereits teilweise) |
| `note_follow_up` | `/` (!) | `/mywork?tab=notes&highlight={noteId}` |
| `vacation_request_pending` | `/time` (Badge) | `/time?tab=leave-requests&highlight={request_id}` |
| `letter_review_requested` | -- | `/documents?tab=letters&highlight={letter_id}` |
| `planning_collaborator_added` | -- | `/eventplanning?highlight={planning_id}` |

Die Navigation verwendet Query-Parameter (`highlight={id}`), die von der Zielkomponente ausgelesen werden.

### Schritt 4: Hervorhebungs-Mechanismus auf Zielseiten

Ein neuer Hook `useNotificationHighlight` wird erstellt:

```tsx
// Liest ?highlight=xxx aus der URL
// Setzt nach 5 Sekunden zurueck
// Gibt { highlightId, isHighlighted(id) } zurueck
```

Die betroffenen Komponenten (TasksView, Decisions, QuickNotesList, EventPlanningView, DocumentsView, etc.) nutzen den Hook:

```text
- Wenn highlightId gesetzt ist:
  1. Scrolle zum Element mit der ID
  2. Zeige einen animierten Ring/Glow um die Card (2-3 Sekunden)
  3. Entferne den Query-Parameter nach dem Scrollen
```

CSS fuer die Hervorhebung:

```css
@keyframes notification-highlight {
  0% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.4); }
  50% { box-shadow: 0 0 0 4px hsl(var(--primary) / 0.2); }
  100% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0); }
}
.notification-highlight {
  animation: notification-highlight 1.5s ease-in-out 3;
}
```

### Schritt 5: Fehlende Benachrichtigungen im Code triggern

Neue `create_notification`-Aufrufe in:

- **ReviewAssignmentDialog.tsx**: Wenn Reviewer zugewiesen wird, Benachrichtigung `letter_review_requested` an jeden Reviewer
- **LetterEditor.tsx**: Wenn Status zu 'approved' wechselt, Benachrichtigung `letter_review_completed` an den Ersteller
- **EventPlanningView.tsx**: Wenn Collaborator hinzugefuegt wird, Benachrichtigung `planning_collaborator_added`
- **NoteDecisionCreator.tsx**: Tippfehler `task_decision_requested` zu `task_decision_request` korrigieren

### Schritt 6: Weitere Verbesserungen (Ideen)

1. **Benachrichtigungs-Zusammenfassung**: Wenn mehrere Benachrichtigungen des gleichen Typs innerhalb kurzer Zeit kommen (z.B. 5 Aufgaben zugewiesen), werden sie zu einer zusammengefasst: "5 neue Aufgaben zugewiesen"

2. **Loeschen einzelner Benachrichtigungen**: Ein kleiner X-Button oder Swipe-Geste auf einzelnen Benachrichtigungen im NotificationCenter, um sie zu loeschen statt nur als gelesen zu markieren

3. **Benachrichtigungs-Historie**: Ein "Alle anzeigen"-Link im NotificationCenter, der zu einer vollstaendigen Benachrichtigungs-Seite fuehrt mit Filterung nach Typ, Zeitraum und Status

4. **Benachrichtigungstoene**: Optionaler Ton bei neuen Push-Benachrichtigungen (in den Einstellungen konfigurierbar)

5. **Wochendigest**: Optionale woechentliche Zusammenfassungs-E-Mail aller verpassten Benachrichtigungen

---

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| DB-Migration | `notification_types` (category-Feld + neue Typen + navigation mappings) |
| Komplett neu | `src/components/NotificationSettings.tsx` (Gruppierte Sektionen) |
| Bearbeiten | `src/components/NotificationCenter.tsx` (Deeplinks mit data-basierter Navigation) |
| Neu | `src/hooks/useNotificationHighlight.tsx` (Highlight-Hook) |
| Bearbeiten | `src/index.css` (Highlight-Animation) |
| Bearbeiten | `src/components/TasksView.tsx` (Highlight-Integration) |
| Bearbeiten | `src/components/task-decisions/*` (Highlight fuer Entscheidungen) |
| Bearbeiten | `src/components/shared/QuickNotesList.tsx` (Highlight fuer Notizen) |
| Bearbeiten | `src/components/EventPlanningView.tsx` (Highlight + Notification-Trigger) |
| Bearbeiten | `src/components/DocumentsView.tsx` (Highlight fuer Dokumente) |
| Bearbeiten | `src/components/ReviewAssignmentDialog.tsx` (Notification bei Zuweisung) |
| Bearbeiten | `src/components/LetterEditor.tsx` (Notification bei Status-Wechsel) |
| Bearbeiten | `src/components/shared/NoteDecisionCreator.tsx` (Tippfehler-Fix) |
| Bearbeiten | `src/integrations/supabase/types.ts` (Neue Typen) |

## Reihenfolge

1. DB-Migration: `category`-Feld, neue Notification-Typen, fehlende Navigation-Mappings
2. NotificationSettings komplett neu (gruppiert nach Sektionen)
3. NotificationCenter Deeplinks (granulare Navigation)
4. useNotificationHighlight Hook + CSS
5. Highlight-Integration in Zielkomponenten (TasksView, Decisions, QuickNotesList, EventPlanningView, DocumentsView)
6. Fehlende Notification-Trigger (ReviewAssignment, LetterEditor, EventPlanningView)
7. Tippfehler-Fix in NoteDecisionCreator
