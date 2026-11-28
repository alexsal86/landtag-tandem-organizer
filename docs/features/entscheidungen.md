# Entscheidungen

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/entscheidungen.json`). Nicht von Hand bearbeiten._

**Zweck:** Entscheidungen vorbereiten, Teilnehmende abstimmen lassen, Antworten und Kommentare führen, erinnern und archivieren.

## Kennzahlen

- Funktionen: **14** in **8** Unterbereichen
- implementiert: **14**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **3**
- ohne Dokumentationsverweis: **9**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `decisions.vote` Abstimmen | Abstimmung | fachlich | implementiert | UI | Selbsttest |
| `decisions.change-vote` Antwort ändern und Verlauf einsehen | Abstimmung | fachlich | implementiert | UI | Selbsttest |
| `decisions.comments` Kommentare und Reaktionen | Abstimmung | fachlich | implementiert | UI | Selbsttest |
| `decisions.withdraw-vote` Votum zurücknehmen | Abstimmung | fachlich | implementiert | UI | Selbsttest |
| `decisions.attachments` Anhänge an Entscheidungen | Anlegen | fachlich | implementiert | UI | teilweise |
| `decisions.create` Entscheidung anlegen | Anlegen | fachlich | implementiert | rollenabhängig | Selbsttest |
| `decisions.archive` Entscheidungen archivieren | Archiv | automatisiert | implementiert | systemseitig | kein Test |
| `decisions.email` Entscheidungs-E-Mails | Benachrichtigung | integration | implementiert | rollenabhängig | kein Test |
| `decisions.remind` Offene Entscheidungen anmahnen | Erinnerungen | fachlich | implementiert | UI | teilweise |
| `decisions.matrix` Entscheidungen über Matrix beantworten | Integration | integration | implementiert | systemseitig | kein Test |
| `decisions.notification-digest` Gebündelte Entscheidungs-Meldungen | Meldungen | fachlich | implementiert | rollenabhängig | Selbsttest |
| `decisions.notification-actions` Meldungen bedienbar machen | Meldungen | fachlich | implementiert | UI | Selbsttest |
| `decisions.notification-metrics` Wirkung der Entscheidungs-Meldungen messen | Meldungen | fachlich | implementiert | rollenabhängig | Selbsttest |
| `decisions.participants` Teilnehmende und Antwort-Token verwalten | Teilnehmende | fachlich | implementiert | rollenabhängig | Selbsttest |

## Unterbereiche

- Anlegen
- Teilnehmende
- Abstimmung
- Meldungen
- Erinnerungen
- Archiv
- Benachrichtigung
- Integration

## Rollen

`abgeordneter`, `bueroleitung`, `mitarbeiter`, `oeffentlich`, `admin`, `system`

## Datenbanktabellen

`dashboard_decision_nudges`, `decision_archive_settings`, `decision_email_templates`, `decision_invitation_dispatches`, `decision_matrix_messages`, `decision_notification_trigger_errors`, `email_logs`, `notification_types`, `notifications`, `task_decision_attachments`, `task_decision_comment_reactions`, `task_decision_comments`, `task_decision_participants`, `task_decision_response_history`, `task_decision_responses`, `task_decision_topics`, `task_decision_vote_effects`, `task_decisions`, `tasks`, `tenant_notification_settings`, `user_notification_settings`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen | letzter Lauf |
|---|---|---:|---:|---|
| `decision-lifecycle` | Entscheidungs-Lifecycle (active → open → archived) | 11 | 9 | — |
| `task-lifecycle` | Aufgaben-Lifecycle (Zuweisung → Frist → Entscheidung → Jour fixe → erledigt) | 6 | 8 | — |

## Selbsttest-Schritte

Diese Schritte führen die Szenarien aus; „letzter Lauf“ stammt aus `src/features/selftest/last-runs.json`, nicht aus dieser Doku.

| Szenario | Schritt | Bezeichnung | Art | letzter Lauf |
|---|---|---|---|---|
| `decision-lifecycle` | `dashboard-nudges` | Anstupsen: zehn Sekunden und 24-Stunden-Sperre | logic | — |
| `decision-lifecycle` | `dashboard-voting` | Dashboard: nur eigene ausstehende Abstimmungen, keine eigenen Anfragen | logic | — |
| `decision-lifecycle` | `create` | Entscheidung anlegen (active) | db | — |
| `decision-lifecycle` | `add-participant` | Teilnehmer (sich selbst) hinzufügen | db | — |
| `decision-lifecycle` | `withdraw-responses` | Ja, Nein und Rückfrage speichern und nachweisbar zurücknehmen | workflow | — |
| `decision-lifecycle` | `withdraw-task-vote` | Rücknahme eines Votums an einer verknüpften Aufgabe | workflow | — |
| `decision-lifecycle` | `check-options` | Default-Antwortoptionen prüfen | db | — |
| `decision-lifecycle` | `change-vote-history` | Antwort ändern und den bisherigen Stand im Verlauf behalten | workflow | — |
| `decision-lifecycle` | `decision-attachments` | Anhang-Metadaten an die Entscheidung hängen, lesen und entfernen | workflow | — |
| `decision-lifecycle` | `comments-and-reactions` | Kommentar, Antwort und Emoji-Reaktion speichern und entfernen | workflow | — |
| `decision-lifecycle` | `notifications` | Meldungen entstehen im Mandanten der Entscheidung | workflow | — |
| `decision-lifecycle` | `invitation-dispatch` | Einladungsversand wird serverseitig eingestellt und übernommen | workflow | — |
| `decision-lifecycle` | `lifecycle-notifications` | Frist, Rückzug, Ergebnis und direkte Antwort melden | workflow | — |
| `decision-lifecycle` | `notification-metrics` | Zustellungen, Abschaltquote, Antwortzeit, Anstupser und Trigger-Fehler messen | workflow | — |
| `decision-lifecycle` | `notification-actions` | Aus der Meldung abstimmen und Antwort aktualisieren | workflow | — |
| `decision-lifecycle` | `digest` | Meldungen werden gebündelt und nur der Digest wird gepusht | workflow | — |
| `decision-lifecycle` | `set-open` | Status auf 'open' | db | — |
| `decision-lifecycle` | `archive` | Archivieren | db | — |
| `decision-lifecycle` | `verify` | Verifikation | db | — |
| `decision-lifecycle` | `nudge-boundary` | Fremde oder unbekannte Entscheidung lässt sich nicht anstupsen | workflow | — |
| `decision-lifecycle` | `nudge-open-decision` | Offene Entscheidung anmahnen: Eintrag, Meldung und 24-Stunden-Sperre | workflow | — |
| `task-lifecycle` | `status-registry` | Status-Registry führt die fünf Kernstatus | db | — |
| `task-lifecycle` | `create` | Aufgabe anlegen | db | — |
| `task-lifecycle` | `document-link` | Dokument an Aufgabe hängen und wieder lösen | db | — |
| `task-lifecycle` | `subtasks` | Unteraufgaben: Verknüpfung, Hauptliste und Fortschritt | workflow | — |
| `task-lifecycle` | `assign` | Aufgabe zuweisen + Frist setzen | db | — |
| `task-lifecycle` | `deadline-review` | Fristen: Berliner Gruppierung, Verwerfen und Rückgängig | workflow | — |
| `task-lifecycle` | `decision` | Entscheidung aus Aufgabe erstellen | db | — |
| `task-lifecycle` | `jour-fixe` | Für Jour fixe markieren | db | — |
| `task-lifecycle` | `complete` | Status → completed | db | — |
| `task-lifecycle` | `completion-stamp` | Abschluss stempelt completed_at, Wiederöffnen löscht den Stempel | db | — |
| `task-lifecycle` | `recurrence-spawn` | Wiederholung legt beim Abschluss genau eine Folgeaufgabe an | workflow | — |
| `task-lifecycle` | `decision-ball` | Votum holt den Ball zurück; Folgeaufgabe entsteht genau einmal | workflow | — |
| `task-lifecycle` | `decision-ball-withdrawal` | Rücknahme des Votums stellt Ball und Schritt wieder her | workflow | — |
| `task-lifecycle` | `tenant-boundary` | Aufgabe lässt sich keinem fremden Büro zuordnen | workflow | — |

## Deklarierter Prüfumfang

### `decision-lifecycle`

1. Ja, Nein und Rückfrage werden gespeichert und nachweisbar zurückgenommen
2. Die Rücknahme eines Votums an einer verknüpften Aufgabe gibt Ball und nächsten Schritt zurück und entfernt den Votum-Eintrag
3. Eine geänderte Antwort schreibt den bisherigen und den neuen Stand in task_decision_response_history
4. Anhang-Metadaten hängen an der Entscheidung, sind für Teilnehmende lesbar und wieder entfernbar (ohne Datei-Upload)
5. Kommentar und Antwort werden gespeichert; Emoji-Reaktionen folgen der Allowlist, sind je Person eindeutig und wieder entfernbar
6. Das Anmahnen speichert den Eintrag mit Absender und Notiz und weist die zweite Mahnung innerhalb von 24 Stunden ab
7. Anstupsen ist auf die eigene offene Entscheidung beschränkt; ohne wartenden Abgeordneten wird abgewiesen
8. Anfrage-, Kommentar-, Reaktions-, Ersteller-Antwort- und Abschlussmeldung entstehen im Mandanten der Entscheidung
9. Teilnehmer-Insert stellt genau eine Einladungs-Versandzeile ein, die der Worker übernimmt und verbucht

### `task-lifecycle`

1. Status-Registry führt die fünf Kernstatus
2. Dokument hängt an der Aufgabe, bleibt auf eigene Aufgaben beschränkt und lässt sich wieder lösen
3. Unteraufgaben tragen parent_task_id, erscheinen nicht als eigene Hauptaufgabe und treiben den Fortschritt auf 50 bzw. 100 Prozent
4. Fristen werden nach Berliner Tagen gruppiert; Verwerfen löscht nur die Frist und Rückgängig stellt sie wieder her
5. Abschluss setzt completed_at, Wiederöffnen entfernt es
6. Wiederholungsregel legt beim Abschluss genau eine Folgeaufgabe an
7. Votum zu einer verknüpften Entscheidung holt den Ball zurück und erzeugt die Folgeaufgabe genau einmal
8. Rücknahme des Votums gibt Ball, nächsten Schritt und Frist zurück und entfernt den Votum-Eintrag; eine weitergelaufene Aufgabe bleibt stehen und wird nur vermerkt

## Funktionsdetails

### `decisions.create` — Entscheidung anlegen
Erstellt eine Entscheidung mit Optionen, Frist, Teilnehmenden, Anhängen und Bezug zu Aufgabe, Vorgang oder Meeting. Die Anfrage an Teilnehmende entsteht per Trigger im Mandanten der Entscheidung. E-Mail-Einladungen laufen über eine serverseitige Outbox, die auch später hinzugefügte Teilnehmende erfasst.

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
- **Edge Functions:** `send-decision-email`, `dispatch-decision-invitations`
- **Datenbankfunktionen:** `create_work_decision`, `decision_notification_selftest`, `decision_invitation_dispatch_selftest`, `decision_lifecycle_notification_selftest`, `decision_notification_actions_selftest`, `respond_to_decision`, `request_decision_email_invites`, `enqueue_decision_invitation_dispatch`, `claim_decision_invitation_dispatches`, `finish_decision_invitation_dispatch`
- **Tabellen:** `task_decisions`, `task_decision_participants`, `task_decision_topics`, `task_decision_attachments`, `decision_invitation_dispatches`
- **Abhängigkeiten:** —
- **Selbsttests:** `decision-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/my-work-decisions-button-flowchart.md`, `docs/decision-notifications.md`, `docs/decision-invitation-dispatch.md`, `docs/decision-lifecycle-notifications.md`, `docs/decision-notification-actions.md`

**Nachweise im Quellcode**

- src/pages/Decisions.tsx
- src/features/selftest/scenarios/decision-lifecycle.ts
- supabase/migrations/20261128210000_decision_notification_tenant.sql
- supabase/migrations/20261128213000_decision_notification_trigger_safety.sql
- supabase/migrations/20261128215000_decision_invitation_dispatch.sql
- supabase/migrations/20261128217000_decision_lifecycle_notifications.sql
- supabase/migrations/20261128218000_decision_lifecycle_notification_selftest.sql

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

### `decisions.withdraw-vote` — Votum zurücknehmen
Nimmt die eigene Antwort samt ihrer Aufgabenwirkung zurück: Ball, nächster Schritt und Frist kehren auf den Stand vor dem Votum zurück, solange die Aufgabe unverändert ist; eine weitergelaufene Aufgabe erhält nur einen Rücknahme-Vermerk.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/dashboard/DashboardDecisionsWidget.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `withdraw_decision_response`
- **Tabellen:** `task_decision_responses`, `task_decision_vote_effects`, `task_decision_participants`, `tasks`
- **Abhängigkeiten:** `decisions.vote`
- **Selbsttests:** `decision-lifecycle`, `task-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/dashboard/DashboardDecisionsWidget.tsx
- supabase/migrations/20261128090000_decision_vote_withdrawal_snapshot.sql

**Bekannte Einschränkungen**

- Die Zustellung der Votum-Benachrichtigung lässt sich nicht zurückholen; die Rücknahme berührt sie nicht, weil sie zum Votum gehört hat.
- Ein Votum aus der Zeit vor dem Snapshot (Migration 20261128090000) hat keinen gespeicherten Vorher-Zustand; seine Rücknahme vermerkt das im Verlauf und lässt den Ball beim Büro.

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
Ermöglicht Kommentare zu Entscheidungen, Antworten auf Kommentare und Emoji-Reaktionen. Kommentar- und Reaktionsmeldungen entstehen per Trigger im Mandanten der Entscheidung; eine direkte Antwort meldet sich gezielt beim Elternautor statt als allgemeine Kommentarmeldung. Je Empfänger, Kommentar und Emoji höchstens eine Reaktionsmeldung in fünf Minuten, und Meldungsfehler rollen den Kommentar nicht zurück.

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
- supabase/migrations/20261128217000_decision_lifecycle_notifications.sql

**Bekannte Einschränkungen**

- Geprüft sind Anlegen, Antwort, Reaktion samt Emoji-Allowlist, Entfernen, die Fünf-Minuten-Sperre samt Ablauf und der Ausschluss von Nicht-Mitgliedern. Das Bearbeiten eigener Kommentare und die Sichtbarkeitsgrenze für Nicht-Beteiligte haben keinen Schritt.

**Offene Prüfpunkte**

- Keine.

### `decisions.notification-digest` — Gebündelte Entscheidungs-Meldungen
Fasst offene Kommentar-, Antwort- und Reaktionsmeldungen je Empfänger und Entscheidung nach einem mandantenweit konfigurierbaren Intervall zu einer Digest-Meldung zusammen. Ersetzte Einzelmeldungen werden als gelesen und ersetzt markiert; Push geht nur für den Digest raus. Das Reaktionsfenster ist ebenfalls je Mandant einstellbar.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `flush_decision_notification_digests`, `set_decision_notification_timing`, `decision_digest_selftest`
- **Tabellen:** `notifications`, `notification_types`, `tenant_notification_settings`
- **Abhängigkeiten:** `decisions.comments`
- **Selbsttests:** `decision-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/decision-notification-digest.md`

**Nachweise im Quellcode**

- supabase/migrations/20261128219000_decision_notification_digest.sql
- supabase/migrations/20261128220000_decision_notification_digest_selftest.sql
- src/features/selftest/scenarios/decision-lifecycle.ts

**Bekannte Einschränkungen**

- Nicht geprüft: echter Cron-Lauf, tatsächlicher Push-Versand, parallele Flush-Läufe und eine Oberfläche für die Mandanteneinstellung. Die Einstellung ist derzeit nur über set_decision_notification_timing erreichbar.

**Offene Prüfpunkte**

- Keine.

### `decisions.notification-metrics` — Wirkung der Entscheidungs-Meldungen messen
Liefert je Mandant Kanalzustellungen (In-App, Push, E-Mail), Abschaltquoten je Entscheidungstyp, Zeit bis zur ersten Antwort, Anstupser-Wirkung innerhalb von 24 Stunden sowie Trigger-Fehlerquote und Alarm bei Ausnahmen der letzten 24 Stunden.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `notification_metrics`, `decision_notification_metrics_selftest`
- **Tabellen:** `notifications`, `notification_types`, `user_notification_settings`, `task_decision_participants`, `task_decision_responses`, `dashboard_decision_nudges`, `decision_invitation_dispatches`, `decision_notification_trigger_errors`
- **Abhängigkeiten:** —
- **Selbsttests:** `decision-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/decision-notification-metrics.md`

**Nachweise im Quellcode**

- supabase/migrations/20261128223000_decision_notification_metrics.sql
- supabase/migrations/20261128224000_decision_notification_metrics_selftest.sql
- src/features/selftest/scenarios/decision-lifecycle.ts

**Bekannte Einschränkungen**

- Es gibt noch keine Kennzahlenansicht in der Oberfläche; die Werte sind über die RPC abrufbar. Echte Push-/E-Mail-Zustellung und Cron-Läufe sind nicht ausgeführt.

**Offene Prüfpunkte**

- Keine.

### `decisions.notification-actions` — Meldungen bedienbar machen
Erlaubt die Abstimmung direkt aus einer Anfrage- oder Digest-Meldung über respond_to_decision, öffnet Kommentar- und Antwortmeldungen an der konkreten Stelle und zeigt beim Anstupsen Person und Anzahl.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/decisions`, `/notifications`
- **Frontend-Komponenten:** `src/components/notifications/DecisionQuickResponse.tsx`, `src/components/notifications/NotificationCenter.tsx`, `src/components/dashboard/DashboardDecisionsWidget.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `respond_to_decision`, `decision_notification_actions_selftest`
- **Tabellen:** `task_decision_responses`, `dashboard_decision_nudges`
- **Abhängigkeiten:** `decisions.vote`
- **Selbsttests:** `decision-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/decision-notification-actions.md`

**Nachweise im Quellcode**

- src/components/notifications/DecisionQuickResponse.tsx
- src/components/task-decisions/DecisionOverview.tsx
- src/utils/notificationDeepLinks.ts
- src/features/decisions/dashboardNudges.ts
- supabase/migrations/20261128221000_decision_notification_actions.sql

**Bekannte Einschränkungen**

- Geprüft sind RPC-Verhalten und Formatierung; echte Klicks, Scrollen und Hervorhebung im Browser sowie Push sind nicht ausgeführt.

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
