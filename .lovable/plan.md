

## Analyse & Plan: Brief-Freigabe-Workflow mit Entscheidungssystem

### Aktuelle Situation (2 parallele, inkonsistente Implementierungen)

**Aktiv genutzt** (`LetterEditor.tsx` + `ReviewAssignmentDialog.tsx` + `useLetterOperations.ts`):
- Mitarbeiter klickt "Zur Prüfung" → `ReviewAssignmentDialog` öffnet sich
- Man kann Prüfer zuweisen ODER Prüfung überspringen
- Status wird auf `review` gesetzt, Prüfer werden als `letter_collaborators` gespeichert
- **Es wird KEINE Entscheidung erstellt** — der Abgeordnete bekommt also nichts in seinem Entscheidungseingang
- Freigabe/Zurückweisung passiert nur über `LetterBriefDetails` mit einfachen Status-Buttons
- Kein Brieftext in der Entscheidung, keine strukturierte Antwort

**Nicht genutzt** (`LetterStatusWorkflow.tsx` + `letterWorkflowActions.ts`):
- Erstellt eine Entscheidung mit "Freigeben"/"Zurückweisen"-Optionen
- Erstellt Versand-Aufgabe bei Freigabe, Revisions-Aufgabe bei Zurückweisung
- Hat `pending_approval` und `revision_requested` Status
- **Wird nirgendwo importiert/gerendert** — komplett verwaist

### Probleme
1. Der Abgeordnete bekommt derzeit keine Entscheidung/Benachrichtigung
2. Brieftext (Anrede, Inhalt, Schlussformel) wird nicht in die Entscheidung übernommen
3. Zwei Workflow-Varianten existieren parallel
4. Status `review` vs. `pending_approval` sind inkonsistent

---

### Plan: Unified Workflow

#### Schritt 1: `ReviewAssignmentDialog` erweitern
- Bei "Prüfer zuweisen" wird jetzt eine **Entscheidung** (`task_decisions`) erstellt
- Die Entscheidung enthält den **vollständigen Brieftext**: Anrede, HTML-Inhalt und Schlussformel
- Briefdaten werden als Props an den Dialog übergeben (Titel, Content-HTML, Anrede, Schlussformel)
- Status wird auf `pending_approval` statt `review` gesetzt (Vereinheitlichung)
- Die Entscheidung nutzt die vorhandenen `response_options` (Freigeben/Zurückweisen)

#### Schritt 2: `letterWorkflowActions.ts` anpassen
- `createLetterApprovalDecision` erhält zusätzliche Parameter: `contentHtml`, `salutation`, `closingFormula`, `closingName`
- Die Beschreibung der Entscheidung wird als formatierter HTML-Text aufgebaut mit Anrede, Brieftext und Schlussformel
- Die `letter_id` wird in der Entscheidung verknüpft (falls DB-Feld vorhanden, sonst im Titel/Description)

#### Schritt 3: Entscheidungs-Reaktion → Brief-Status-Update
- Wenn der Abgeordnete in seiner Entscheidungsübersicht "Freigeben" wählt → Brief-Status wird automatisch auf `approved` gesetzt + Versand-Aufgabe wird erstellt
- Wenn "Zurückweisen" → Status wird auf `revision_requested` gesetzt + Revisions-Aufgabe wird erstellt
- Dafür: In `useDecisionActions.ts` (oder separater Hook) einen Listener/Handler einbauen, der bei Brief-Entscheidungen den Letter-Status synchronisiert

#### Schritt 4: `LetterBriefDetails.tsx` anpassen
- Status `pending_approval` korrekt darstellen (Entscheidung läuft)
- Status `revision_requested` mit Zurückweisungsgrund anzeigen
- Workflow-Buttons anpassen: aus `review` wird `pending_approval`

#### Schritt 5: Aufräumen
- `LetterStatusWorkflow.tsx` entfernen (verwaist, Logik wird in den aktiven Flow integriert)
- `STATUS_FLOW` und `ALLOWED_TRANSITIONS` in `types.ts` bereinigen (`review` als Legacy behalten aber auf `pending_approval` mappen)

---

### Dateien

| Datei | Änderung |
|---|---|
| `src/components/ReviewAssignmentDialog.tsx` | Brief-Daten als Props, Entscheidung erstellen, Status `pending_approval` |
| `src/utils/letterWorkflowActions.ts` | Brieftext (HTML, Anrede, Schlussformel) in Entscheidungs-Beschreibung |
| `src/components/LetterEditor.tsx` | Brief-Daten an ReviewAssignmentDialog durchreichen, `onReviewAssigned` setzt `pending_approval` |
| `src/components/letters/LetterBriefDetails.tsx` | `pending_approval` und `revision_requested` Status korrekt darstellen |
| `src/components/letters/hooks/useLetterOperations.ts` | Status `review` → `pending_approval` umstellen |
| `src/components/letters/types.ts` | `review` als Legacy-Mapping behalten |
| `src/components/letters/LetterStatusWorkflow.tsx` | Entfernen (verwaist) |

