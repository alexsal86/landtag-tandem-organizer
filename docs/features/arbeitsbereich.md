# Meine Arbeit & Benachrichtigungen

_Auto-generiert mit `npm run update:feature-catalog` aus dem zentralen Funktionskatalog (`src/features/feature-catalog/inventory/arbeitsbereich.json`). Nicht von Hand bearbeiten._

**Zweck:** Tagesarbeitsfläche, Schnellzugriffe, Benachrichtigungen, globale Suche und Schnellnotizen als gemeinsamer Einstieg in alle Fachbereiche.

## Kennzahlen

- Funktionen: **13** in **7** Unterbereichen
- implementiert: **12**, teilweise: **1**, deaktiviert: **0**, potenziell verwaist: **0**
- ohne zugeordneten Test: **8**
- ohne Dokumentationsverweis: **8**

## Funktionen

| Funktion | Unterbereich | Kategorie | Implementierung | Einbindung | Abdeckung |
|---|---|---|---|---|---|
| `notifications.inbox` Benachrichtigungen lesen und als gelesen markieren | Benachrichtigungen | fachlich | implementiert | UI | kein Test |
| `notifications.preferences` Benachrichtigungseinstellungen und Stummschaltung | Benachrichtigungen | fachlich | implementiert | UI | kein Test |
| `mywork.tabs` Meine Arbeit – Bereichsnavigation und Einstellungen | Meine Arbeit | fachlich | implementiert | UI | kein Test |
| `mywork.dashboard` Meine Arbeit – Dashboard | Meine Arbeit | fachlich | implementiert | rollenabhängig | Selbsttest |
| `mywork.quick-access` Schnellzugriff und zuletzt besuchte Seiten | Meine Arbeit | fachlich | implementiert | UI | kein Test |
| `mobile.app` Mobile App (Expo) | Mobile | fachlich | teilweise | ohne Einbindung | kein Test |
| `profile.edit` Eigenes Profil bearbeiten | Profil | fachlich | implementiert | UI | kein Test |
| `quicknotes.checklists` Checklisten in Schnellnotizen | Schnellnotizen | fachlich | implementiert | UI | Unit-Test |
| `quicknotes.drag-sort` Notizen per Drag-and-drop sortieren | Schnellnotizen | fachlich | implementiert | UI | Unit-Test |
| `quicknotes.offline` Offline-Synchronisation für Schnellnotizen | Schnellnotizen | fachlich | implementiert | UI | Unit-Test |
| `quicknotes.manage` Schnellnotizen anlegen, bearbeiten und verlinken | Schnellnotizen | fachlich | implementiert | UI | Selbsttest |
| `search.global` Globale Suche und Befehlspalette | Suche | fachlich | implementiert | UI | kein Test |
| `platform.auth` Anmeldung und Sitzung | Zugang | sicherheit | implementiert | UI | kein Test |

## Unterbereiche

- Meine Arbeit
- Benachrichtigungen
- Suche
- Schnellnotizen
- Zugang
- Profil
- Mobile

## Rollen

`abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`, `oeffentlich`

## Datenbanktabellen

`dashboard_layouts`, `message_confirmations`, `notification_navigation_mapping`, `notification_types`, `notifications`, `profiles`, `quick_note_global_shares`, `quick_note_shares`, `quick_note_versions`, `quick_note_write_receipts`, `quick_notes`, `search_analytics`, `task_snoozes`, `user_mywork_settings`, `user_navigation_visits`, `user_notification_settings`, `user_planning_preferences`, `user_preferences`, `user_sessions`, `user_tenant_memberships`, `widget_configurations`

## Selbsttest-Szenarien

| Szenario | Titel | deklarierte Tabellen | deklarierte Prüfungen |
|---|---|---:|---:|
| `decision-lifecycle` | Entscheidungs-Lifecycle (active → open → archived) | 3 | 0 |
| `quick-note-lifecycle` | Notizen-Lifecycle (Anlegen → Priorität → Anheften → Aufgabe → Archiv) | 4 | 0 |
| `task-lifecycle` | Aufgaben-Lifecycle (Zuweisung → Frist → Entscheidung → Jour fixe → erledigt) | 2 | 0 |

## Funktionsdetails

### `mywork.dashboard` — Meine Arbeit – Dashboard
Aggregiert Fristen, Termine, Aufgaben, Entscheidungen und Jour-fixe-Hinweise auf einer Arbeitsfläche; Kennzahlen kommen aus get_dashboard_data und get_my_work_counts.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** rollenabhängig
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/mywork`, `/mywork?tab=dashboard`, `/dashboard/*`
- **Frontend-Komponenten:** `src/features/dashboard/components/MyWorkView.tsx`, `src/components/dashboard/DashboardTasksSection.tsx`, `src/components/dashboard/DashboardDecisionsWidget.tsx`, `src/components/dashboard/DashboardJourFixeWidget.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useDashboardData.ts`, `src/hooks/useDashboardDeadlines.ts`, `src/hooks/useDashboardRealtime.ts`, `src/hooks/useCounts.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** `get_dashboard_data`, `get_my_work_counts`, `get_my_work_new_counts`
- **Tabellen:** `dashboard_layouts`, `user_mywork_settings`, `widget_configurations`
- **Abhängigkeiten:** —
- **Selbsttests:** `task-lifecycle`, `decision-lifecycle`
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/my-work-architecture.md`

**Nachweise im Quellcode**

- src/features/dashboard/components/MyWorkView.tsx
- src/features/dashboard/components/BlackBoard.tsx
- src/components/my-work/MyWorkDashboardTab.tsx
- src/hooks/useDashboardData.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Kein Szenario prüft die Dashboard-Aggregation selbst; die Zuordnung stützt sich auf die dort erzeugten Datensätze.

### `mywork.tabs` — Meine Arbeit – Bereichsnavigation und Einstellungen
Schaltet zwischen Dashboard, Aufgaben, Vorgängen, Entscheidungen, Jour fixe, Planungen, Redaktion und Feedback um und speichert die persönliche Bereichsauswahl.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/mywork?tab=tasks`, `/mywork?tab=cases`, `/mywork?tab=decisions`, `/mywork?tab=jourfixe`, `/mywork?tab=plannings`, `/mywork?tab=redaktion`
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** `src/hooks/useMyWorkSettings.tsx`, `src/hooks/useViewPreference.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `user_mywork_settings`, `user_planning_preferences`
- **Abhängigkeiten:** `mywork.dashboard`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/my-work/MyWorkDashboardTab.tsx
- src/components/my-work/MyWorkDecisionsTab.tsx
- src/components/my-work/MyWorkJourFixeTab.tsx
- src/hooks/useMyWorkSettings.tsx

**Bekannte Einschränkungen**

- Die Tab-Auswahl ist eine reine UI-Präferenz und hat keine eigene Geschäftsregel.

**Offene Prüfpunkte**

- Keine.

### `mywork.quick-access` — Schnellzugriff und zuletzt besuchte Seiten
Merkt sich zuletzt besuchte Bereiche und stellt konfigurierbare Schnellzugriffe in der Navigation bereit.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/shared/QuickAccessMenuItem.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useQuickAccessPages.ts`, `src/hooks/useRecentlyVisited.ts`, `src/hooks/useNavCollapse.ts`, `src/hooks/useNavWidth.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `user_navigation_visits`, `user_preferences`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/hooks/useQuickAccessPages.ts
- src/hooks/useRecentlyVisited.ts
- src/components/shared/QuickAccessMenuItem.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `notifications.inbox` — Benachrichtigungen lesen und als gelesen markieren
Zeigt In-App-Benachrichtigungen, ungelesene Zähler und Deep-Links in den auslösenden Fachbereich; Lesen wird pro Nutzer persistiert.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/notifications`
- **Frontend-Komponenten:** `src/pages/NotificationsPage.tsx`, `src/components/notifications/NotificationCenter.tsx`, `src/components/notifications/NotificationBell.tsx`, `src/components/notifications/NotificationDot.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useNotifications.tsx`, `src/hooks/useNavigationNotifications.tsx`, `src/hooks/useNewItemIndicators.tsx`, `src/hooks/useNotificationHighlight.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** `get_unread_notification_counts`, `get_authored_messages`
- **Tabellen:** `notifications`, `notification_types`, `notification_navigation_mapping`, `message_confirmations`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/ci-quality-gates.md`

**Nachweise im Quellcode**

- src/pages/NotificationsPage.tsx
- src/components/notifications/NotificationCenter.tsx
- src/hooks/useNotifications.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Benachrichtigungen entstehen über viele Datenbank-Trigger; die Zuordnung ist bereichsübergreifend und nicht vollständig je Trigger geprüft.

### `notifications.preferences` — Benachrichtigungseinstellungen und Stummschaltung
Steuert Anzeige- und Versandpräferenzen je Benachrichtigungstyp und verwaltet zurückgestellte Fristen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/notifications/NotificationSettings.tsx`, `src/components/notifications/SnoozeManagementSidebar.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useNotificationDisplayPreferences.ts`, `src/hooks/useSnoozeDeadline.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `user_notification_settings`, `task_snoozes`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/notifications/NotificationSettings.tsx
- src/hooks/useNotificationDisplayPreferences.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `search.global` — Globale Suche und Befehlspalette
Durchsucht Kontakte, Aufgaben, Dokumente und weitere Objekte über eine Befehlspalette und protokolliert Suchanfragen für die Auswertung.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/search/GlobalSearchCommand.tsx`, `src/components/search/GlobalQuickNoteDialog.tsx`
- **Services:** `src/components/search/postgrestSearch.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `search_analytics`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/components/search/GlobalSearchCommand.tsx
- src/components/search/postgrestSearch.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Die Suche nutzt PostgREST-Abfragen je Entität; eine vollständige Liste der durchsuchten Tabellen ist nicht zentral deklariert.

### `quicknotes.manage` — Schnellnotizen anlegen, bearbeiten und verlinken
Erfasst Notizen mit Priorität, Anheften, Verknüpfungen zu Entscheidungen und Aufgaben sowie Teilen mit anderen Nutzern.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Selbsttest
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/components/shared/QuickNotesList.tsx`, `src/components/shared/NoteCard.tsx`, `src/components/shared/NoteShareDialog.tsx`, `src/components/shared/NoteDecisionCreator.tsx`
- **Services:** —
- **Hooks:** `src/features/quick-notes/useQuickNoteActions.ts`, `src/features/quick-notes/useQuickNoteEditor.ts`, `src/features/quick-notes/useQuickNoteLinks.ts`, `src/features/quick-notes/useQuickNoteFollowUps.ts`, `src/features/quick-notes/useQuickNotesData.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `save_quick_note`, `delete_quick_note_with_links`, `list_quick_notes`, `quick_note_access`, `create_note_work`, `quick_note_member`, `quick_note_owned`
- **Tabellen:** `quick_notes`, `quick_note_shares`, `quick_note_global_shares`, `quick_note_versions`, `quick_note_write_receipts`
- **Abhängigkeiten:** —
- **Selbsttests:** `quick-note-lifecycle`
- **Unit-Tests:** `src/features/quick-notes/repository.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/quick-notes`

**Nachweise im Quellcode**

- src/features/quick-notes/useQuickNoteActions.ts
- src/features/quick-notes/useQuickNoteEditor.ts
- src/components/shared/QuickNotesList.tsx

**Bekannte Einschränkungen**

- Das Szenario prüft den Lebenszyklus, nicht jede Teilen-Variante.

**Offene Prüfpunkte**

- Keine.

### `quicknotes.offline` — Offline-Synchronisation für Schnellnotizen
Hält Notizen lokal vor, synchronisiert Schreibvorgänge mit Belegquittungen und zeigt den Sync-Status an.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** `src/features/quick-notes/QuickNotesSyncStatus.tsx`
- **Services:** `src/features/quick-notes/storage.ts`, `src/features/quick-notes/repository.ts`, `src/features/quick-notes/api.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `quick_notes`, `quick_note_write_receipts`, `quick_note_versions`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** `src/features/quick-notes/repository.test.ts`, `src/features/quick-notes/tenant-offline.test.tsx`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/quick-notes/storage.ts
- src/features/quick-notes/repository.ts
- src/features/quick-notes/QuickNotesSyncStatus.tsx
- scripts/viteQuickNotesOffline.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Offline-Verhalten ist nur über Unit-Tests belegt; ein echter Browser-Offline-Test existiert nicht.

### `quicknotes.checklists` — Checklisten in Schnellnotizen
Wandelt Notizinhalte in Checklisten um und hält Erledigt-Zustände beim Speichern stabil.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/quick-notes/checklists.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `quick_notes`
- **Abhängigkeiten:** `quicknotes.manage`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/quick-notes/checklists.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/quick-notes/checklists.ts
- src/features/quick-notes/checklists.test.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `quicknotes.drag-sort` — Notizen per Drag-and-drop sortieren
Ordnet angeheftete Notizen per Ziehen neu und persistiert die Reihenfolge.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** Unit-Test
- **Letztes Testergebnis:** unbekannt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** `src/features/quick-notes/noteDrag.ts`
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `quick_notes`
- **Abhängigkeiten:** `quicknotes.manage`
- **Selbsttests:** —
- **Unit-Tests:** `src/features/quick-notes/noteDrag.test.ts`
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/features/quick-notes/noteDrag.ts
- src/features/quick-notes/noteDrag.test.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `platform.auth` — Anmeldung und Sitzung
Meldet Benutzer an, stellt die Sitzung wieder her und leitet auf die geschützte Arbeitsfläche weiter.

- **Kategorie:** sicherheit
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `oeffentlich`, `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/auth`
- **Frontend-Komponenten:** `src/pages/Auth.tsx`, `src/components/layout`
- **Services:** —
- **Hooks:** `src/hooks/useAuth.tsx`, `src/hooks/useTenant.tsx`
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** `profiles`, `user_sessions`, `user_tenant_memberships`
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/ci-quality-gates.md`

**Nachweise im Quellcode**

- src/pages/Auth.tsx
- src/hooks/useAuth.tsx
- src/router/ProtectedRoute.tsx

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Der Login ist in den Browser-Smokes öffentlich geprüft, aber ohne echtes Testkonto nicht erfolgreich durchlaufen.

### `profile.edit` — Eigenes Profil bearbeiten
Ändert Profildaten, Benachrichtigungspräferenzen und persönliche Anzeigeeinstellungen.

- **Kategorie:** fachlich
- **Implementierung:** implementiert
- **Einbindung:** UI
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`, `praktikant`
- **Routen:** `/profile/edit`, `/profile-edit`
- **Frontend-Komponenten:** `src/pages/EditProfile.tsx`
- **Services:** —
- **Hooks:** `src/hooks/useUserPreference.ts`, `src/hooks/useCurrentProfileId.ts`
- **Edge Functions:** —
- **Datenbankfunktionen:** `create_user_status`
- **Tabellen:** `profiles`, `user_preferences`, `user_notification_settings`
- **Abhängigkeiten:** `platform.auth`
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** —

**Nachweise im Quellcode**

- src/pages/EditProfile.tsx
- src/hooks/useUserPreference.ts

**Bekannte Einschränkungen**

- Keine.

**Offene Prüfpunkte**

- Keine.

### `mobile.app` — Mobile App (Expo)
Eigenständige Expo-App im Workspace mit eigener Navigation und Build-Profilen; nutzt dieselbe Supabase-Instanz.

- **Kategorie:** fachlich
- **Implementierung:** teilweise
- **Einbindung:** ohne Einbindung
- **Testabdeckung:** kein Test
- **Letztes Testergebnis:** nicht-ausgefuehrt (nicht aus der Existenz einer Testdatei abgeleitet)
- **Rollen:** `abgeordneter`, `bueroleitung`, `mitarbeiter`
- **Routen:** —
- **Frontend-Komponenten:** —
- **Services:** —
- **Hooks:** —
- **Edge Functions:** —
- **Datenbankfunktionen:** —
- **Tabellen:** —
- **Abhängigkeiten:** —
- **Selbsttests:** —
- **Unit-Tests:** —
- **Integrationstests:** —
- **Browser-Tests:** —
- **Dokumentation:** `docs/mobile`

**Nachweise im Quellcode**

- apps/mobile/package.json
- apps/mobile/app
- apps/mobile/src

**Bekannte Einschränkungen**

- Der Funktionsumfang der Mobile-App wurde nicht zeilenweise inventarisiert; die Web-Plattform ist die Referenz.

**Offene Prüfpunkte**

- Mobile-Bildschirme und -Aktionen sind als eigener Bereich noch nicht im Detail katalogisiert.

## Regeln

Fachliche Invarianten stehen in [AGENTS.md](../../AGENTS.md); Rollen und Rechte in [rollenrechte-matrix.md](../rollenrechte-matrix.md).
