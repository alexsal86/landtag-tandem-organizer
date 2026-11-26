-- Der Workflow-Dispatcher benachrichtigt über create_notification: notifications
-- verlangt notification_type_id, und die Funktion löst Typ und Mandant selbst auf
-- und prüft die Mitgliedschaft. Fehlt der Typ, verwirft sie die Meldung still.
-- Bisher gab es 'workflow' in notification_types nicht – jeder Workflow-Hinweis
-- ging deshalb verloren.
--
-- Reine Datenmigration, kein Schemawechsel: is_active steuert weiterhin, ob der
-- Typ Meldungen erzeugt.

-- 1) Benachrichtigungstyp für bestehende Büros.
INSERT INTO public.notification_types (tenant_id, name, label, description, is_active)
SELECT t.id,
       'workflow',
       'Workflow',
       'Hinweis aus einer Automatisierung',
       true
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

-- 2) Neue Büros erhalten den Typ sofort.
CREATE OR REPLACE FUNCTION public.seed_workflow_notification_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, is_active)
  VALUES (NEW.id,
          'workflow',
          'Workflow',
          'Hinweis aus einer Automatisierung',
          true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_workflow_notification_type ON public.tenants;
CREATE TRIGGER seed_workflow_notification_type
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_workflow_notification_type();

REVOKE ALL ON FUNCTION public.seed_workflow_notification_type() FROM PUBLIC, anon, authenticated;
