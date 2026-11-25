-- Kernstatus der Aufgaben: technische Schlüssel stabil halten.
--
-- Der Selbsttest legte eine Aufgabe mit status 'todo' an und scheiterte an
-- `enforce_task_status` (22023 "Unbekannter Aufgabenstatus: todo"), weil
-- `task_statuses` den Wert nicht mehr führte. Die Registry verlor ihn, weil
-- technischer Name und Anzeigename gekoppelt waren:
--   * `rename_config_item` leitet den neuen Namen aus der Bezeichnung ab
--     (`config_item_name`); ein Umbenennen von "To-Do" schreibt damit 'to_do'
--     oder 'offen' und zieht alle Aufgaben mit.
--   * Der Client schrieb beim Speichern einer Konfigurationszeile `name` neu,
--     auch wenn sich nur Farbe oder Icon änderten.
-- Danach fehlten Werte, die Spalten-Default, Client und Datenbankfunktionen
-- fest schreiben, und der Trigger machte das zu einem harten Fehler.
--
-- Diese Migration
--   1. stellt fehlende Kernstatus in der Registry wieder her,
--   2. lässt bei Kernstatus nur noch den Anzeigenamen ändern; alle anderen
--      Einträge behalten das bisherige Umbenennen samt Verweis-Nachzug,
--   3. weist direktes Umbenennen und Löschen der Kernstatus ab.
-- Die Kernstatus sind technische Schlüssel, keine Anzeigetexte; der
-- Anzeigename bleibt frei änderbar.

CREATE OR REPLACE FUNCTION public.core_task_status_keys()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = 'public' AS $$
  SELECT ARRAY['todo', 'in_progress', 'completed', 'cancelled', 'review']::text[]
$$;

COMMENT ON FUNCTION public.core_task_status_keys() IS
  'Statuswerte, die Spalten-Default, Client und Datenbankfunktionen direkt schreiben; ihre technischen Namen bleiben stabil.';

REVOKE ALL ON FUNCTION public.core_task_status_keys() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.core_task_status_keys() TO authenticated;

-- 1) Fehlende Kernstatus wiederherstellen. Vorhandene Zeilen bleiben
--    unangetastet, auch wenn ihr Anzeigename inzwischen anders lautet.
WITH missing AS (
  SELECT v.name,
         v.label,
         coalesce((SELECT max(s.order_index) FROM public.task_statuses AS s), 0)
           + row_number() OVER (ORDER BY v.position) AS order_index
  FROM (VALUES
    ('todo', 'To-Do', 1),
    ('in_progress', 'In Bearbeitung', 2),
    ('completed', 'Erledigt', 3),
    ('cancelled', 'Abgebrochen', 4),
    ('review', 'Zur Überprüfung', 5)
  ) AS v(name, label, position)
  WHERE NOT EXISTS (SELECT 1 FROM public.task_statuses AS s WHERE s.name = v.name)
)
INSERT INTO public.task_statuses (name, label, order_index)
SELECT name, label, order_index::integer FROM missing;

-- 2) Direktes Umbenennen oder Löschen eines Kernstatus abweisen. Der
--    Anzeigename (label), die Sortierung und is_active bleiben änderbar.
CREATE OR REPLACE FUNCTION public.guard_core_task_status_keys() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.name = ANY (public.core_task_status_keys()) THEN
      RAISE EXCEPTION 'Der Status "%" wird von der Anwendung geschrieben und kann nicht gelöscht werden; nur der Anzeigename ist änderbar', OLD.name
        USING ERRCODE = '22023';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.name = ANY (public.core_task_status_keys()) AND NEW.name IS DISTINCT FROM OLD.name THEN
    RAISE EXCEPTION 'Der technische Statusname "%" wird von der Anwendung geschrieben und kann nicht umbenannt werden; nur der Anzeigename ist änderbar', OLD.name
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.guard_core_task_status_keys() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_core_task_status_rename ON public.task_statuses;
CREATE TRIGGER guard_core_task_status_rename
BEFORE UPDATE OF name ON public.task_statuses
FOR EACH ROW EXECUTE FUNCTION public.guard_core_task_status_keys();

DROP TRIGGER IF EXISTS guard_core_task_status_delete ON public.task_statuses;
CREATE TRIGGER guard_core_task_status_delete
BEFORE DELETE ON public.task_statuses
FOR EACH ROW EXECUTE FUNCTION public.guard_core_task_status_keys();

-- 3) Umbenennen über die Oberfläche: bei Kernstatus ändert sich nur die
--    Bezeichnung, nicht der technische Schlüssel. Für alle anderen Einträge
--    bleibt das bisherige Verhalten (Name aus Bezeichnung, Verweise ziehen mit)
--    unverändert; die bestehende Funktion wird dafür nur umbenannt.
ALTER FUNCTION public.rename_config_item(text, uuid, text, text, text, boolean, boolean)
  RENAME TO rename_config_item_unprotected;

REVOKE ALL ON FUNCTION public.rename_config_item_unprotected(text, uuid, text, text, text, boolean, boolean)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rename_config_item(
  _table text,
  _id uuid,
  _label text,
  _color text DEFAULT NULL,
  _icon text DEFAULT NULL,
  _set_color boolean DEFAULT false,
  _set_icon boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  old_name text;
  new_label text := btrim(_label);
  label_hit integer;
BEGIN
  IF _table = 'task_statuses' AND _id IS NOT NULL AND new_label <> '' THEN
    SELECT s.name INTO old_name
    FROM public.task_statuses AS s
    WHERE s.id = _id;

    IF old_name IS NOT NULL AND old_name = ANY (public.core_task_status_keys()) THEN
      IF auth.uid() IS NULL OR NOT public.is_superadmin(auth.uid()) THEN
        RAISE EXCEPTION 'Plattformweite Konfiguration erfordert Plattformrechte' USING ERRCODE = '42501';
      END IF;

      SELECT count(*) INTO label_hit
      FROM public.task_statuses AS other
      WHERE other.id <> _id
        AND (other.name = new_label OR other.label = new_label);
      IF label_hit > 0 THEN
        RAISE EXCEPTION 'Ein anderer Eintrag verwendet diese Bezeichnung bereits' USING ERRCODE = '23505';
      END IF;

      -- task_statuses hat weder color noch icon; der Statuswert bleibt gleich,
      -- deshalb sind keine Verweise nachzuziehen.
      UPDATE public.task_statuses AS s SET label = new_label WHERE s.id = _id;

      RETURN jsonb_build_object(
        'table', _table,
        'id', _id,
        'old_name', old_name,
        'new_name', old_name,
        'label', new_label,
        'total', 0,
        'updated', '[]'::jsonb);
    END IF;
  END IF;

  RETURN public.rename_config_item_unprotected(_table, _id, _label, _color, _icon, _set_color, _set_icon);
END $$;

REVOKE ALL ON FUNCTION public.rename_config_item(text, uuid, text, text, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_config_item(text, uuid, text, text, text, boolean, boolean) TO authenticated;
