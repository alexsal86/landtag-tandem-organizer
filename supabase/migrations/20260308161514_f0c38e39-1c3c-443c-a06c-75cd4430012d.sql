INSERT INTO public.notification_types (name, label, description, category, tenant_id)
SELECT 'automation_run_failed', 'Automation fehlgeschlagen', 'Benachrichtigung wenn eine Automations-Regel fehlschlägt', 'system', t.id
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_types nt WHERE nt.name = 'automation_run_failed' AND nt.tenant_id = t.id
);