# Entscheidungen

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/entscheidungen.json`). Nicht von Hand bearbeiten._

**Zweck:** Entscheidungen vorbereiten, Teilnehmende abstimmen lassen, Antworten und Kommentare führen, erinnern und archivieren.

## Kennzahlen

- Funktionen: **10** in **7** Unterbereichen
- implementiert: **10**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **7**
- ohne Dokumentationsverweis: **8**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `decisions.vote` Abstimmen | Abstimmung | fachlich | implementiert | UI | Selbsttest |
| `decisions.change-vote` Antwort ändern und Verlauf einsehen | Abstimmung | fachlich | implementiert | UI | kein Test |
| `decisions.comments` Kommentare und Reaktionen | Abstimmung | fachlich | implementiert | UI | kein Test |
| `decisions.attachments` Anhänge an Entscheidungen | Anlegen | fachlich | implementiert | UI | kein Test |
| `decisions.create` Entscheidung anlegen | Anlegen | fachlich | implementiert | rollenabhängig | Selbsttest |
| `decisions.archive` Entscheidungen archivieren | Archiv | automatisiert | implementiert | systemseitig | kein Test |
| `decisions.email` Entscheidungs-E-Mails | Benachrichtigung | integration | implementiert | rollenabhängig | kein Test |
| `decisions.remind` Offene Entscheidungen anmahnen | Erinnerungen | fachlich | implementiert | UI | kein Test |
| `decisions.matrix` Entscheidungen über Matrix beantworten | Integration | integration | implementiert | systemseitig | kein Test |
| `decisions.participants` Teilnehmende und Antwort-Token verwalten | Teilnehmende | fachlich | implementiert | rollenabhängig | Selbsttest |

## Unterbereiche

- Anlegen
- Teilnehmende
- Abstimmung
- Erinnerungen
- Archiv
- Benachrichtigung
- Integration

## Rollen

`abgeordneter`, `bueroleitung`, `mitarbeiter`, `oeffentlich`, `admin`, `system`

## Datenbanktabellen

`dashboard_decision_nudges`, `decision_archive_settings`, `decision_email_templates`, `decision_matrix_messages`, `email_logs`, `task_decision_attachments`, `task_decision_comment_reactions`, `task_decision_comments`, `task_decision_participants`, `task_decision_response_history`, `task_decision_responses`, `task_decision_topics`, `task_decisions`, `tasks`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen |
|---|---|---:|---:|
| `decision-lifecycle` | Entscheidungs-Lifecycle (active → open → archived) | 3 | 0 |

## Funktionsdetails

### `decisions.create` — Entscheidung anlegen
Erstellt eine Entscheidung mit Optionen, Frist, Teilnehmenden, Anhängen und Bezug zu Aufgabe, Vorgang oder Meeting.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/decisions`
- **Frontend-Komponenten:** `src/pages/Decisions.tsx`, `src/components/task-decisions`
- **Services:** —
- **Hooks:** `src/hooks/useMyWorkDecisionsData.ts`, `src/hooks/useDefaultDecisionSettings.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `create_work_decision`
- **Tabellen:** `task_decisions`, `task_decision_participants`, `task_decision_topics`, `task_decision_attachments`
- **Abhängigkeiten:** —
- **Selbsttests:** `decision-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/my-work-decisions-button-flowchart.md`

**Nachweise im Quellcode**

- src/pages/Decisions.tsx
- src/features/selftest/scenarios/decision-lifecycle.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `decisions.participants` — Teilnehmende und Antwort-Token verwalten
Bestimmt den Teilnehmerkreis, erzeugt eindeutige Antwort-Token und schützt den Zugriff auf die Antwortseite.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `oeffentlich`, `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/decision-response/:participantId`
- **Frontend-Komponenten:** `src/pages/DecisionResponse.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `process-decision-response`
- **Datenbankfunktionen:** `generate_decision_participant_token`, `set_decision_participant_token`, `can_access_decision`, `user_can_access_task_decision`
- **Tabellen:** `task_decision_participants`, `task_decisions`
- **Abhängigkeiten:** —
- **Selbsttests:** `decision-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/pages/DecisionResponse.tsx
- supabase/functions/process-decision-response/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `decisions.vote` — Abstimmen
Nimmt Ja/Nein/Enthaltung an, protokolliert die Antwort und stößt Benachrichtigungen und Aufgabenfolgen an.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `log_decision_response_change`, `return_task_ball_after_vote`
- **Tabellen:** `task_decision_responses`, `task_decision_participants`, `tasks`
- **Abhängigkeiten:** —
- **Selbsttests:** `decision-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/pages/DecisionResponse.tsx
- src/hooks/useDecisionRefreshScheduler.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `decisions.change-vote` — Antwort ändern und Verlauf einsehen
Erlaubt die Änderung einer abgegebenen Antwort und hält die Antwort-Historie revisionsfähig fest.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `check_archive_after_creator_response`
- **Tabellen:** `task_decision_responses`, `task_decision_response_history`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/pages/DecisionResponse.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Die Änderungsmöglichkeit ist im Szenario nur als Folgepfad, nicht als eigener Prüfschritt abgedeckt.

### `decisions.comments` — Kommentare und Reaktionen
Ermöglicht Kommentare zu Entscheidungen, Antworten auf Kommentare und Emoji-Reaktionen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/shared/DecisionResponseSummary.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useDecisionComments.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `task_decision_comments`, `task_decision_comment_reactions`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/task-decision-reactions-rollout.md`, `docs/emoji-reactions-dod-v1.md`

**Nachweise im Quellcode**

- src/hooks/useDecisionComments.ts
- src/components/shared/DecisionResponseSummary.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `decisions.attachments` — Anhänge an Entscheidungen
Lädt Anhänge zu Entscheidungen hoch, verknüpft sie und stellt sie Teilnehmenden bereit.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** `src/hooks/useDecisionAttachmentUpload.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `task_decision_attachments`, `task_decisions`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/hooks/useDecisionAttachmentUpload.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `decisions.remind` — Offene Entscheidungen anmahnen
Zeigt offene Entscheidungen im Abgeordneten-Dashboard und erlaubt gezielte Erinnerungen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/decisions/DeputyWaitingCard.tsx`, `src/components/dashboard/DashboardDecisionsWidget.tsx`
- **Services:** `src/features/decisions/dashboardNudges.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `nudge_dashboard_decision`, `get_deputy_dashboard_decisions`, `get_my_work_decisions`
- **Tabellen:** `dashboard_decision_nudges`, `task_decisions`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/decisions/DeputyWaitingCard.tsx
- src/features/decisions/dashboardNudges.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `decisions.archive` — Entscheidungen archivieren
Archiviert abgeschlossene Entscheidungen automatisch oder manuell und hält die Archivkonfiguration je Büro.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`, `system`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/DecisionArchiveSettings.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `auto-archive-decisions`
- **Datenbankfunktionen:** `auto_archive_completed_decisions`, `check_and_archive_decision`
- **Tabellen:** `task_decisions`, `decision_archive_settings`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/auto-archive-decisions/index.ts
- src/components/administration/DecisionArchiveSettings.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Der Cron-Lauf wurde hier nicht ausgeführt; der Nachweis ist die Funktion plus Einstellungsdialog.

### `decisions.email` — Entscheidungs-E-Mails
Versendet Einladungs- und Erinnerungs-E-Mails zu Entscheidungen auf Basis konfigurierbarer Vorlagen.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `send-decision-email`
- **Datenbankfunktionen:** —
- **Tabellen:** `decision_email_templates`, `email_logs`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/send-decision-email/index.ts
- src/components/administration

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `decisions.matrix` — Entscheidungen über Matrix beantworten
Nimmt Antworten über einen Matrix-Handler entgegen und protokolliert die Zustellung im Matrix-Verlauf.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`, `abgeordneter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `matrix-decision-handler`
- **Datenbankfunktionen:** —
- **Tabellen:** `decision_matrix_messages`, `task_decision_responses`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/matrix-decision-handler/index.ts

**Bekannte Einschränkungen**

- Der Handler ist öffentlich erreichbar und benötigt einen eigenen Signatur-/Secret-Schutz; die Härtung ist offen.

**Offene Prüfpunkte**

- Sicherheitsklassifikation public-webhook; zusätzlicher Schutz im Code nicht nachgewiesen.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
