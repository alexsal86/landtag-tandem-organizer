

## Analyse & Priorisierung der Brief-Verbesserungen

### Bewertung aller 10 Punkte

| # | Thema | Bewertung | Empfehlung |
|---|---|---|---|
| 1 | `review`-Status wiedereinbinden | Sinnvoll, klarer Mehrwert | **Jetzt umsetzen** |
| 2 | Benachrichtigungen bei Freigabe | Kritisch – Prüfer erfährt nichts | **Jetzt umsetzen** |
| 3 | "Versendet" nur Flag | Korrekt so – manuelles Markieren ist Standard für Post. E-Mail-Versand existiert bereits via `send-document-email` | **Kein Handlungsbedarf** |
| 4 | Antwortverfolgung / Fristtracking | `expected_response_date` existiert, wird in der Toolbar angezeigt, aber kein aktives Tracking | **Später** (eigenes Feature) |
| 5 | Revisions-Benachrichtigung an Ersteller | Fehlt komplett – Ersteller sieht nur Statusänderung | **Jetzt umsetzen** |
| 6 | Versionsverlauf | Großes Feature, DB-Erweiterung nötig | **Später** |
| 7 | Wizard-Vorschau | Nice-to-have, Wizard funktioniert | **Später** |
| 8 | Empfängeradresse statisch | Gewollt (historische Korrektheit), kein Bug | **Kein Handlungsbedarf** |
| 9 | Betreff/Aktenzeichen optional | Kann je nach Anlass validiert werden | **Später** |
| 10 | Co-Autoren während Bearbeitung | `letter_collaborators` unterstützt es, UI fehlt | **Jetzt umsetzen** |

---

### Plan: 4 Änderungen jetzt umsetzen

#### 1. `review`-Status als Kollegenprüfung einbinden

Neuer Workflow: `draft` → `review` (Kollegin) → `pending_approval` (Abgeordneter) → `approved` → `sent`

- **`types.ts`**: `STATUS_FLOW` anpassen: `draft → review`, `review → pending_approval`; `STATUS_LABELS.review = 'Kollegenprüfung'`
- **`ReviewAssignmentDialog.tsx`**: Dritte Option hinzufügen: "Kollegenprüfung" (setzt Status auf `review`, erstellt **keine** Entscheidung, nur Collaborator-Zuweisung)
- **`LetterBriefDetails.tsx`**: `review`-Status darstellen mit Button "Weiter zur Freigabe" (→ `pending_approval`)
- **`LetterEditor.tsx`**: `canEdit`-Logik: Reviewer kann bei `review` bearbeiten; Workflow-Button-Label anpassen

#### 2. Benachrichtigungen für Freigabe-Workflow

Bei jedem Workflow-Schritt eine In-App-Notification via `create_notification` RPC:

- **`ReviewAssignmentDialog.tsx`**: Nach Zuweisung → Notification an Prüfer ("Brief zur Prüfung erhalten")
- **`TaskDecisionResponse.tsx`**: Bei Freigabe → Notification an Ersteller ("Brief freigegeben"); bei Zurückweisung → Notification an Ersteller ("Brief zurückgewiesen")
- Notification-Typ: `letter_review_assigned`, `letter_approved`, `letter_revision_requested`
- Deep-Link auf den Brief (`/letters/{id}`)

#### 3. Revisions-Benachrichtigung mit Begründung

- **`TaskDecisionResponse.tsx`**: Bei Zurückweisung wird bereits `createLetterRevisionTask` aufgerufen – hier zusätzlich `create_notification` mit dem `revision_comment` im Body
- **`LetterBriefDetails.tsx`**: Bei Status `revision_requested` → Banner mit Revisionsbegründung anzeigen (aus dem letzten Kommentar/Task holen)

#### 4. Co-Autoren während der Bearbeitung

- **`LetterEditor.tsx`**: Neuen Button "Mitbearbeiter" im Toolbar (neben dem Prüfer-Button), der `UserAssignmentDialog` öffnet – aber mit Rolle `writer` statt `reviewer`
- **`UserAssignmentDialog.tsx`**: Prop `role` hinzufügen (default: `reviewer`), Dialog-Titel und -Text anpassen je nach Rolle
- **`canEdit`-Logik**: Collaborators mit `role === 'writer'` dürfen im `draft`-Status mitbearbeiten

---

### Dateien

| Datei | Änderung |
|---|---|
| `src/components/letters/types.ts` | `STATUS_FLOW`, `STATUS_LABELS`, `ALLOWED_TRANSITIONS` für `review` anpassen |
| `src/components/ReviewAssignmentDialog.tsx` | 3 Optionen (Überspringen / Kollegenprüfung / Freigabe-Entscheidung) + Notification |
| `src/components/letters/LetterBriefDetails.tsx` | `review`-Status mit Weiter-Button, Revisions-Banner |
| `src/components/LetterEditor.tsx` | `canEdit`-Logik für `review` + `writer`-Rolle, Co-Autoren-Button, Toolbar anpassen |
| `src/components/UserAssignmentDialog.tsx` | `role`-Prop, Titel/Text dynamisch |
| `src/components/task-decisions/TaskDecisionResponse.tsx` | `create_notification` bei Freigabe/Zurückweisung |
| `src/components/letters/hooks/useLetterOperations.ts` | `review`-Status in Transitions unterstützen |

