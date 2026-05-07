## Phase 6 — Performance, Workflows & Permissions

Drei parallele Tracks, jeder unabhängig committable. Reihenfolge: **A → B → C** (A liefert Mess-Baseline, B/C bauen darauf auf).

---

### Track A — Performance & Egress 2.0

**Ziel:** Egress weiter −30 %, Time-to-Interactive auf Hot-Paths < 1.5s, Realtime-Last halbieren.

1. **Audit-Erweiterung** (`scripts/audit-queries.ts`)
   - Neue Regeln: `count: 'exact'` ohne `head:true`, fehlende `.range()` bei Listen > 100, `useEffect` mit `supabase`-Call ohne Cleanup.
   - Output als CI-Artefakt (`docs/performance-audit-YYYY-MM.md` automatisch).

2. **Hot-Path-Refactor** (Top-15 aus aktuellem Audit):
   - `useGlobalNoteSharing`, `useNoteSharing`, `useAppointmentPreparation`, `useAppointmentFeedback`, `useDistrictNotes`, `useElectionDistricts`, `useContactBriefingMemory`, `EmailHistory`, `useEmailComposer`, `NotificationSettings`, `useExpenseData`, `useEventPlanningData`, `TodaySchedule`, `AnnualTasksView`, `MeetingTemplateManager`.
   - Pro Datei: explizite Spaltenlisten, `STALE_TIME`-Konstanten aus `src/lib/query-cache.ts`, `.range()` für Pagination.

3. **TanStack Virtual** in 4 Listen mit > 200 Zeilen:
   - Vorgänge-Liste, Kontakte-Liste, Dokumente-Liste, MyWork-Tasks.

4. **Realtime-Hook-Migration** (`useTenantRealtime`):
   - Falls noch nicht in Phase 4a abgeschlossen: 7 Channel-Subscriptions migrieren.
   - Tenant-Filter zwingend, `debounceMs: 250`.

5. **Edge-Function-Caching** (Postgres-KV-Pattern):
   - Neue Tabelle `edge_function_cache(key, value, expires_at)` + Helper `_shared/cache.ts`.
   - Anwenden auf: `collect-egress-metrics` (Vortag), `import-administrative-boundaries` (Geo-Daten 24h), Wetter-Proxy.

6. **Bundle-Splitting**:
   - Lexical-Plugins, Letter-Designer, Map-Layer (Leaflet), Recharts in eigene Lazy-Chunks.
   - `scripts/report-bundle-size.mjs` als CI-Gate (Regression > 5 % schlägt fehl).

**Erfolg:** `egress_metrics` −30 % über 7 Tage, Bundle-Initial < 350 kB gz, Cockpit zeigt 0 fehlende Realtime-Filter.

---

### Track B — Workflow Automation v2

**Ziel:** Visuelle Workflows ohne Code, mehr Trigger-Typen, Conditional Branches.

1. **Trigger-Erweiterung** (`workflow_definitions.trigger_type`):
   - Neu: `schedule_cron` (z. B. „jeden Mo 8:00"), `webhook_inbound`, `email_received` (via send-news Posteingang), `entity_field_changed` (z. B. `task.priority` → 'urgent').
   - DB-Migration: Trigger-Konfig als JSONB, Worker-Dispatcher (`workflow-dispatcher`) erweitern.

2. **Conditional Branches & Loops**:
   - Neue Step-Typen `branch` (if/else mit JSONLogic-Expression) und `for_each` (über Array-Output vorheriger Step).
   - Schema-Update in `docs/automation/workflow-definition.schema.json` + Runtime-Tests.

3. **Visueller Builder** (neue Route `/workflows/:id/builder`):
   - React-Flow-basiertes Canvas, Drag-and-Drop von Trigger/Action/Branch-Knoten.
   - Live-Validierung gegen JSON-Schema, Test-Run-Button mit Sample-Payload.
   - Read-only-Diagramm in Detail-View.

4. **Action-Bibliothek erweitern**:
   - `create_decision`, `assign_task_to_role` (statt user), `send_matrix_message`, `update_case_status`, `notify_via_push`, `call_edge_function` (whitelisted).

5. **Audit-Trail UI**:
   - Bestehender `workflow_runs`-Trail bekommt eine eigene Detail-View mit Step-by-Step-Log, Re-Run-Button (mit gleichem Payload), Error-Inspect.

**Erfolg:** Bürokraft kann ohne Entwickler einen 3-Step-Workflow mit Branch bauen und ihn live laufen sehen.

---

### Track C — Granular Permissions

**Ziel:** Tenant-Admin kann Module/Felder/Aktionen pro Rolle freischalten oder sperren.

1. **Feature-Flag-Tabelle** `tenant_feature_flags(tenant_id, feature_key, enabled, config jsonb)`:
   - Keys: `module.events`, `module.letters`, `module.knowledge`, `module.editorial`, `module.timetracking`, …
   - RLS: nur `bueroleitung`/`abgeordneter` schreiben, alle lesen.
   - Hook `useFeatureFlag(key)` → Boolean, gated Menüpunkte in Sidebar verstecken.

2. **Field-Level-Permissions** für sensible Tabellen (`contacts`, `cases`, `letters`):
   - Tabelle `field_permissions(tenant_id, table_name, column_name, role, can_read, can_write)`.
   - Server-seitig: View-Wrapper bzw. RLS-Policy + Edge-Function-Filter (Mask = NULL bei `can_read=false`).
   - Frontend: `useFieldPermission(table, column)` → maskiert Felder mit „—" oder versteckt sie.

3. **Action-Level-Permissions** (z. B. „nur Bürochef darf Briefe versenden"):
   - Tabelle `action_permissions(tenant_id, action_key, allowed_roles)`.
   - Action-Keys: `letter.send`, `letter.delete`, `decision.archive`, `case.close`, `workflow.execute_manual`, …
   - Hook `useActionPermission(key)` blendet Buttons aus + Server-Guard in Edge Functions / RPCs.

4. **Admin-UI** unter `/administration/permissions`:
   - Tab 1: Feature-Flags (Toggle-Liste pro Modul).
   - Tab 2: Field-Permissions (Matrix Tabelle × Spalte × Rolle).
   - Tab 3: Action-Permissions (Liste mit Multi-Select Rollen).
   - Audit-Log jeder Änderung.

5. **Migration der Default-Permissions** (Idempotente Seed-Migration):
   - Heutige hartkodierte Role-Checks in `src/router/ProtectedRoute.tsx`, `MyWork`, `Sidebar` als Default-Rows einsetzen → Verhalten bleibt identisch, ist aber jetzt konfigurierbar.

**Erfolg:** Tenant-Admin kann ohne Code-Deploy einer Rolle ein Modul wegnehmen oder ein Feld maskieren; Edge Functions erzwingen die Regel auch bei direktem API-Zugriff.

---

### Aufwand & Reihenfolge

| Track | Sessions | Risiko | Liefert |
|-------|----------|--------|---------|
| A Performance | 3–4 | niedrig | Sofortige Kosten-/Tempo-Wirkung, Bundle-Gate |
| B Workflows | 4–5 | mittel | Self-Service-Automation, weniger Dev-Tickets |
| C Permissions | 4–6 | mittel-hoch (RLS!) | Multi-Tenant-Reife, DSGVO-Argument |

**Empfehlung:** Track A zuerst (Mess-Baseline + Quick Wins), dann B und C parallel in eigenen Branches.

---

### Out of Scope

- Externer Workflow-Marktplatz / Templates-Sharing zwischen Tenants.
- Komplette Re-Architektur der Rollenrechte-Matrix (`docs/rollenrechte-matrix.md`) — nur Erweiterung, keine Umbenennung bestehender Rollen.
- Performance-Optimierung der Mobile-App (`apps/mobile/`) — separater Track.

---

**Frage:** Soll ich mit **Track A** starten, oder willst du eine andere Reihenfolge (z. B. C zuerst wegen DSGVO-Audit)?
