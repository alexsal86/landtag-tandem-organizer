CREATE OR REPLACE FUNCTION public.sync_tags_to_topics()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tag text; v_topic uuid; v_tbl text; v_col text; v_old text[] := '{}';
BEGIN
  v_tbl := TG_ARGV[0]; v_col := TG_ARGV[1];
  IF NEW.tenant_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN v_old := coalesce(OLD.tags, '{}'); END IF;
  FOREACH v_tag IN ARRAY coalesce(NEW.tags, '{}') LOOP
    IF length(btrim(v_tag)) BETWEEN 2 AND 40 THEN
      v_topic := _ensure_topic(NEW.tenant_id, v_tag);
      EXECUTE format('INSERT INTO public.%1$I(%2$I, topic_id) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM public.%1$I WHERE %2$I = $1 AND topic_id = $2)', v_tbl, v_col)
        USING NEW.id, v_topic;
    END IF;
  END LOOP;
  FOREACH v_tag IN ARRAY v_old LOOP
    IF NOT EXISTS (SELECT 1 FROM unnest(coalesce(NEW.tags, '{}')) n WHERE lower(btrim(n)) = lower(btrim(v_tag))) THEN
      EXECUTE format('DELETE FROM public.%1$I WHERE %2$I = $1 AND topic_id IN (SELECT id FROM topics WHERE tenant_id = $2 AND lower(label) = lower(btrim($3)))', v_tbl, v_col)
        USING NEW.id, NEW.tenant_id, v_tag;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_tags_to_topics() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_tags_to_topics ON public.contacts;
CREATE TRIGGER sync_tags_to_topics AFTER INSERT OR UPDATE OF tags ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.sync_tags_to_topics('contact_topics', 'contact_id');
DROP TRIGGER IF EXISTS sync_tags_to_topics ON public.documents;
CREATE TRIGGER sync_tags_to_topics AFTER INSERT OR UPDATE OF tags ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.sync_tags_to_topics('document_topics', 'document_id');
DROP TRIGGER IF EXISTS sync_tags_to_topics ON public.case_files;
CREATE TRIGGER sync_tags_to_topics AFTER INSERT OR UPDATE OF tags ON public.case_files
FOR EACH ROW EXECUTE FUNCTION public.sync_tags_to_topics('case_file_topics', 'case_file_id');