# Redaktion, News & Chat

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/kommunikation.json`). Nicht von Hand bearbeiten._

**Zweck:** Social-Media-Planung und Freigaben, Pressemitteilungen und Newsversand sowie die interne Matrix-Kommunikation.

## Kennzahlen

- Funktionen: **14** in **5** Unterbereichen
- implementiert: **14**, teilweise: **0**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **11**
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
| `redaktion.approval` Social-Media-Freigabe | Social Planner | fachlich | implementiert | rollenabhängig | teilweise |
| `redaktion.planner` Social-Media-Planung | Social Planner | fachlich | implementiert | UI | Selbsttest |
| `redaktion.themenspeicher` Themenspeicher und Hashtags | Social Planner | fachlich | implementiert | UI | teilweise |

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

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen | letzter Lauf |
|---|---|---:|---:|---|
| `social-content-lifecycle` | Social-Content-Lifecycle (Planung, Kanalvariante, Freigabe und Ereignisprotokoll) | 10 | 9 | — |

## Selbsttest-Schritte

Diese Schritte führen die Szenarien aus; „letzter Lauf“ stammt aus `src/features/selftest/last-runs.json`, nicht aus dieser Doku.

| Szenario | Schritt | Bezeichnung | Art | letzter Lauf |
|---|---|---|---|---|
| `social-content-lifecycle` | `plan-topic` | Thema im Themenspeicher anlegen | db | — |
| `social-content-lifecycle` | `plan-item` | Beitrag mit Briefing anlegen | db | — |
| `social-content-lifecycle` | `channel-variant` | Kanal zuordnen und Kanalvariante speichern | db | — |
| `social-content-lifecycle` | `submit` | Beitrag zur Freigabe einreichen | db | — |
| `social-content-lifecycle` | `approve` | Beitrag freigeben und Freigabe aus der Sitzung prüfen | db | — |
| `social-content-lifecycle` | `request-changes` | Änderungswunsch mit Folgeaufgabe, Meldung und Protokoll | db | — |
| `social-content-lifecycle` | `resubmit-approve` | Nach dem Änderungswunsch erneut einreichen und freigeben | db | — |
| `social-content-lifecycle` | `variant-reopens-approval` | Geänderter Kanaltext öffnet die Freigabe automatisch wieder | db | — |

## Deklarierter Prüfumfang

### `social-content-lifecycle`

1. Thema im Themenspeicher und Beitrag mit Briefing-Feldern werden angelegt und unverändert zurückgelesen
2. Kanalzuordnung und Kanalvariante werden gespeichert, ohne den Freigabestand zu verändern
3. Einreichen setzt den Beitrag auf Freigabe und protokolliert genau ein Ereignis submitted
4. Freigeben setzt Freigeber und Zeitpunkt aus der Sitzung, auch wenn der Client beide Felder leert
5. Das Protokoll enthält danach genau submitted und approved mit den passenden Zuständen und dem handelnden Profil
6. Ein Änderungswunsch setzt den Beitrag auf Entwurf/abgelehnt, speichert den Kommentar und protokolliert rejected aus approved
7. Der Änderungswunsch löst die hinterlegte Profil-ID zur Login-ID auf: Folgeaufgabe, task_assignees, Meldung und Rückgabe adressieren die verantwortliche Person als Konto, nicht ihre Profil-ID
8. Nach erneutem Einreichen und Freigeben öffnet eine geänderte Kanaltext-Zeile die Freigabe automatisch wieder, leert Freigeber und Zeitpunkt und protokolliert reopened
9. Das Wiederöffnen verwendet die offene Folgeaufgabe weiter (keine zweite Aufgabe) und stellt sie auf „Freigabe erneut einholen“ mit Frist in der Zukunft

## Funktionsdetails

### `redaktion.planner` — Social-Media-Planung
Plant Beiträge im Kalender, ordnet Kanäle und Varianten zu und führt den Redaktionsstatus.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
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
- **Selbsttests:** `social-content-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/emoji-reactions-dod-v1.md`

**Nachweise im Quellcode**

- src/features/redaktion/components/RedaktionFeature.tsx
- src/features/redaktion/hooks/useSocialPlannerItems.ts

**Bekannte Einschränkungen**

- Der Selbsttest prüft Anlegen von Thema und Beitrag, Kanalzuordnung und Kanalvariante über die echten Tabellen; Kalenderansicht, Board-Bedienung und Echtzeit-Aktualisierung werden nicht über die Oberfläche geprüft.

**Offene Prüfpunkte**

- Keine.

### `redaktion.approval` — Social-Media-Freigabe
Führt Beiträge durch Freigabe, fordert Änderungen an, protokolliert Entscheidungen und benachrichtigt Beteiligte.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** teilweise
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
- **Selbsttests:** `social-content-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/redaktion/approval.ts
- src/features/redaktion/hooks/useApprovalComments.ts

**Bekannte Einschränkungen**

- Einreichen, Freigeben, Änderungswunsch mit Folgeaufgabe und das automatische Wiederöffnen nach geänderter Kanaltext-Zeile laufen im Selbsttest über die echten Trigger und RPCs samt Protokoll. Freie Kommentare ohne Änderungswunsch, Emoji-Reaktionen, die Push-Zustellung der Meldungen sowie Matrix-Chat und externe Veröffentlichung prüft das Szenario nicht. Den Fallback ohne hinterlegte verantwortliche Person (Aufgabe an die anlegende Person) prüft das Szenario nicht; es setzt von Anfang an eine verantwortliche Person und belegt die Auflösung über profiles.id zur Login-ID.

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
- **Testabdeckung:** teilweise
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
- **Selbsttests:** `social-content-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/redaktion/components/Themenspeicher.tsx
- src/features/redaktion/hooks/useTopicBacklog.ts

**Bekannte Einschränkungen**

- Das Szenario legt ein Thema im Themenspeicher an und verwendet es für den Beitrag. Hashtag-Sets und der Transfer-Dialog werden nicht geprüft.

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
