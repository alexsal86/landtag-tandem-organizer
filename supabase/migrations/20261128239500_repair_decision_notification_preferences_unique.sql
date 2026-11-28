-- Stellt den für ON CONFLICT (user_id, tenant_id) nötigen Unique-Index auf
-- decision_notification_preferences her. Die Tabelle kann in bestehenden
-- Datenbanken ohne Primary Key angelegt worden sein; doppelte Zeilen werden
-- zugunsten der zuletzt aktualisierten Zeile bereinigt.

DELETE FROM public.decision_notification_preferences a
USING public.decision_notification_preferences b
WHERE a.user_id = b.user_id
  AND a.tenant_id = b.tenant_id
  AND a.updated_at < b.updated_at;

DELETE FROM public.decision_notification_preferences a
USING public.decision_notification_preferences b
WHERE a.user_id = b.user_id
  AND a.tenant_id = b.tenant_id
  AND a.updated_at = b.updated_at
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS ux_decision_notification_preferences_user_tenant
  ON public.decision_notification_preferences (user_id, tenant_id);
