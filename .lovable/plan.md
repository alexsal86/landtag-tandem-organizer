

## Analyse: Aktuelle Badge- und Benachrichtigungslage

### Zwei parallele Badge-Systeme

Es gibt aktuell **zwei unabhängige Badge-Systeme**, die nicht einheitlich arbeiten:

1. **SubNavigation** (obere Leiste: Aufgaben, Akten, Kalender…) — nutzt `useNavigationNotifications`, zählt **ungelesene Einträge** in der `notifications`-Tabelle nach `navigation_context`
2. **MyWork-Tabs** (interne Tabs: Aufgaben, Vorgänge, Entscheidungen…) — nutzt `useMyWorkNewCounts`, ruft den RPC `get_my_work_new_counts` auf, der Items-`created_at` mit `user_navigation_visits.last_visited_at` vergleicht

**Problem:** Die SubNavigation-Badges basieren auf Notification-Einträgen, die MyWork-Tab-Badges auf einem Zeitstempel-Vergleich. Beide können unterschiedliche Zahlen zeigen.

### Fehlende Benachrichtigungstypen für Vorgänge

In der `notification_types`-Tabelle existkeine Einträge** für Vorgänge (case_items). Es gibt Kategorien für `tasks`, `decisions`, `documents`, `meetings`, `planning` — aber **nichts für `cases`**.

---

## Plan

### 1. Neue Notification-Types für Vorgänge anlegen (DB-Migration)

Neue Einträge in `notification_types` mit Kategorie `cases`:

| name | label | description |
|------|-------|-------------|
| `case_item_created` | Neuer Vorgang | Benachrichtigung wenn ein neuer Vorgang erstellt wird |
| `case_item_assigned` | Vorgang zugewiesen | Benachrichtigung wenn Ihnen ein Vorgang zugewiesen wird |
| `case_item_status_changed` | Vorgang-Status geändert | Benachrichtigung bei Statusänderung eines Vorgangs |
| `case_item_comment` | Vorgang-Kommentar | Benachrichtigung bei neuem Kommentar in einem Vorgang |

Zusätzlich `navigation_context` auf `mywork` setzen, damit die SubNavigation-Badges korrekt zählen.

### 2. Benachrichtigungen in den Einstellungen sichtbar machen

Die Benachrichtigungseinstellungen (`NotificationsPage` / `SettingsView`) gruppieren nach `category`. Die neue Kategorie `cases` mit Label "Vorgänge" muss im UI-Mapping ergänzt werden, damit sie in den Einstellungen erscheint.

### 3. Badge-System vereinheitlichen

Die SubNavigation-Badges für die Gruppe "Meine Arbeit" sollen konsistent mit den MyWork-Tab-Badges sein. Aktuell nutzt die SubNavigation `useNavigationNotifications` (zählt `notifications`-Tabelle), während MyWork intern `useMyWorkNewCounts` nutzt (Zeitstempel-Vergleich).

**Ansatz:** Die SubNavigation zeigt für den "Meine Arbeit"-Bereich die Summe der `newCounts` aus `useMyWorkNewCounts` an, statt den `notifications`-Tabellen-Count. Da "Meine Arbeit" keine SubNavigation-Items hat (es ist eine `route`, keine Gruppe mit `subItems`), betrifft das primär die **Hauptnavigation-Badge** links. Die internen MyWork-Tab-Badges bleiben wie sie sind.

### 4. Benachrichtigungen bei Vorgang-Aktionen auslösen

An den relevanten Stellen im Code `create_notification` RPC-Aufrufe einfügen:
- **Vorgang erstellt** → Benachrichtigung an zugewiesene Personen
- **Vorgang zugewiesen** → Benachrichtigung an neue Zugewiesene
- **Vorgang-Status geändert** → Benachrichtigung an Ersteller/Zugewiesene
- **Vorgang-Kommentar** → Benachrichtigung an Beteiligte

Dateien betroffen:
- `src/features/cases/items/` — Erstellungs-, Status- und Kommentar-Logik
- `src/components/my-work/MyWorkCasesWorkspace.tsx` — falls dort Aktionen ausgelöst werden

### 5. Dateien-Übersicht

- **DB-Migration**: Neue `notification_types`-Einträge für Kategorie `cases`
- **`src/pages/NotificationsPage.tsx`** oder Benachrichtigungseinstellungen: Kategorie-Mapping um `cases` → "Vorgänge" erweitern
- **`src/features/cases/items/`**: `create_notification`-Aufrufe bei Erstellung, Zuweisung, Statusänderung, Kommentaren
- **`src/components/layout/SubNavigation.tsx`**: Badge-Logik vereinheitlichen (optional, da MyWork keine subItems hat)

