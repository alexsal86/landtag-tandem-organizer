

## PostgREST Egress-Analyse und Optimierungsplan

### Identifizierte Hauptursachen

**1. Massiver `select('*')` Einsatz — 83 Dateien betroffen**
In 83 Dateien wird `.select('*')` verwendet, was alle Spalten einer Tabelle zurückgibt, auch wenn nur 2-3 Felder benötigt werden. Bei Tabellen mit JSON-Payloads (z.B. `tasks`, `contacts`, `notifications`) vervielfacht das den Egress pro Anfrage massiv.

**2. Realtime-getriggerte Full-Refreshes — 14+ Hooks betroffen**
Mindestens 14 Hooks nutzen `postgres_changes`-Subscriptions, die bei jeder Änderung einen kompletten Datensatz neu laden (`scheduleRefresh` → `refreshAll`). Beispiele:
- `useCaseWorkspaceData`: Lädt alle case_items + case_files + team_users bei jeder Änderung an `case_items`, `case_files` oder `task_decisions`
- `useMyWorkDecisionsData`: Voller Reload bei jeder decision-Änderung
- `MyWorkTeamTab`: Lauscht auf `time_entries` ohne Tenant-Filter
- `MyWorkPlanningsTab`: Doppelt abonniert (auch `MyWorkPlanungsKartenSection`)

**3. Unfiltered Realtime Subscriptions**
Einige Subscriptions haben keinen `tenant_id`- oder `user_id`-Filter:
- `task_decisions` in `useCaseWorkspaceData` und `useMyWorkDecisionsData`
- `time_entries` und `employee_meeting_requests` in `MyWorkTeamTab`
Das bedeutet: Jede Änderung eines beliebigen Tenants triggert einen Full-Reload.

**4. Doppelte/redundante Abfragen**
- `profiles` wird mindestens 3x parallel beim Seitenaufruf geladen (Dashboard, Navigation, Sidebar)
- `notifications` wird sowohl in `useNotifications` (50 Zeilen mit Joins) als auch in `useNavigationNotifications` (alle ungelesenen) geladen
- `annual_tasks` wird sowohl im Dashboard als auch in `useNavigationNotifications` abgefragt

**5. Fehlende TanStack Query-Migration**
Viele Hooks nutzen noch direktes `useState`/`useEffect` statt TanStack Query, was bedeutet:
- Kein automatisches Caching/Deduplication
- Kein `staleTime` — bei jedem Mount wird neu geladen
- Bei Tab-Wechsel in MyWork wird alles neu geladen

### Optimierungsplan

#### Phase 1: Quick Wins (größter Impact)

**1a. `select('*')` durch selektive Spalten ersetzen**
Die größten Tabellen priorisieren:
- `notifications` — nur `id, navigation_context, is_read` für Counts
- `contacts` — nur die Anzeige-Felder
- `tasks` — nur für Listen benötigte Felder
- `case_items` (bereits selektiv, gut)

Geschätzter Effekt: 40-60% weniger Daten-Transfer pro Anfrage.

**1b. Tenant-Filter auf alle Realtime-Subscriptions**
- `task_decisions` → Filter `tenant_id=eq.${tenantId}` hinzufügen
- `time_entries` → Filter hinzufügen
- `employee_meeting_requests` → Filter hinzufügen

**1c. Notifications-Count als RPC**
Die `useNavigationNotifications`-Abfrage lädt alle ungelesenen Notifications nur um sie zu zählen. Stattdessen eine RPC-Funktion `get_unread_notification_counts` erstellen, die nur `{context: count}` zurückgibt.

#### Phase 2: Caching & Deduplication

**2a. Zentrale Daten in TanStack Query migrieren**
Die wichtigsten Hooks migrieren:
- `useMyWorkDecisionsData`
- `useCaseWorkspaceData` (hat bereits manuelles Caching, aber TanStack wäre besser)
- `useNavigationNotifications`

**2b. Realtime → Incremental Updates**
Statt `scheduleRefresh` (Full-Reload) den Realtime-Payload direkt nutzen:
- Bei `INSERT`: Neues Item zum Cache hinzufügen
- Bei `UPDATE`: Bestehendes Item aktualisieren
- Bei `DELETE`: Item entfernen
- Nur bei komplexen Joins einen Full-Reload durchführen

**2c. Profile-Daten deduplizieren**
Ein zentraler `useProfileData`-Hook mit TanStack Query, der für alle Komponenten cached.

#### Phase 3: Strukturelle Verbesserungen

**3a. Dashboard-Aggregator erweitern**
Die bestehende `get_dashboard_data` RPC um weitere Counts erweitern, statt mehrere parallele Einzelabfragen.

**3b. Lazy Loading für MyWork-Tabs**
Nur den aktiven Tab laden, nicht alle Tabs gleichzeitig. Die `enabled`-Flag an den aktiven Tab koppeln.

### Empfohlene Reihenfolge

Ich empfehle, mit **Phase 1** zu beginnen, da dies den größten Effekt bei geringstem Risiko hat. Die drei Maßnahmen (selektive Spalten, Tenant-Filter, Notification-Count-RPC) können parallel implementiert werden.

### Dateien (Phase 1)

Phase 1a betrifft ca. 20-30 der meistgenutzten Dateien (von 83 mit `select('*')`).
Phase 1b: 3 Dateien (`useCaseWorkspaceData.ts`, `useMyWorkDecisionsData.ts`, `MyWorkTeamTab.tsx`).
Phase 1c: 1 neue Migration + 1 Hook-Anpassung (`useNavigationNotifications.tsx`).

### Frage an dich

Soll ich mit Phase 1 starten? Oder möchtest du zuerst die tatsächlichen Egress-Zahlen aus dem Supabase-Dashboard prüfen, um die größten Verursacher genauer zu identifizieren?

