-- Notiz-Benachrichtigungen brauchen ihren Typ auch in bestehenden Büros.
--
-- useQuickNoteFollowUps und notifyQuickNoteShared rufen create_notification mit
-- 'note_follow_up' bzw. 'quick_note_shared' auf. Beide Typen standen bisher nur im
-- alten, mandantenlosen Seed (20260317110000) bzw. gar nicht im Tenant-Seed. Seit
-- notification_types.tenant_id NOT NULL mit Unique (tenant_id, name) ist, liefert
-- create_notification für ein per Wizard angelegtes Büro still NULL – die Meldung
-- ginge verloren und der /notes-Deep-Link liefe ins Leere.
--
-- Diese Migration legt beide Typen für jedes vorhandene Büro an und hängt sie für
-- neue Büros an den Tenant-Trigger. Beides ist idempotent: vorhandene Zeilen bleiben
-- unangetastet (Label, Beschreibung und Aktivierungsstatus werden nicht überschrieben).

-- 1. Bestehende Büros.
INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
SELECT t.id,
       v.name,
       v.label,
       v.description,
       'notes',
       true
FROM public.tenants t
CROSS JOIN (VALUES
  ('note_follow_up', 'Wiedervorlage fällig', 'Eine Notiz hat eine fällige Wiedervorlage.'),
  ('quick_note_shared', 'Notiz geteilt', 'Eine Notiz wurde mit dir geteilt.')
) AS v(name, label, description)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- 2. Neue Büros erhalten beide Typen sofort.
CREATE OR REPLACE FUNCTION public.seed_quick_note_notification_types()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
  VALUES (NEW.id, 'note_follow_up', 'Wiedervorlage fällig', 'Eine Notiz hat eine fällige Wiedervorlage.', 'notes', true),
         (NEW.id, 'quick_note_shared', 'Notiz geteilt', 'Eine Notiz wurde mit dir geteilt.', 'notes', true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_quick_note_notification_types() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS seed_quick_note_notification_types ON public.tenants;
CREATE TRIGGER seed_quick_note_notification_types
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_quick_note_notification_types();
