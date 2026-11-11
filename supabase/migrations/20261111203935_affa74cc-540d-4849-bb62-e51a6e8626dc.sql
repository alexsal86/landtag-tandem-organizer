CREATE OR REPLACE FUNCTION public.topic_name_from_label(p_label text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT regexp_replace(lower(btrim(p_label)), '\s+', '-', 'g')
$$;

CREATE OR REPLACE FUNCTION public._ensure_topic(p_tenant uuid, p_label text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_label text := regexp_replace(btrim(p_label), '\s+', ' ', 'g'); v_order int;
BEGIN
  IF v_label IS NULL OR length(v_label) < 2 OR length(v_label) > 40 THEN
    RAISE EXCEPTION 'Themen müssen 2–40 Zeichen lang sein.' USING ERRCODE='22023';
  END IF;
  SELECT id INTO v_id FROM topics WHERE tenant_id = p_tenant
    AND (lower(label) = lower(v_label) OR name = topic_name_from_label(v_label)) LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT coalesce(max(order_index), -1) + 1 INTO v_order FROM topics WHERE tenant_id = p_tenant;
  INSERT INTO topics(tenant_id, name, label, icon, color, order_index, is_active)
  VALUES (p_tenant, topic_name_from_label(v_label), v_label, 'Tag', '#64748b', v_order, true)
  ON CONFLICT (tenant_id, name) DO UPDATE SET is_active = true
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public._ensure_topic(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_topic(p_tenant uuid, p_label text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT user_belongs_to_tenant(p_tenant) THEN
    RAISE EXCEPTION 'Keine Berechtigung' USING ERRCODE='42501';
  END IF;
  RETURN _ensure_topic(p_tenant, p_label);
END $$;
REVOKE ALL ON FUNCTION public.ensure_topic(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_topic(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.merge_topics(p_source uuid, p_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s topics; t topics; r record; v_cond text;
BEGIN
  SELECT * INTO s FROM topics WHERE id = p_source FOR UPDATE;
  SELECT * INTO t FROM topics WHERE id = p_target FOR UPDATE;
  IF s.id IS NULL OR t.id IS NULL OR s.id = t.id OR s.tenant_id <> t.tenant_id THEN
    RAISE EXCEPTION 'Ungültige Themen' USING ERRCODE='22023';
  END IF;
  IF NOT is_tenant_config_admin(s.tenant_id) THEN
    RAISE EXCEPTION 'Nur Abgeordnete und Büroleitung können Themen zusammenführen.' USING ERRCODE='42501';
  END IF;
  FOR r IN SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'topic_id' AND c.table_name <> 'topics'
  LOOP
    SELECT string_agg(format('x.%1$I IS NOT DISTINCT FROM y.%1$I', column_name), ' AND ') INTO v_cond
      FROM information_schema.columns WHERE table_schema = 'public' AND table_name = r.table_name
      AND column_name NOT IN ('id', 'topic_id', 'created_at', 'updated_at', 'created_by');
    v_cond := coalesce(v_cond, 'true');
    EXECUTE format('DELETE FROM public.%1$I x WHERE x.topic_id = $1 AND EXISTS (SELECT 1 FROM public.%1$I y WHERE y.topic_id = $2 AND %2$s)', r.table_name, v_cond) USING p_source, p_target;
    EXECUTE format('UPDATE public.%I SET topic_id = $2 WHERE topic_id = $1', r.table_name) USING p_source, p_target;
  END LOOP;
  DELETE FROM topics WHERE id = p_source;
END $$;
REVOKE ALL ON FUNCTION public.merge_topics(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_topics(uuid, uuid) TO authenticated;

-- Knowledge tags mirror into platform topics
CREATE OR REPLACE FUNCTION public.knowledge_tag_sync_topic()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF length(btrim(NEW.name)) BETWEEN 2 AND 40 THEN PERFORM _ensure_topic(NEW.tenant_id, NEW.name); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS knowledge_tag_sync_topic ON public.knowledge_tags;
CREATE TRIGGER knowledge_tag_sync_topic AFTER INSERT ON public.knowledge_tags
FOR EACH ROW EXECUTE FUNCTION public.knowledge_tag_sync_topic();

-- Backfill legacy free-text tags
DO $$
DECLARE r record; v_topic uuid;
BEGIN
  FOR r IN SELECT DISTINCT tenant_id, btrim(t) AS tag, id FROM case_files, unnest(tags) t
    WHERE tenant_id IS NOT NULL AND length(btrim(t)) BETWEEN 2 AND 40 LOOP
    v_topic := _ensure_topic(r.tenant_id, r.tag);
    INSERT INTO case_file_topics(case_file_id, topic_id) SELECT r.id, v_topic
      WHERE NOT EXISTS (SELECT 1 FROM case_file_topics WHERE case_file_id = r.id AND topic_id = v_topic);
  END LOOP;
  FOR r IN SELECT DISTINCT tenant_id, btrim(t) AS tag, id FROM contacts, unnest(tags) t
    WHERE tenant_id IS NOT NULL AND length(btrim(t)) BETWEEN 2 AND 40 LOOP
    v_topic := _ensure_topic(r.tenant_id, r.tag);
    INSERT INTO contact_topics(contact_id, topic_id) SELECT r.id, v_topic
      WHERE NOT EXISTS (SELECT 1 FROM contact_topics WHERE contact_id = r.id AND topic_id = v_topic);
  END LOOP;
  FOR r IN SELECT DISTINCT tenant_id, btrim(t) AS tag, id FROM documents, unnest(tags) t
    WHERE tenant_id IS NOT NULL AND length(btrim(t)) BETWEEN 2 AND 40 LOOP
    v_topic := _ensure_topic(r.tenant_id, r.tag);
    INSERT INTO document_topics(document_id, topic_id) SELECT r.id, v_topic
      WHERE NOT EXISTS (SELECT 1 FROM document_topics WHERE document_id = r.id AND topic_id = v_topic);
  END LOOP;
  FOR r IN SELECT tenant_id, name FROM knowledge_tags WHERE length(btrim(name)) BETWEEN 2 AND 40 LOOP
    PERFORM _ensure_topic(r.tenant_id, r.name);
  END LOOP;
END $$;