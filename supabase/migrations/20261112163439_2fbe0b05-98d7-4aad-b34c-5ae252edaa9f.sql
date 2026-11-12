CREATE TABLE public.document_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  file_kind text NOT NULL,
  file_version text,
  annotation_type text NOT NULL,
  page_number integer,
  target_selector jsonb NOT NULL DEFAULT '{}'::jsonb,
  quote_text text,
  color text NOT NULL DEFAULT 'yellow',
  content text NOT NULL DEFAULT '',
  resolved boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_document_annotations_doc ON public.document_annotations(document_id);
CREATE INDEX idx_document_annotations_tenant ON public.document_annotations(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_annotations TO authenticated;
GRANT ALL ON public.document_annotations TO service_role;
ALTER TABLE public.document_annotations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.document_annotations_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _doc_tenant uuid;
BEGIN
  IF NEW.file_kind NOT IN ('pdf','image') THEN RAISE EXCEPTION 'invalid file_kind'; END IF;
  IF NEW.annotation_type NOT IN ('highlight','rect','polygon') THEN RAISE EXCEPTION 'invalid annotation_type'; END IF;
  IF NEW.color NOT IN ('yellow','green','red','blue') THEN RAISE EXCEPTION 'invalid color'; END IF;
  IF length(NEW.content) > 5000 THEN RAISE EXCEPTION 'comment too long'; END IF;
  SELECT tenant_id INTO _doc_tenant FROM public.documents WHERE id = NEW.document_id;
  IF _doc_tenant IS NULL OR _doc_tenant <> NEW.tenant_id THEN RAISE EXCEPTION 'document tenant mismatch'; END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by; NEW.tenant_id := OLD.tenant_id; NEW.document_id := OLD.document_id; NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_document_annotations_validate BEFORE INSERT OR UPDATE ON public.document_annotations
FOR EACH ROW EXECUTE FUNCTION public.document_annotations_validate();

CREATE POLICY "Tenant members read annotations" ON public.document_annotations FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "Tenant members create own annotations" ON public.document_annotations FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "Tenant members update annotations" ON public.document_annotations FOR UPDATE TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()))
WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "Author or leads delete annotations" ON public.document_annotations FOR DELETE TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()) AND (created_by = auth.uid()
  OR public.has_role(auth.uid(), 'abgeordneter'::app_role) OR public.has_role(auth.uid(), 'bueroleitung'::app_role)));

-- Only author or leads may change text/position; any member may toggle resolved
CREATE OR REPLACE FUNCTION public.document_annotations_guard_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.created_by <> auth.uid()
     AND NOT public.has_role(auth.uid(), 'abgeordneter'::app_role)
     AND NOT public.has_role(auth.uid(), 'bueroleitung'::app_role)
     AND (NEW.content IS DISTINCT FROM OLD.content OR NEW.color IS DISTINCT FROM OLD.color
          OR NEW.target_selector IS DISTINCT FROM OLD.target_selector OR NEW.annotation_type IS DISTINCT FROM OLD.annotation_type
          OR NEW.page_number IS DISTINCT FROM OLD.page_number) THEN
    RAISE EXCEPTION 'only author may edit annotation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_document_annotations_guard BEFORE UPDATE ON public.document_annotations
FOR EACH ROW EXECUTE FUNCTION public.document_annotations_guard_edit();