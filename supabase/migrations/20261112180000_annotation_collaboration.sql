-- Replies are one level deep and cannot cross document or tenant boundaries.
ALTER TABLE public.document_annotations ADD COLUMN parent_id uuid
  REFERENCES public.document_annotations(id) ON DELETE CASCADE;
CREATE INDEX idx_document_annotations_parent ON public.document_annotations(parent_id);

CREATE OR REPLACE FUNCTION public.document_annotation_reply_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
    RAISE EXCEPTION 'annotation parent is immutable';
  END IF;
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.document_annotations p WHERE p.id = NEW.parent_id
      AND p.id <> NEW.id AND p.document_id = NEW.document_id
      AND p.tenant_id = NEW.tenant_id AND p.parent_id IS NULL
  ) THEN RAISE EXCEPTION 'invalid annotation parent'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_annotation_reply_guard BEFORE INSERT OR UPDATE ON public.document_annotations
FOR EACH ROW EXECUTE FUNCTION public.document_annotation_reply_guard();

-- Server-side delivery keeps comments and mention notifications atomic.
CREATE OR REPLACE FUNCTION public.document_annotation_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recipient uuid; old_content text := ''; doc_title text;
BEGIN
  IF TG_OP = 'UPDATE' THEN old_content := OLD.content; END IF;
  IF NEW.content = old_content THEN RETURN NEW; END IF;
  SELECT title INTO doc_title FROM public.documents WHERE id = NEW.document_id;
  FOR recipient IN
    SELECT DISTINCT (m)[1]::uuid FROM regexp_matches(NEW.content,
      '@\[[^]]*\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)', 'g') AS m
  LOOP
    IF recipient <> auth.uid() AND public.is_tenant_member(NEW.tenant_id, recipient)
      AND position('](' || recipient::text || ')' in lower(old_content)) = 0 THEN
      PERFORM public.create_notification(recipient, 'document_mention', 'Erwähnung: ' || doc_title,
        NEW.content, jsonb_build_object('document_id', NEW.document_id, 'annotation_id', NEW.id,
          'document_type', 'annotation', 'tenant_id', NEW.tenant_id), 'medium');
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_annotation_mentions AFTER INSERT OR UPDATE OF content ON public.document_annotations
FOR EACH ROW EXECUTE FUNCTION public.document_annotation_mentions();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public' AND tablename = 'document_annotations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.document_annotations;
  END IF;
END $$;
