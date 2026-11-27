-- Redaktion: Änderungswunsch braucht seinen Benachrichtigungstyp auch in bestehenden Büros.
--
-- request_social_post_changes (20261124200000) ruft create_notification mit
-- 'social_post_change_requested' auf. Der Typ stand bisher nur in
-- supabase/functions/_shared/tenant-seed.ts, also ausschließlich für Büros, die nach
-- diesem Stand angelegt wurden. In bestehenden Büros fehlte die Zeile, und
-- create_notification bricht bei unbekanntem Typ mit „Invalid notification type“ ab –
-- der Änderungswunsch scheiterte damit vollständig, obwohl Kommentar und Aufgabe
-- eigentlich vorgesehen sind.
--
-- Diese Migration legt den Typ für jedes vorhandene Büro an und hängt ihn für neue Büros
-- an den Tenant-Trigger. Beides ist idempotent: vorhandene Zeilen bleiben unangetastet
-- (Label, Beschreibung und Aktivierungsstatus werden nicht überschrieben).

-- 1. Bestehende Büros.
INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
SELECT t.id,
       'social_post_change_requested',
       'Social Post – Änderung gewünscht',
       'Ein Redaktionsbeitrag wurde zur Überarbeitung zurückgegeben; die Änderung ist umzusetzen.',
       'editorial',
       true
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

-- 2. Neue Büros erhalten den Typ sofort.
CREATE OR REPLACE FUNCTION public.seed_social_change_request_notification_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
  VALUES (NEW.id,
          'social_post_change_requested',
          'Social Post – Änderung gewünscht',
          'Ein Redaktionsbeitrag wurde zur Überarbeitung zurückgegeben; die Änderung ist umzusetzen.',
          'editorial',
          true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_social_change_request_notification_type() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS seed_social_change_request_notification_type ON public.tenants;
CREATE TRIGGER seed_social_change_request_notification_type
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_social_change_request_notification_type();
