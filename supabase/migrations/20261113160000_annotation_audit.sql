-- History is append-only, written by the annotation trigger under the existing annotation RLS.
CREATE TABLE public.document_annotation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  annotation_id uuid NOT NULL,
  thread_id uuid NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK(event_type IN ('created','updated','deleted')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX annotation_events_document ON public.document_annotation_events(document_id,created_at DESC);
ALTER TABLE public.document_annotation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_annotation_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.document_annotation_events TO authenticated;
GRANT ALL ON public.document_annotation_events TO service_role;
CREATE POLICY "Read annotation history in own tenant" ON public.document_annotation_events FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id,auth.uid()));

CREATE OR REPLACE FUNCTION public.record_document_annotation_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row_data public.document_annotations; prior jsonb; following jsonb;
BEGIN
  IF TG_OP='DELETE' THEN row_data:=OLD; ELSE row_data:=NEW; END IF;
  IF TG_OP<>'INSERT' THEN prior:=to_jsonb(OLD)-'updated_at'; END IF;
  IF TG_OP<>'DELETE' THEN following:=to_jsonb(NEW)-'updated_at'; END IF;
  IF TG_OP='UPDATE' AND prior=following THEN RETURN NEW; END IF;
  -- Document cascade deletion needs no history: its complete history is also removed.
  IF NOT EXISTS(SELECT 1 FROM public.documents WHERE id=row_data.document_id) THEN RETURN NULL; END IF;
  INSERT INTO public.document_annotation_events(document_id,tenant_id,annotation_id,thread_id,actor_id,event_type,before_data,after_data)
  VALUES(row_data.document_id,row_data.tenant_id,row_data.id,coalesce(row_data.parent_id,row_data.id),auth.uid(),
    CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'DELETE' THEN 'deleted' ELSE 'updated' END,prior,following);
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_document_annotation_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER annotation_audit AFTER INSERT OR UPDATE OR DELETE ON public.document_annotations
FOR EACH ROW EXECUTE FUNCTION public.record_document_annotation_event();
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.document_annotation_events;
  END IF;
END $$;
