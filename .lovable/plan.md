

## Analyse: localStorage-Nutzung im Projekt

Das Projekt nutzt `localStorage` an **37 Stellen** für verschiedene Zwecke. Diese lassen sich in drei Kategorien einteilen:

### Kategorie 1: Sollte in localStorage bleiben
- **Matrix-SDK Credentials** (Device-IDs, Recovery-Keys) — technisch notwendig, gehört nicht in die App-DB
- **Cross-Tab-Sync Events** (`navigation_visit_sync`, `notifications_marked_read`) — kurzlebige Signale zwischen Tabs
- **Feature Flags** — Entwicklungs-Tool, bewusst lokal
- **Auth/Tenant-IDs** (`currentTenantId`) — Session-Kontext

### Kategorie 2: Kandidaten für Datenbank-Migration (User-Preferences)
Diese Daten sind benutzerspezifisch und gehen verloren bei Gerätewechsel oder Browser-Reset:
- **View-Preferences**: `contacts-view-mode`, `stakeholders-view-mode`, `distribution-view-mode`, `eventPlanningView`, `appointmentPreparationView`, `mywork-tasks-status-filter`, `mywork-decisions-active-tab`
- **Widget-Settings**: `quicknotes_showTasks_*`, `quicknotes_settings_*`, Widget-Reihenfolge/Sichtbarkeit
- **Default-Settings**: `default_decision_settings`, `default_decision_participants`
- **UI-Zustände**: `day-slip-panel-open`, Sidebar-Collapsed-States

### Kategorie 3: Kandidaten für Datenbank-Migration (User-Data)
Echte Arbeitsdaten, die bei Verlust problematisch sind:
- **Tageszettel-Store** (`dayslip-store`, `dayslip-recurring`, `dayslip-day-templates`, `dayslip-resolve-export`) — tägliche Arbeitsdokumentation
- **Stempeluhr** (`timetracking_clock_in`, `timetracking_pause_*`) — laufende Zeiterfassung
- **Wochenplanung** (`weekly-plan-*`) — Aufgabenverteilung

---

## Vorgeschlagener Plan

### 1. Neue Tabelle `user_preferences` erstellen
```sql
create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique(user_id, tenant_id, key)
);
-- RLS: Nutzer sieht/schreibt nur eigene Einträge
```

### 2. Hook `useUserPreference<T>(key, defaultValue)` erstellen
- Beim Mount: Wert aus DB laden, bis dahin `defaultValue` verwenden
- Bei Änderung: Optimistisch lokal setzen, dann per `upsert` in DB schreiben (debounced, 500ms)
- localStorage als **Offline-Cache** beibehalten (schnelles Laden, dann DB-Sync)
- Drop-in-Replacement für `usePersistentState`

### 3. Schrittweise Migration der Kategorie-2-Daten
Alle View-Preferences und Widget-Settings auf `useUserPreference` umstellen. Bestehende localStorage-Werte werden beim ersten Load als Fallback gelesen und in die DB migriert.

### 4. Tageszettel-Daten (Kategorie 3) in eigene Tabelle
Der Tageszettel-Store enthält strukturierte Arbeitsdaten — hier wäre eine dedizierte `day_slips`-Tabelle sinnvoller als ein generisches Key-Value-Paar. Das ist aber ein größeres Refactoring und sollte separat geplant werden.

### Nicht migriert
Matrix-Credentials, Cross-Tab-Events und Feature-Flags bleiben in localStorage.

---

**Zusammenfassung**: Eine `user_preferences`-Tabelle mit einem generischen `useUserPreference`-Hook löst das Problem für ~20 Stellen sauber. Die Tageszettel-Daten verdienen eine eigene Tabelle in einem separaten Schritt.

