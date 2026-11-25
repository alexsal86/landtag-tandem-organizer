-- Kontakt anlegen scheiterte mit 42P10 "there is no unique or exclusion constraint
-- matching the ON CONFLICT specification".
--
-- Ursache: sync_contact_tags_to_tags_table() (Trigger sync_contact_tags_trigger,
-- AFTER INSERT OR UPDATE OF tags ON public.contacts) schreibt neue Schlagwörter mit
-- ON CONFLICT (name) in public.tags. Seit der Mandantentrennung
-- (20260308113849_c7b13545) ist tags_name_key entfallen; es gilt
-- uq_tags_tenant_name UNIQUE (tenant_id, name) und tags.tenant_id ist NOT NULL.
-- Für ein noch unbekanntes Schlagwort gab es damit kein passendes
-- Konflikt-Ziel, die Ausnahme rollte den kompletten Kontakt-Insert zurück –
-- deshalb blieb der Schritt "Kontakt mit allen Stammdaten anlegen" dauerhaft rot.
--
-- Härtung: Die Funktionen verlassen sich nicht mehr darauf, dass
-- uq_tags_tenant_name in der Zieldatenbank tatsächlich existiert.
--   1. Ein Guard prüft, ob ein Unique-Index genau über (tenant_id, name) vorhanden
--      ist, und legt ihn andernfalls an (vorher werden exakte Dubletten entfernt,
--      die das Anlegen verhindern würden).
--   2. Die Inserts laufen ohne ON CONFLICT; ein konkurrierender Parallel-Insert
--      wird über EXCEPTION WHEN unique_violation abgefangen. Damit kann derselbe
--      42P10 auch dann nicht wieder auftreten, wenn die März-Migration dort
--      unvollständig angewendet wurde.
--
-- Die Funktionen arbeiten mandantenbezogen: Existenzprüfung, Reihenfolge und
-- Eindeutigkeit nutzen (tenant_id, name). Ohne tenant_id wird nichts geschrieben,
-- statt in eine NOT-NULL-Verletzung zu laufen.

-- ---------------------------------------------------------------------------
-- Guard: Unique-Constraint (tenant_id, name) auf public.tags sicherstellen
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  duplicate_count integer;
  has_unique_index boolean;
BEGIN
  IF to_regclass('public.tags') IS NULL THEN
    RAISE NOTICE 'public.tags fehlt – Guard für uq_tags_tenant_name übersprungen';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.tags'::regclass
      AND attname = 'tenant_id'
      AND NOT attisdropped
  ) THEN
    RAISE NOTICE 'public.tags.tenant_id fehlt – Guard für uq_tags_tenant_name übersprungen';
    RETURN;
  END IF;

  -- Gibt es bereits einen (nicht partiellen, nicht funktionalen) Unique-Index, der
  -- genau die Spalten tenant_id und name abdeckt? Name und Reihenfolge sind egal.
  SELECT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'tags'
      AND i.indisunique
      AND i.indpred IS NULL
      AND i.indexprs IS NULL
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM pg_attribute a
        WHERE a.attrelid = i.indrelid
          AND a.attnum = ANY (i.indkey)
      ) = ARRAY['name', 'tenant_id']
  ) INTO has_unique_index;

  IF has_unique_index THEN
    RAISE NOTICE 'uq_tags_tenant_name vorhanden – nichts zu tun';
    RETURN;
  END IF;

  -- Exakte Dubletten (gleicher Mandant, gleicher Name) würden das Anlegen des
  -- Constraints verhindern. Auf public.tags zeigt kein Fremdschlüssel, deshalb
  -- bleibt die älteste Zeile erhalten und die übrigen werden entfernt.
  WITH ranked AS (
    SELECT id,
           row_number() OVER (
             PARTITION BY tenant_id, name
             ORDER BY order_index, created_at, id
           ) AS rn
    FROM public.tags
    WHERE tenant_id IS NOT NULL
  )
  DELETE FROM public.tags t
  USING ranked r
  WHERE t.id = r.id
    AND r.rn > 1;

  GET DIAGNOSTICS duplicate_count = ROW_COUNT;
  IF duplicate_count > 0 THEN
    RAISE NOTICE 'public.tags: % Dublette(n) entfernt', duplicate_count;
  END IF;

  -- Ein gleichnamiger, aber falsch aufgebauter Constraint wird ersetzt.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tags'::regclass
      AND conname = 'uq_tags_tenant_name'
  ) THEN
    ALTER TABLE public.tags DROP CONSTRAINT uq_tags_tenant_name;
  END IF;

  ALTER TABLE public.tags ADD CONSTRAINT uq_tags_tenant_name UNIQUE (tenant_id, name);
  RAISE NOTICE 'uq_tags_tenant_name (tenant_id, name) neu angelegt';
END $$;

-- ---------------------------------------------------------------------------
-- Trigger-Funktion: Schlagwörter von Kontakten in public.tags spiegeln
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_contact_tags_to_tags_table()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tag_name text;
  next_order_index integer;
  tag_colors text[] := ARRAY['#dc2626', '#ea580c', '#2563eb', '#16a34a', '#7c3aed', '#0891b2', '#f59e0b', '#be185d', '#0d9488', '#7c2d12'];
  color_index integer;
BEGIN
  IF NEW.tenant_id IS NULL OR NEW.tags IS NULL OR array_length(NEW.tags, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH tag_name IN ARRAY NEW.tags
  LOOP
    IF tag_name IS NOT NULL AND btrim(tag_name) <> '' THEN
      -- Nur innerhalb des eigenen Mandanten suchen: gleiche Namen sind dort erlaubt.
      IF NOT EXISTS (
        SELECT 1 FROM public.tags
        WHERE tenant_id = NEW.tenant_id AND lower(name) = lower(btrim(tag_name))
      ) THEN
        SELECT coalesce(max(order_index), -1) + 1 INTO next_order_index
        FROM public.tags WHERE tenant_id = NEW.tenant_id;

        color_index := (abs(hashtext(lower(btrim(tag_name)))) % array_length(tag_colors, 1)) + 1;

        -- Bewusst ohne ON CONFLICT: das würde ein passendes Unique-Ziel verlangen
        -- und bei fehlendem Constraint mit 42P10 den ganzen Kontakt-Insert kippen.
        BEGIN
          INSERT INTO public.tags (
            tenant_id,
            name,
            label,
            color,
            is_active,
            order_index
          ) VALUES (
            NEW.tenant_id,
            lower(btrim(tag_name)),
            btrim(tag_name),
            tag_colors[color_index],
            true,
            next_order_index
          );
        EXCEPTION
          WHEN unique_violation THEN
            -- Parallel angelegtes Schlagwort: es existiert bereits, nichts zu tun.
            NULL;
        END;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Manueller Nachlauf für bestehende Kontakte (gleicher Fehler, gleiche Härtung)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_existing_contact_tags()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  contact_record RECORD;
  tag_name text;
  next_order_index integer;
  tag_colors text[] := ARRAY['#dc2626', '#ea580c', '#2563eb', '#16a34a', '#7c3aed', '#0891b2', '#f59e0b', '#be185d', '#0d9488', '#7c2d12'];
  color_index integer;
BEGIN
  FOR contact_record IN
    SELECT DISTINCT c.tenant_id, btrim(t) AS tag
    FROM public.contacts c, unnest(c.tags) t
    WHERE c.tenant_id IS NOT NULL AND t IS NOT NULL AND btrim(t) <> ''
  LOOP
    tag_name := contact_record.tag;

    IF NOT EXISTS (
      SELECT 1 FROM public.tags
      WHERE tenant_id = contact_record.tenant_id AND lower(name) = lower(tag_name)
    ) THEN
      SELECT coalesce(max(order_index), -1) + 1 INTO next_order_index
      FROM public.tags WHERE tenant_id = contact_record.tenant_id;

      color_index := (abs(hashtext(lower(tag_name))) % array_length(tag_colors, 1)) + 1;

      BEGIN
        INSERT INTO public.tags (
          tenant_id,
          name,
          label,
          color,
          is_active,
          order_index
        ) VALUES (
          contact_record.tenant_id,
          lower(tag_name),
          tag_name,
          tag_colors[color_index],
          true,
          next_order_index
        );
      EXCEPTION
        WHEN unique_violation THEN
          NULL;
      END;
    END IF;
  END LOOP;
END;
$$;
