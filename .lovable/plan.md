
# Notification-Highlights reparieren und erweitern

## Problem bei Entscheidungen

Die `DecisionOverview` verwendet zwar bereits den `useNotificationHighlight`-Hook, aber der aktive Tab wird nicht automatisch gewechselt. Wenn eine Entscheidung z.B. auf dem Tab "Beantwortet" liegt, der Nutzer aber auf "Fuer mich" landet, ist die Karte nicht sichtbar und das Highlight laeuft ins Leere. Dasselbe Problem besteht auch im `MyWorkDecisionsTab`.

**Loesung:** Beim Laden der Entscheidungen pruefen, in welchem Tab sich die highlightete Decision befindet, und automatisch dorthin wechseln.

## Fehlende Highlights in anderen Views

Folgende Views generieren `?highlight=`-URLs via `notificationDeepLinks.ts`, haben aber keinen `useNotificationHighlight`-Hook:

| View | Notification-Typ | Datei |
|------|-------------------|-------|
| Meetings (Jour fixe) | `meeting_created` | `src/components/MeetingsView.tsx` |
| Wissensdatenbank | `knowledge_document_created` | `src/components/KnowledgeBaseView.tsx` |
| Veranstaltungsplanung | `planning_collaborator_added` | `src/components/event-planning/EventPlanningListView.tsx` |
| Kalender (Polls) | `poll_auto_cancelled/completed/restored` | `src/components/CalendarView.tsx` |
| Zeiterfassung (Antraege) | `vacation/sick_leave/leave_request_*` | Wird ueber `/time?tab=leave-requests` geroutet |
| Meine Arbeit (Notizen) | `note_follow_up` | Wird ueber `/mywork?tab=notes` geroutet |

## Aenderungen

### 1. DecisionOverview - Tab-Auto-Switch (Entscheidungen-Seite)

**Datei:** `src/components/task-decisions/DecisionOverview.tsx`

Nach dem Laden der Entscheidungen (`setDecisions`): Wenn ein `highlight`-Parameter vorhanden ist, die passende Entscheidung in der Liste suchen und den korrekten Tab setzen:
- Ist der Nutzer Participant und hat nicht geantwortet -> "for-me"
- Hat geantwortet und ist nicht Creator -> "answered"
- Ist Creator -> "my-decisions"
- Ist oeffentlich -> "public"
- Ist archiviert -> "archived"

### 2. MyWorkDecisionsTab - Tab-Auto-Switch (Meine Arbeit)

**Datei:** `src/components/my-work/MyWorkDecisionsTab.tsx`

Gleiche Logik wie bei DecisionOverview: Highlight-ID lesen, passenden Tab aktivieren. Zusaetzlich `useNotificationHighlight` importieren und an die `MyWorkDecisionCard`-Komponente weitergeben.

### 3. MeetingsView - Highlight fuer Meetings

**Datei:** `src/components/MeetingsView.tsx`

- `useNotificationHighlight` importieren und initialisieren
- Meeting-Karten mit `ref={highlightRef(meeting.id)}` und `notification-highlight`-Klasse versehen

### 4. KnowledgeBaseView - Highlight fuer Wissensartikel

**Datei:** `src/components/KnowledgeBaseView.tsx`

- `useNotificationHighlight` importieren
- Dokument-Karten in der Seitenleiste mit Highlight-Ref und CSS-Klasse versehen
- Bei Highlight automatisch das entsprechende Dokument auswaehlen/oeffnen

### 5. EventPlanningListView - Highlight fuer Planungen

**Datei:** `src/components/event-planning/EventPlanningListView.tsx`

- `useNotificationHighlight` importieren (oder ueber Props von `EventPlanningView` durchreichen)
- Planungs-Karten mit Highlight-Ref und CSS-Klasse versehen

### 6. CalendarView - Highlight fuer Polls

**Datei:** `src/components/CalendarView.tsx`

- `useNotificationHighlight` importieren
- Da Kalender-Eintraege keine Karten-Liste sind: Bei vorhandenem `highlight`-Parameter den entsprechenden Termin/die Umfrage als Detail oeffnen (oder zum Datum navigieren)

### 7. MyWorkView - Tab-Auto-Switch fuer Notizen

**Datei:** `src/components/MyWorkView.tsx`

- Bei `highlight`-Parameter in Kombination mit `tab=notes`: Automatisch den Notizen-Tab aktivieren
- Die Notizen-Komponente muss den Highlight-Hook erhalten

---

## Technische Details

Jede Integration folgt demselben Muster:

```text
1. Import: useNotificationHighlight aus "@/hooks/useNotificationHighlight"
2. Hook: const { isHighlighted, highlightRef } = useNotificationHighlight();
3. Ref:   ref={highlightRef(item.id)}
4. Class: isHighlighted(item.id) && "notification-highlight"
```

Bei Tab-basierten Views (Decisions, MyWork) kommt zusaetzlich hinzu:

```text
5. URL-Param "highlight" lesen
6. Item in der Gesamtliste suchen
7. Passenden Tab automatisch aktivieren
```

### Betroffene Dateien

| Datei | Art der Aenderung |
|-------|-------------------|
| `src/components/task-decisions/DecisionOverview.tsx` | Tab-Auto-Switch bei highlight-Param |
| `src/components/my-work/MyWorkDecisionsTab.tsx` | useNotificationHighlight + Tab-Auto-Switch |
| `src/components/my-work/decisions/MyWorkDecisionCard.tsx` | Highlight-Ref und CSS-Klasse auf Karte |
| `src/components/MeetingsView.tsx` | useNotificationHighlight auf Meeting-Karten |
| `src/components/KnowledgeBaseView.tsx` | useNotificationHighlight auf Dokument-Karten |
| `src/components/event-planning/EventPlanningListView.tsx` | useNotificationHighlight auf Planungs-Karten |
| `src/components/CalendarView.tsx` | useNotificationHighlight - Detail oeffnen bei highlight |
| `src/components/MyWorkView.tsx` | Tab-Auto-Switch bei highlight + tab-Param |
