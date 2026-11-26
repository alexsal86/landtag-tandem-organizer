# Redaktion, News & Chat

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/kommunikation.json`). Nicht von Hand bearbeiten._

**Zweck:** Social-Media-Planung und Freigaben, Pressemitteilungen und Newsversand sowie die interne Matrix-Kommunikation.

## Kennzahlen

- Funktionen: **14** in **5** Unterbereichen
- implementiert: **14**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **14**
- ohne Dokumentationsverweis: **10**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `chat.messages` Interner Chat über Matrix | Chat | fachlich | implementiert | UI | kein Test |
| `chat.matrix-bot` Matrix-Bot und morgendliche Begrüßung | Chat | integration | implementiert | systemseitig | kein Test |
| `chat.team-announcements` Team-Ankündigungen | Chat | fachlich | implementiert | UI | kein Test |
| `widget.matrix-website` Matrix-Website-Widget | Matrix | integration | implementiert | UI | kein Test |
| `news.email` News per E-Mail versenden | News | integration | implementiert | rollenabhängig | kein Test |
| `news.matrix` News über Matrix verteilen | News | integration | implementiert | systemseitig | kein Test |
| `news.articles` News-Artikel und Lesestatus | News | fachlich | implementiert | UI | kein Test |
| `press.ghost` Pressemitteilung nach Ghost veröffentlichen | Presse | integration | implementiert | rollenabhängig | kein Test |
| `press.releases` Pressemitteilungen erstellen und freigeben | Presse | fachlich | implementiert | UI | kein Test |
| `redaktion.calendar-reminders` Redaktionskalender und Erinnerungen | Social Planner | automatisiert | implementiert | systemseitig | kein Test |
| `redaktion.assets-campaigns` Social-Assets und Kampagnen | Social Planner | fachlich | implementiert | UI | kein Test |
| `redaktion.approval` Social-Media-Freigabe | Social Planner | fachlich | implementiert | rollenabhängig | kein Test |
| `redaktion.planner` Social-Media-Planung | Social Planner | fachlich | implementiert | UI | kein Test |
| `redaktion.themenspeicher` Themenspeicher und Hashtags | Social Planner | fachlich | implementiert | UI | kein Test |

## Unterbereiche

- Social Planner
- Presse
- News
- Chat
- Matrix

## Rollen

`abgeordneter`, `bueroleitung`, `mitarbeiter`, `system`, `praktikant`, `oeffentlich`, `admin`

## Datenbanktabellen

`email_logs`, `matrix_bot_logs`, `matrix_morning_settings`, `matrix_subscriptions`, `matrix_widget_callback_requests`, `matrix_widget_improvement_triggers`, `matrix_widget_message_feedback`, `message_confirmations`, `message_recipients`, `messages`, `news_article_states`, `news_articles`, `news_email_templates`, `press_releases`, `social_approval_comments`, `social_assets`, `social_campaigns`, `social_content_approval_events`, `social_content_channels`, `social_content_item_channels`, `social_content_items`, `social_content_variants`, `social_hashtag_sets`, `social_planner_notes`, `team_announcement_dismissals`, `team_announcements`, `topic_backlog`

## Selbsttest-Szenarien

Keine Szenarien zugeordnet. Das bedeutet nicht, dass der Bereich ungetestet ist – es fehlt eine Selbsttest-Abdeckung.

## Selbsttest-Schritte

Keine Schritte deklariert.

## Deklarierter Prüfumfang

Keine Prüfungen deklariert.

## Funktionsdetails

### `redaktion.planner` — Social-Media-Planung
Plant Beiträge im Kalender, ordnet Kanäle und Varianten zu und führt den Redaktionsstatus.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/mywork?tab=redaktion`, `/redaktion`
- **Frontend-Komponenten:** `src/features/redaktion/components/RedaktionFeature.tsx`, `src/features/redaktion/components/PlannerBoard.tsx`, `src/features/redaktion/components/PlannerCalendarGrid.tsx`
- **Services:** —
- **Hooks:** `src/features/redaktion/hooks/useSocialPlannerItems.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `social_content_items`, `social_content_channels`, `social_content_item_channels`, `social_content_variants`
- **Abhängigkeiten:** `redaktion.themenspeicher`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/emoji-reactions-dod-v1.md`

**Nachweise im Quellcode**

- src/features/redaktion/components/RedaktionFeature.tsx
- src/features/redaktion/hooks/useSocialPlannerItems.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `redaktion.approval` — Social-Media-Freigabe
Führt Beiträge durch Freigabe, fordert Änderungen an, protokolliert Entscheidungen und benachrichtigt Beteiligte.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/redaktion/approval.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `request_social_post_changes`, `notify_social_post_approved`, `queue_social_content_reapproval`, `reopen_social_content_after_variant_change`, `enforce_social_content_approval_permissions`, `log_social_content_approval_event`
- **Tabellen:** `social_content_items`, `social_content_approval_events`, `social_approval_comments`
- **Abhängigkeiten:** `redaktion.planner`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/redaktion/approval.ts
- src/features/redaktion/hooks/useApprovalComments.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `redaktion.assets-campaigns` — Social-Assets und Kampagnen
Verwaltet Bild-/Video-Assets und fasst Beiträge zu Kampagnen zusammen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** `src/features/redaktion/hooks/useSocialAssets.ts`, `src/features/redaktion/hooks/useSocialCampaigns.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `social_assets`, `social_campaigns`
- **Abhängigkeiten:** `redaktion.planner`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/redaktion/hooks/useSocialAssets.ts
- src/features/redaktion/hooks/useSocialCampaigns.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `redaktion.themenspeicher` — Themenspeicher und Hashtags
Sammelt Themenvorrat, überführt Notizen in den Themenspeicher und verwaltet Hashtag-Sets.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/redaktion/components/Themenspeicher.tsx`, `src/features/redaktion/components/TransferToThemenspeicherDialog.tsx`
- **Services:** —
- **Hooks:** `src/features/redaktion/hooks/useTopicBacklog.ts`, `src/features/redaktion/hooks/useHashtagSets.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `queue_social_content_reapproval`
- **Tabellen:** `topic_backlog`, `social_hashtag_sets`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/redaktion/components/Themenspeicher.tsx
- src/features/redaktion/hooks/useTopicBacklog.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `redaktion.calendar-reminders` — Redaktionskalender und Erinnerungen
Zeigt Redaktionstermine und besondere Tage und versendet Erinnerungen für geplante Beiträge.

- **Kategorie:** automatisiert
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `system`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/redaktion/components/Kalenderansicht.tsx`
- **Services:** `src/features/redaktion/utils/fetchSpecialDays.ts`, `src/features/redaktion/utils/plannerRules.ts`
- **Hooks:** —
- **Edge Functions:** `social-planner-reminders`
- **Datenbankfunktionen:** —
- **Tabellen:** `social_content_items`, `social_planner_notes`
- **Abhängigkeiten:** `redaktion.planner`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/redaktion/components/Kalenderansicht.tsx
- supabase/functions/social-planner-reminders/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `press.releases` — Pressemitteilungen erstellen und freigeben
Verfasst Pressemitteilungen im Wizard, pflegt Revisionen und Kommentare und verfolgt den Status.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** `/news`
- **Frontend-Komponenten:** `src/components/press/PressReleasesList.tsx`, `src/components/press/PressReleaseWizard.tsx`, `src/components/press/PressReleaseEditor.tsx`, `src/components/press/RevisionCommentDialog.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `press_releases`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/press/PressReleaseWizard.tsx
- src/components/press/PressReleasesList.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `press.ghost` — Pressemitteilung nach Ghost veröffentlichen
Veröffentlicht Pressemitteilungen über die Ghost-API und protokolliert den Versand.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/press/GhostPublishDialog.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `publish-to-ghost`
- **Datenbankfunktionen:** —
- **Tabellen:** `press_releases`
- **Abhängigkeiten:** `press.releases`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/ghost-rsvp-widget`

**Nachweise im Quellcode**

- supabase/functions/publish-to-ghost/index.ts
- src/components/press/GhostPublishDialog.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `news.articles` — News-Artikel und Lesestatus
Zeigt News-Artikel, speichert Lesestatus und bereinigt alte Artikel.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/news`
- **Frontend-Komponenten:** `src/pages/NewsPage.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `cleanup_stale_news_articles`
- **Tabellen:** `news_articles`, `news_article_states`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/pages/NewsPage.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `news.email` — News per E-Mail versenden
Versendet News-Artikel als E-Mail auf Basis von Vorlagen.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/administration/NewsEmailTemplateManager.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `send-news-email`
- **Datenbankfunktionen:** —
- **Tabellen:** `news_email_templates`, `email_logs`
- **Abhängigkeiten:** `news.articles`, `integration.email`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/send-news-email/index.ts
- src/components/administration/NewsEmailTemplateManager.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `chat.messages` — Interner Chat über Matrix
Stellt Räume, Nachrichten, Reaktionen, Anhänge und Lesestatus über den Matrix-Client bereit.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/chat`
- **Frontend-Komponenten:** `src/components/chat/MatrixChatView.tsx`, `src/components/chat/ChatMessages.tsx`, `src/components/chat/RoomList.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useMatrixClient.tsx`, `src/hooks/useMessagesRealtime.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** `mark_message_read`, `send_message`
- **Tabellen:** `messages`, `message_recipients`, `message_confirmations`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/chat/MatrixChatView.tsx
- src/hooks/useMatrixClient.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `news.matrix` — News über Matrix verteilen
Veröffentlicht News-Artikel in Matrix-Räumen und protokolliert die Zustellung.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `bueroleitung`, `mitarbeiter`, `system`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/admin/MatrixSettings.tsx`
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `send-news-matrix`
- **Datenbankfunktionen:** —
- **Tabellen:** `news_articles`, `matrix_subscriptions`
- **Abhängigkeiten:** `news.articles`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/matrix-chatbot-integration.md`

**Nachweise im Quellcode**

- supabase/functions/send-news-matrix/index.ts
- src/components/admin/MatrixSettings.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `chat.matrix-bot` — Matrix-Bot und morgendliche Begrüßung
Verbindet das Büro mit einem Matrix-Bot und versendet morgendliche Zusammenfassungen.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** systemseitig
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `system`, `abgeordneter`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** `matrix-bot-handler`, `send-matrix-morning-greeting`
- **Datenbankfunktionen:** —
- **Tabellen:** `matrix_bot_logs`, `matrix_morning_settings`, `matrix_subscriptions`
- **Abhängigkeiten:** `chat.messages`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- supabase/functions/matrix-bot-handler/index.ts
- supabase/functions/send-matrix-morning-greeting/index.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Der Bot-Handler ist JWT-geschützt, aber der fachliche Befehlsraum ist nicht dokumentiert.

### `chat.team-announcements` — Team-Ankündigungen
Veröffentlicht Ankündigungen im Team und merkt sich Ausblendungen je Nutzer.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** `src/hooks/useTeamAnnouncements.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `team_announcements`, `team_announcement_dismissals`
- **Abhängigkeiten:** `chat.messages`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/hooks/useTeamAnnouncements.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `widget.matrix-website` — Matrix-Website-Widget
Bindet einen Website-Chat als Matrix-Widget ein und nimmt Rückmeldungen und Verbesserungsvorschläge entgegen.

- **Kategorie:** integration
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (kein Laufnachweis importiert; nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `oeffentlich`, `admin`, `bueroleitung`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/matrix-widget/MatrixWebsiteWidget.tsx`, `src/components/administration/MatrixWidgetAdmin.tsx`
- **Services:** `src/features/matrix-widget/api.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** `create_matrix_widget_improvement_trigger`
- **Tabellen:** `matrix_widget_callback_requests`, `matrix_widget_improvement_triggers`, `matrix_widget_message_feedback`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/matrix-chatbot-integration.md`

**Nachweise im Quellcode**

- src/features/matrix-widget/MatrixWebsiteWidget.tsx
- src/components/administration/MatrixWidgetAdmin.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
