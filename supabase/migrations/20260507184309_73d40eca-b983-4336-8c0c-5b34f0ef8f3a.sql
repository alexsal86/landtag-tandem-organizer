
-- pg_trgm Indizes
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON public.contacts USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_email_trgm ON public.contacts USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm ON public.contacts USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON public.contacts (tenant_id);

-- Helper: ist Mitglied?
CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_tenant_memberships
    WHERE tenant_id = _tenant_id AND user_id = _user_id AND is_active = true
  );
$$;

-- ============================================================
-- RPC: find_contact_duplicates_trgm
-- ============================================================
CREATE OR REPLACE FUNCTION public.find_contact_duplicates_trgm(
  _tenant_id uuid,
  _threshold numeric DEFAULT 0.55,
  _limit int DEFAULT 200
)
RETURNS TABLE (
  contact1_id uuid,
  contact2_id uuid,
  contact1_name text,
  contact2_name text,
  contact1_email text,
  contact2_email text,
  match_score numeric,
  match_reasons text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_tenant_member(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Kein Zugriff auf Mandant';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT c.id, c.name, c.email, c.phone
    FROM public.contacts c
    WHERE c.tenant_id = _tenant_id
  ),
  pairs AS (
    SELECT
      a.id AS id1, b.id AS id2,
      a.name AS name1, b.name AS name2,
      a.email AS email1, b.email AS email2,
      similarity(coalesce(a.name,''), coalesce(b.name,'')) AS name_sim,
      CASE WHEN a.email IS NOT NULL AND b.email IS NOT NULL
           THEN similarity(lower(a.email), lower(b.email)) ELSE 0 END AS email_sim,
      CASE WHEN a.phone IS NOT NULL AND b.phone IS NOT NULL
           THEN similarity(regexp_replace(a.phone,'[^0-9]','','g'), regexp_replace(b.phone,'[^0-9]','','g'))
           ELSE 0 END AS phone_sim
    FROM base a
    JOIN base b ON a.id < b.id
    WHERE
      (a.name % b.name)
      OR (a.email IS NOT NULL AND b.email IS NOT NULL AND lower(a.email) % lower(b.email))
  )
  SELECT
    p.id1, p.id2, p.name1, p.name2, p.email1, p.email2,
    GREATEST(p.name_sim, p.email_sim, p.phone_sim)::numeric AS match_score,
    ARRAY(
      SELECT r FROM (
        VALUES
          (CASE WHEN p.name_sim >= _threshold THEN 'Name ähnlich' END),
          (CASE WHEN p.email_sim >= _threshold THEN 'E-Mail ähnlich' END),
          (CASE WHEN p.phone_sim >= 0.8 THEN 'Telefon ähnlich' END)
      ) AS t(r) WHERE r IS NOT NULL
    )
  FROM pairs p
  WHERE GREATEST(p.name_sim, p.email_sim, p.phone_sim) >= _threshold
  ORDER BY GREATEST(p.name_sim, p.email_sim, p.phone_sim) DESC
  LIMIT _limit;
END;
$$;

-- ============================================================
-- Tabelle: data_lint_findings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.data_lint_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  scope text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  entity_type text NOT NULL,
  entity_id uuid,
  issue text NOT NULL,
  details jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_data_lint_findings_tenant ON public.data_lint_findings (tenant_id, scope, resolved_at);

ALTER TABLE public.data_lint_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lint_select_tenant" ON public.data_lint_findings;
CREATE POLICY "lint_select_tenant" ON public.data_lint_findings
FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "lint_update_tenant" ON public.data_lint_findings;
CREATE POLICY "lint_update_tenant" ON public.data_lint_findings
FOR UPDATE TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()));

-- ============================================================
-- RPC: run_data_lint
-- ============================================================
CREATE OR REPLACE FUNCTION public.run_data_lint(_tenant_id uuid)
RETURNS TABLE (scope text, finding_count int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_tenant_member(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Kein Zugriff auf Mandant';
  END IF;

  DELETE FROM public.data_lint_findings WHERE tenant_id = _tenant_id AND resolved_at IS NULL;

  -- Kontakte ohne Kategorie
  INSERT INTO public.data_lint_findings (tenant_id, scope, severity, entity_type, entity_id, issue)
  SELECT _tenant_id, 'contacts_missing_category', 'warning', 'contact', c.id,
         'Kontakt ohne Kategorie: ' || coalesce(c.name, '(ohne Name)')
  FROM public.contacts c
  WHERE c.tenant_id = _tenant_id AND (c.category IS NULL OR c.category = '');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  scope := 'contacts_missing_category'; finding_count := v_count; RETURN NEXT;

  -- Kontakte ohne Name
  INSERT INTO public.data_lint_findings (tenant_id, scope, severity, entity_type, entity_id, issue)
  SELECT _tenant_id, 'contacts_missing_name', 'error', 'contact', c.id,
         'Kontakt ohne Name (ID ' || c.id::text || ')'
  FROM public.contacts c
  WHERE c.tenant_id = _tenant_id AND (c.name IS NULL OR trim(c.name) = '');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  scope := 'contacts_missing_name'; finding_count := v_count; RETURN NEXT;

  -- Tasks ohne Bearbeiter
  INSERT INTO public.data_lint_findings (tenant_id, scope, severity, entity_type, entity_id, issue)
  SELECT _tenant_id, 'tasks_missing_assignee', 'warning', 'task', t.id,
         'Aufgabe ohne Bearbeiter: ' || coalesce(t.title, '(ohne Titel)')
  FROM public.tasks t
  WHERE t.tenant_id = _tenant_id AND (t.assigned_to IS NULL OR trim(t.assigned_to) = '');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  scope := 'tasks_missing_assignee'; finding_count := v_count; RETURN NEXT;

  -- Vorgänge ohne Owner
  INSERT INTO public.data_lint_findings (tenant_id, scope, severity, entity_type, entity_id, issue)
  SELECT _tenant_id, 'cases_missing_owner', 'warning', 'case_item', ci.id,
         'Vorgang ohne Owner: ' || coalesce(ci.subject, '(ohne Betreff)')
  FROM public.case_items ci
  WHERE ci.tenant_id = _tenant_id AND ci.owner_user_id IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  scope := 'cases_missing_owner'; finding_count := v_count; RETURN NEXT;

  RETURN;
END;
$$;

-- ============================================================
-- Tabelle: bulk_action_audit
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bulk_action_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  undo_payload jsonb,
  affected_count int,
  created_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz,
  undone_by uuid
);
CREATE INDEX IF NOT EXISTS idx_bulk_audit_tenant ON public.bulk_action_audit (tenant_id, created_at DESC);

ALTER TABLE public.bulk_action_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bulk_audit_select" ON public.bulk_action_audit;
CREATE POLICY "bulk_audit_select" ON public.bulk_action_audit
FOR SELECT TO authenticated
USING (public.is_tenant_member(tenant_id, auth.uid()));

DROP POLICY IF EXISTS "bulk_audit_insert_service" ON public.bulk_action_audit;
CREATE POLICY "bulk_audit_insert_service" ON public.bulk_action_audit
FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "bulk_audit_update_service" ON public.bulk_action_audit;
CREATE POLICY "bulk_audit_update_service" ON public.bulk_action_audit
FOR UPDATE TO service_role USING (true);

-- Cleanup
CREATE OR REPLACE FUNCTION public.cleanup_bulk_action_audit()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  DELETE FROM public.bulk_action_audit WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'data-quality-cleanup') THEN
    PERFORM cron.schedule(
      'data-quality-cleanup',
      '30 3 * * *',
      $cron$ SELECT public.cleanup_bulk_action_audit(); $cron$
    );
  END IF;
END $$;
