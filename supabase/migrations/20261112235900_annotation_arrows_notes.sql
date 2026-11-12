-- Arrow endpoints and note anchors use the same page fractions and edit permissions as existing shapes.
CREATE OR REPLACE FUNCTION public.document_annotations_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _doc_tenant uuid; _point jsonb;
BEGIN
  IF NEW.file_kind NOT IN ('pdf','image') THEN RAISE EXCEPTION 'invalid file_kind'; END IF;
  IF NEW.annotation_type NOT IN ('highlight','rect','polygon','arrow','note') THEN RAISE EXCEPTION 'invalid annotation_type'; END IF;
  IF NEW.color NOT IN ('yellow','green','red','blue') THEN RAISE EXCEPTION 'invalid color'; END IF;
  IF length(NEW.content) > 5000 THEN RAISE EXCEPTION 'comment too long'; END IF;
  IF NEW.annotation_type IN ('arrow','note') THEN
    IF jsonb_typeof(NEW.target_selector->'points') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'annotation points must be an array';
    END IF;
    IF jsonb_array_length(NEW.target_selector->'points') <> (CASE WHEN NEW.annotation_type = 'arrow' THEN 2 ELSE 1 END) THEN
      RAISE EXCEPTION 'invalid annotation point count';
    END IF;
    FOR _point IN SELECT value FROM jsonb_array_elements(NEW.target_selector->'points') LOOP
      IF jsonb_typeof(_point->'x') IS DISTINCT FROM 'number' OR jsonb_typeof(_point->'y') IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'annotation coordinates must be numbers';
      END IF;
      IF (_point->>'x')::numeric < 0 OR (_point->>'x')::numeric > 1 OR (_point->>'y')::numeric < 0 OR (_point->>'y')::numeric > 1 THEN
        RAISE EXCEPTION 'annotation coordinates must be fractions';
      END IF;
    END LOOP;
    IF NEW.annotation_type = 'arrow'
      AND (NEW.target_selector->'points'->0->>'x')::numeric = (NEW.target_selector->'points'->1->>'x')::numeric
      AND (NEW.target_selector->'points'->0->>'y')::numeric = (NEW.target_selector->'points'->1->>'y')::numeric THEN
      RAISE EXCEPTION 'arrow endpoints must be distinct';
    END IF;
  END IF;
  SELECT tenant_id INTO _doc_tenant FROM public.documents WHERE id = NEW.document_id;
  IF _doc_tenant IS NULL OR _doc_tenant <> NEW.tenant_id THEN RAISE EXCEPTION 'document tenant mismatch'; END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by; NEW.tenant_id := OLD.tenant_id; NEW.document_id := OLD.document_id; NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.document_annotations_validate() FROM PUBLIC, anon, authenticated;
