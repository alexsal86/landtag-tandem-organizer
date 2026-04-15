

## Plan: Alle verbleibenden `select('*')` durch explizite Spaltenauswahl ersetzen

### Umfang

17 Dateien enthalten insgesamt ~30 `select('*')`-Aufrufe bei **Lese-Abfragen** (nicht nach Mutations). Jede wird durch eine explizite Spaltenliste ersetzt, basierend auf den tatsächlich verwendeten Feldern im Code.

### Dateien und Änderungen

**1. `src/components/ContactDetailPanel.tsx`** (1 Stelle)
- `call_logs.select('*')` → explizite Spalten: `id, call_date, call_type, caller_name, caller_phone, contact_id, duration_minutes, notes, priority, follow_up_required, follow_up_date, follow_up_completed, completion_notes, created_by_name, user_id`

**2. `src/components/task-detail/useTaskDetailData.ts`** (5 Stellen)
- Subtasks: `tasks.select('*')` → `id, title, description, status, assigned_to, due_date, parent_task_id, created_at, updated_at, user_id, progress`
- Task-Dokumente: `task_documents.select('*')` → `id, task_id, file_name, file_path, file_size, file_type, created_at`
- Task-Kommentare: `task_comments.select('*')` → `id, task_id, user_id, content, created_at, updated_at`
- 2x Refresh nach Save: `tasks.select('*')` → `id, title` (nur zur Verifikation genutzt)

**3. `src/components/tasks/hooks/useTaskOperations.ts`** (1 Stelle)
- Refresh nach Statuswechsel: `tasks.select('*')` → `id, title, description, status, priority, category, assigned_to, due_date, progress, updated_at, user_id, tenant_id`

**4. `src/components/event-planning/hooks/useChecklistOperations.ts`** (2 Stellen)
- Refresh nach Netzwerkfehler: `event_planning_checklist_items.select('*')` → `id, event_planning_id, title, is_completed, order_index, sub_items, assigned_to, due_date, category, notes, is_system_item, system_type, created_at`

**5. `src/hooks/useQuickNotes.ts`** (1 Stelle)
- Versionshistorie: `quick_note_versions.select('*')` → `id, note_id, title, content, created_at, created_by`

**6. `src/components/meetings/hooks/useMeetingSidebarData.ts`** (1 Stelle)
- Quick Notes für Meeting: `quick_notes.select('*')` → `id, title, content, user_id, meeting_id, created_at, updated_at, is_pinned, color, color_full_card, category, tags, priority_level, follow_up_date, is_archived, decision_id, task_id, case_item_id, meeting_result, pending_for_jour_fixe`

**7. `src/hooks/usePartyAssociations.tsx`** (2 Stellen)
- `party_associations.select('*')` → `id, name, party_name, party_type, email, phone, website, address_street, address_number, address_postal_code, address_city, full_address, administrative_boundaries, coverage_areas, social_media, contact_info, tenant_id`
- `election_districts.select('*')` → `id, district_name, district_type, region, geometry`

**8. `src/components/PartyAssociationsAdmin.tsx`** (1 Stelle)
- `party_associations.select('*')` → gleiche Spalten wie oben

**9. `src/hooks/useMapLayers.ts`** (1 Stelle)
- `map_layers.select('*')` → `id, tenant_id, layer_name, group_name, source_type, source_url, geojson_file, style_config, is_active, sort_order, created_at`

**10. `src/hooks/useCaseFileProcessingStatuses.tsx`** (1 Stelle)
- `case_file_processing_statuses.select('*')` → `id, name, label, icon, color, order_index, is_active`

**11. `src/components/administration/RSSSettingsManager.tsx`** (1 Stelle)
- `rss_settings.select('*')` → `id, tenant_id, feed_url, is_active, auto_publish, default_category, default_tags, fetch_interval_minutes`

**12. `src/components/employees/EmployeeAdminTable.tsx`** (1 Stelle)
- `employee_settings_history.select('*')` → `id, user_id, valid_from, valid_to, weekly_hours, work_days_per_week, created_at`

**13. `src/components/widgets/PomodoroWidget.tsx`** (1 Stelle)
- `pomodoro_sessions.select('*')` → `id, user_id, session_type, duration_minutes, is_completed, started_at, ended_at, task_id`

**14. `src/components/press/hooks/usePressReleaseEditor.ts`** (1 Stelle)
- `press_releases.select('*')` → `id, title, content, content_html, content_nodes, slug, excerpt, feature_image_url, status, tags, category, author_id, tenant_id, created_at, updated_at, published_at, ghost_id`

**15. `src/features/redaktion/hooks/usePlannerNotes.ts`** (1 Stelle)
- `social_planner_notes.select('*')` → `id, tenant_id, date, content, platform, status, created_by, created_at, updated_at`

**16. `src/features/dossiers/hooks/useDossierLinks.ts`** (1 Stelle)
- `dossier_links.select('*')` → `id, dossier_id, linked_type, linked_id, created_at`

**17. `src/features/cases/files/hooks/useCaseFileDetails.tsx`** (1 Stelle)
- `case_item_interactions.select('*')` → `id, case_file_id, interaction_type, subject, content, contact_name, contact_email, direction, created_by, created_at`

**18. `src/features/dossiers/hooks/useDossierSourceWatchers.ts`** (1 Stelle)
- `dossier_source_watchers.select('*')` → `id, dossier_id, source_name, source_url, source_type, keywords, last_synced_at, created_at`

### Edge Functions (Supabase)
- `supabase/functions/send-checklist-email/index.ts`: `event_planning_item_actions.select('*')` → nur benötigte Spalten

### Nicht geändert
- `select()` nach `.insert()`, `.update()`, `.delete()` -- diese geben nur die betroffene Zeile zurück und sind korrekt

### Erwartete Wirkung
- Reduziert Payload-Größe pro Abfrage um 20-60% je nach Tabelle (besonders bei `quick_notes` mit 28 Spalten, `tasks` mit 20 Spalten, `press_releases` mit großen JSON-Feldern)
- Keine funktionalen Änderungen

