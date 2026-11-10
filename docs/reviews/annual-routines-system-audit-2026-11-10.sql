-- Read-only verification for the actual office database.
-- Replace __TENANT_UUID__ with the office UUID before execution.
-- No business functions are called. Dry runs do not count as executions.
-- Completion timestamps are markers, not independent proof of correct balances.
WITH scope AS (
  SELECT '__TENANT_UUID__'::uuid AS tenant_id,
    extract(year FROM now() AT TIME ZONE 'Europe/Berlin')::integer AS year
)
SELECT a.id AS routine_id, a.title, scope.year,
  CASE WHEN a.execute_function IS NULL THEN 'Büroaufgabe' ELSE 'Systemaktion' END AS routine_type,
  a.execute_function AS system_function,
  CASE
    WHEN r.id IS NULL AND a.auto_execute THEN 'Alter automatischer Pfad vorgesehen'
    WHEN r.id IS NULL THEN 'Keine verknüpfte Regel; manuell'
    WHEN NOT r.enabled THEN 'Regel deaktiviert'
    WHEN r.trigger_type='manual' THEN 'Manuell'
    WHEN t.automations_paused THEN 'Automatik im Büro pausiert'
    WHEN r.trigger_type='schedule' THEN 'Automatik konfiguriert; Scheduler-Lauf separat prüfen'
    ELSE r.trigger_type
  END AS configured_mode,
  a.due_month, a.due_day, r.trigger_config->>'hour' AS scheduled_hour,
  c.completed_at AS marked_completed_at, c.linked_task_id,
  latest.started_at AS last_real_rule_run_at, latest.status AS last_real_rule_run_status,
  latest.trigger_source AS last_real_rule_run_source,
  CASE
    WHEN c.completed_at IS NOT NULL THEN 'Für dieses Jahr als erledigt markiert'
    WHEN c.linked_task_id IS NOT NULL THEN 'Büroaufgabe angelegt; noch nicht als erledigt markiert'
    WHEN latest.status='failed' THEN 'Letzter Regellauf fehlgeschlagen'
    WHEN latest.status='success' THEN 'Regellauf erfolgreich; Jahresabschlussmarkierung fehlt'
    WHEN latest.started_at IS NOT NULL THEN 'Regellauf vorhanden; Status prüfen'
    ELSE 'Kein Ausführungsnachweis in diesen Tabellen für dieses Jahr'
  END AS evidence
FROM scope
JOIN public.annual_tasks a ON a.tenant_id=scope.tenant_id
JOIN public.tenants t ON t.id=a.tenant_id
LEFT JOIN public.automation_rules r ON r.id=a.automation_rule_id AND r.tenant_id=a.tenant_id
LEFT JOIN public.annual_task_completions c ON c.annual_task_id=a.id AND c.year=scope.year
LEFT JOIN LATERAL (
  SELECT started_at,status,trigger_source
  FROM public.automation_rule_runs ar
  WHERE ar.rule_id=r.id AND ar.tenant_id=a.tenant_id AND NOT ar.dry_run
    AND ar.started_at >= make_timestamptz(scope.year,1,1,0,0,0,'Europe/Berlin')
    AND ar.started_at < make_timestamptz(scope.year+1,1,1,0,0,0,'Europe/Berlin')
  ORDER BY ar.started_at DESC LIMIT 1
) latest ON true
ORDER BY a.due_month,a.due_day NULLS LAST,a.title;
