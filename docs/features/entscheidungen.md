# Entscheidungen

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/entscheidungen.json`). Nicht von Hand bearbeiten._

**Zweck:** Entscheidungen vorbereiten, Teilnehmende abstimmen lassen, Antworten und Kommentare führen, erinnern und archivieren.

## Kennzahlen

- Funktionen: **10** in **7** Unterbereichen
- implementiert: **10**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **3**
- ohne Dokumentationsverweis: **8**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `decisions.vote` Abstimmen | Abstimmung | fachlich | implementiert | UI | Selbsttest |
| `decisions.change-vote` Antwort ändern und Verlauf einsehen | Abstimmung | fachlich | implementiert | UI | Selbsttest |
| `decisions.comments` Kommentare und Reaktionen | Abstimmung | fachlich | implementiert | UI | Selbsttest |
| `decisions.attachments` Anhänge an Entscheidungen | Anlegen | fachlich | implementiert | UI | teilweise |
| `decisions.create` Entscheidung anlegen | Anlegen | fachlich | implementiert | rollenabhängig | Selbsttest |
| `decisions.archive` Entscheidungen archivieren | Archiv | automatisiert | implementiert | systemseitig | kein Test |
| `decisions.email` Entscheidungs-E-Mails | Benachrichtigung | integration | implementiert | rollenabhängig | kein Test |
| `decisions.remind` Offene Entscheidungen anmahnen | Erinnerungen | fachlich | implementiert | UI | teilweise |
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

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen | letzter Lauf |
|---|---|---:|---:|---|
| `decision-lifecycle` | Entscheidungs-Lifecycle (active → open → archived) | 9 | 7 | — |

## Selbsttest-Schritte

Diese Schritte führen die Szenarien aus; „letzter Lauf“ stammt aus `src/features/selftest/last-runs.json`, nicht aus dieser Doku.

| Szenario | Schritt | Bezeichnung | Art | letzter Lauf |
|---|---|---|---|---|
| `decision-lifecycle` | `dashboard-nudges` | Anstupsen: zehn Sekunden und 24-Stunden-Sperre | logic | — |
| `decision-lifecycle` | `dashboard-voting` | Dashboard: nur eigene ausstehende Abstimmungen, keine eigenen Anfragen | logic | — |
| `decision-lifecycle` | `create` | Entscheidung anlegen (active) | db | — |
| `decision-lifecycle` | `add-participant` | Teilnehmer (sich selbst) hinzufügen | db | — |
| `decision-lifecycle` | `withdraw-responses` | Ja, Nein und Rückfrage speichern und nachweisbar zurücknehmen | workflow | — |
| `decision-lifecycle` | `check-options` | Default-Antwortoptionen prüfen | db | — |
| `decision-lifecycle` | `change-vote-history` | Antwort ändern und den bisherigen Stand im Verlauf behalten | workflow | — |
| `decision-lifecycle` | `decision-attachments` | Anhang-Metadaten an die Entscheidung hängen, lesen und entfernen | workflow | — |
| `decision-lifecycle` | `comments-and-reactions` | Kommentar, Antwort und Emoji-Reaktion speichern und entfernen | workflow | — |
| `decision-lifecycle` | `notifications` | Meldungen entstehen im Mandanten der Entscheidung | workflow | — |
| `decision-lifecycle` | `set-open` | Status auf 'open' | db | — |
| `decision-lifecycle` | `archive` | Archivieren | db | — |
| `decision-lifecycle` | `verify` | Verifikation | db | — |
| `decision-lifecycle` | `nudge-boundary` | Fremde oder unbekannte Entscheidung lässt sich nicht anstupsen | workflow | — |
| `decision-lifecycle` | `nudge-open-decision` | Offene Entscheidung anmahnen: Eintrag, Meldung und 24-Stunden-Sperre | workflow | — |

## Deklarierter Prüfumfang

### `decision-lifecycle`

1. Ja, Nein und Rückfrage werden gespeichert und nachweisbar zurückgenommen
2. Eine geänderte Antwort schreibt den bisherigen und den neuen Stand in task_decision_response_history
3. Anhang-Metadaten hängen an der Entscheidung, sind für Teilnehmende lesbar und wieder entfernbar (ohne Datei-Upload)
4. Kommentar und Antwort werden gespeichert; Emoji-Reaktionen folgen der Allowlist, sind je Person eindeutig und wieder entfernbar
5. Das Anmahnen speichert den Eintrag mit Absender und Notiz und weist die zweite Mahnung innerhalb von 24 Stunden ab
6. Anstupsen ist auf die eigene offene Entscheidung beschränkt; ohne wartenden Abgeordneten wird abgewiesen
7. Anfrage-, Kommentar-, Reaktions-, Ersteller-Antwort- und Abschlussmeldung entstehen im Mandanten der Entscheidung

## Funktionsdetails

### `decisions.create` — Entscheidung anlegen
Erstellt eine Entscheidung mit Optionen, Frist, Teilnehmenden, Anhängen und Bezug zu Aufgabe, Vorgang oder Meeting. Die Anfrage an Teilnehmende entsteht per Trigger im Mandanten der Entscheidung.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/decisions`
- **Frontend-Komponenten:** `src/pages/Decisions.tsx`, `src/components/task-decisions`
- **Services:** —
- **Hooks:** `src/hooks/useMyWorkDecisionsData.ts`, `src/hooks/useDefaultDecisionSettings.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `create_work_decision`, `decision_notification_selftest`
- **Tabellen:** `task_decisions`, `task_decision_participants`, `task_decision_topics`, `task_decision_attachments`
- **Abhängigkeiten:** —
- **Selbsttests:** `decision-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/my-work-decisions-button-flowchart.md`, `docs/decision-notifications.md`

**Nachweise im Quellcode**

- src/pages/Decisions.tsx
- src/features/selftest/scenarios/decision-lifecycle.ts
- supabase/migrations/20261128210000_decision_notification_tenant.sql
- supabase/migrations/20261128213000_decision_notification_trigger_safety.sql

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
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `oeffentlich`, `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/decision-response/:participantId`
- **Frontend-Komponenten:** `src/pages/DecisionResponse.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `process-decision-response`
- **Datenbankfunktionen:** `generate_decision_participant_token`, `set_decision_participant_token`, `can_access_decision`, `user_can_access_task_decision`
- **Tabellen:** `task_decision_participants`, `task_decisions`
- **Abhängigkeiten:** `decisions.create`
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
Nimmt Ja/Nein/Enthaltung an, protokolliert die Antwort und stößt Aufgabenfolgen an. Abschluss und Ersteller-Antwort meldet ein Trigger im Mandanten der Entscheidung.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `log_decision_response_change`, `return_task_ball_after_vote`
- **Tabellen:** `task_decision_responses`, `task_decision_participants`, `tasks`
- **Abhängigkeiten:** `decisions.participants`
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
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `check_archive_after_creator_response`
- **Tabellen:** `task_decision_responses`, `task_decision_response_history`
- **Abhängigkeiten:** `decisions.vote`
- **Selbsttests:** `decision-lifecycle`
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
Ermöglicht Kommentare zu Entscheidungen, Antworten auf Kommentare und Emoji-Reaktionen. Kommentar- und Reaktionsmeldungen entstehen per Trigger im Mandanten der Entscheidung; je Empfänger, Kommentar und Emoji höchstens eine Reaktionsmeldung in fünf Minuten, und Meldungsfehler rollen den Kommentar nicht zurück.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/shared/DecisionResponseSummary.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useDecisionComments.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `task_decision_comments`, `task_decision_comment_reactions`
- **Abhängigkeiten:** `decisions.create`
- **Selbsttests:** `decision-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/task-decision-reactions-rollout.md`, `docs/emoji-reactions-dod-v1.md`, `docs/decision-notifications.md`

**Nachweise im Quellcode**

- src/hooks/useDecisionComments.ts
- src/components/shared/DecisionResponseSummary.tsx
- supabase/migrations/20261128210000_decision_notification_tenant.sql
- supabase/migrations/20261128213000_decision_notification_trigger_safety.sql

**Bekannte Einschränkungen**

- Geprüft sind Anlegen, Antwort, Reaktion samt Emoji-Allowlist, Entfernen, die Fünf-Minuten-Sperre samt Ablauf und der Ausschluss von Nicht-Mitgliedern. Das Bearbeiten eigener Kommentare und die Sichtbarkeitsgrenze für Nicht-Beteiligte haben keinen Schritt.

**Offene Prüfpunkte**

- Keine.

### `decisions.attachments` — Anhänge an Entscheidungen
Lädt Anhänge zu Entscheidungen hoch, verknüpft sie und stellt sie Teilnehmenden bereit.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** teilweise
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** `src/hooks/useDecisionAttachmentUpload.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `task_decision_attachments`, `task_decisions`
- **Abhängigkeiten:** `decisions.create`
- **Selbsttests:** `decision-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/hooks/useDecisionAttachmentUpload.ts

**Bekannte Einschränkungen**

- Der Schritt prüft die Metadatenzeile, ihre Zuordnung und das Entfernen, aber keinen echten Datei-Upload oder -Download. Bucket-Policies, Vorschau und Zugriff auf die gespeicherte Datei bleiben offen.

**Offene Prüfpunkte**

- Keine.

### `decisions.remind` — Offene Entscheidungen anmahnen
Zeigt offene Entscheidungen im Abgeordneten-Dashboard und erlaubt gezielte Erinnerungen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** teilweise
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/decisions/DeputyWaitingCard.tsx`, `src/components/dashboard/DashboardDecisionsWidget.tsx`
- **Services:** `src/features/decisions/dashboardNudges.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `nudge_dashboard_decision`, `get_deputy_dashboard_decisions`, `get_my_work_decisions`, `decision_nudge_selftest`
- **Tabellen:** `dashboard_decision_nudges`, `task_decisions`
- **Abhängigkeiten:** `decisions.create`
- **Selbsttests:** `decision-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/decisions/DeputyWaitingCard.tsx
- src/features/decisions/dashboardNudges.ts

**Bekannte Einschränkungen**

- Der echte Anstups-RPC läuft über decision_nudge_selftest und wird vollständig zurückgerollt: Eintrag mit Absender und Notiz sowie die 24-Stunden-Sperre sind belegt. Ohne zweites aktives Abgeordnetenkonto oder mit einer nicht anmahnenden Rolle prüft der Aufruf nur die Abweisung.
- Die Zustellung der Anstups-Benachrichtigung an den Abgeordneten wird nicht geprüft; sie entsteht im zurückgerollten Prüfpfad.

**Offene Prüfpunkte**

- Keine.

### `decisions.archive` — Entscheidungen archivieren
Archiviert abgeschlossene Entscheidungen automatisch oder manuell und hält die Archivkonfiguration je Büro.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `admin`, `bueroleitung`, `system`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/DecisionArchiveSettings.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `auto-archive-decisions`
- **Datenbankfunktionen:** `auto_archive_completed_decisions`, `check_and_archive_decision`
- **Tabellen:** `task_decisions`, `decision_archive_settings`
- **Abhängigkeiten:** `decisions.vote`
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
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `send-decision-email`
- **Datenbankfunktionen:** —
- **Tabellen:** `decision_email_templates`, `email_logs`
- **Abhängigkeiten:** `decisions.create`, `integration.email`
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
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`, `abgeordneter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `matrix-decision-handler`
- **Datenbankfunktionen:** —
- **Tabellen:** `decision_matrix_messages`, `task_decision_responses`
- **Abhängigkeiten:** `decisions.vote`
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
