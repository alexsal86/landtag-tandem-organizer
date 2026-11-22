CREATE TABLE IF NOT EXISTS public.dashboard_decision_nudges (
  decision_id uuid PRIMARY KEY REFERENCES public.task_decisions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nudged_at timestamptz NOT NULL DEFAULT now(),
  nudged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text CHECK (char_length(note) <= 500)
);
ALTER TABLE public.dashboard_decision_nudges ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS a00_guard_tenant_references ON public.dashboard_decision_nudges;
CREATE TRIGGER a00_guard_tenant_references BEFORE INSERT OR UPDATE
ON public.dashboard_decision_nudges FOR EACH ROW EXECUTE FUNCTION public.guard_tenant_references();
REVOKE ALL ON public.dashboard_decision_nudges FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.dashboard_decision_nudges TO authenticated;
DROP POLICY IF EXISTS "Accessible decision nudges in active tenant" ON public.dashboard_decision_nudges;
CREATE POLICY "Accessible decision nudges in active tenant" ON public.dashboard_decision_nudges
FOR SELECT TO authenticated USING (
  public.user_can_access_task_decision(decision_id, auth.uid())
  AND EXISTS (SELECT 1 FROM public.user_tenant_memberships m
    WHERE m.tenant_id = dashboard_decision_nudges.tenant_id AND m.user_id = auth.uid() AND m.is_active)
);

CREATE OR REPLACE FUNCTION public.get_deputy_dashboard_decisions(_tenant_id uuid, _decision_ids uuid[] DEFAULT NULL)
RETURNS TABLE(decision_id uuid, title text, nudged_at timestamptz, nudge_note text, nudged_by_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT d.id,d.title,n.nudged_at,n.note,
    (SELECT p.display_name FROM public.profiles p WHERE p.user_id = n.nudged_by LIMIT 1)
  FROM public.task_decisions d
  LEFT JOIN public.dashboard_decision_nudges n ON n.decision_id = d.id AND n.tenant_id = d.tenant_id
  WHERE auth.uid() IS NOT NULL AND d.tenant_id = _tenant_id AND d.status IN ('active','open')
    AND EXISTS (SELECT 1 FROM public.user_tenant_memberships m
      WHERE m.tenant_id = d.tenant_id AND m.user_id = auth.uid() AND m.is_active)
    AND public.user_can_access_task_decision(d.id, auth.uid())
    AND (_decision_ids IS NULL OR d.id = ANY(_decision_ids))
    AND EXISTS (
      SELECT 1 FROM public.task_decision_participants p
      JOIN public.user_tenant_memberships deputy ON deputy.user_id = p.user_id
        AND deputy.tenant_id = d.tenant_id AND deputy.is_active AND deputy.role = 'abgeordneter'
      WHERE p.decision_id = d.id AND p.user_id <> d.created_by
        AND NOT EXISTS (SELECT 1 FROM public.task_decision_responses r
          WHERE r.participant_id = p.id AND r.decision_id = d.id AND r.parent_response_id IS NULL)
    )
  ORDER BY d.response_deadline NULLS LAST,d.created_at,d.id;
$$;
REVOKE ALL ON FUNCTION public.get_deputy_dashboard_decisions(uuid,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_deputy_dashboard_decisions(uuid,uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.nudge_dashboard_decision(_decision_id uuid, _note text DEFAULT NULL)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  d public.task_decisions;
  last_nudge timestamptz;
  sent_at timestamptz := now();
  sender_name text;
  recipient record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Bitte anmelden.' USING ERRCODE = '42501'; END IF;
  IF char_length(COALESCE(_note,'')) > 500 THEN RAISE EXCEPTION 'Der Hinweis darf höchstens 500 Zeichen enthalten.'; END IF;
  -- Lock the decision even on the first nudge, serialising concurrent employees and retries.
  SELECT * INTO d FROM public.task_decisions WHERE id = _decision_id FOR UPDATE;
  IF NOT FOUND OR NOT public.has_active_tenant_role(auth.uid(),d.tenant_id,ARRAY['mitarbeiter','bueroleitung','praktikant'])
    OR NOT public.user_can_access_task_decision(d.id,auth.uid()) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Anstupsen.' USING ERRCODE = '42501';
  END IF;
  IF d.status NOT IN ('active','open') THEN RAISE EXCEPTION 'Die Entscheidung ist nicht mehr offen.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.task_decision_participants p
    JOIN public.user_tenant_memberships m ON m.user_id = p.user_id AND m.tenant_id = d.tenant_id
      AND m.is_active AND m.role = 'abgeordneter'
    WHERE p.decision_id = d.id AND p.user_id <> d.created_by
      AND NOT EXISTS (SELECT 1 FROM public.task_decision_responses r
        WHERE r.participant_id = p.id AND r.decision_id = d.id AND r.parent_response_id IS NULL)
  ) THEN RAISE EXCEPTION 'Hier wartet keine Entscheidung mehr auf den Abgeordneten.'; END IF;

  SELECT nudged_at INTO last_nudge FROM public.dashboard_decision_nudges WHERE decision_id = d.id;
  IF last_nudge > sent_at - interval '24 hours' THEN RAISE EXCEPTION 'Diese Entscheidung wurde bereits innerhalb der letzten 24 Stunden angestupst.'; END IF;
  INSERT INTO public.dashboard_decision_nudges(decision_id,tenant_id,nudged_at,nudged_by,note)
  VALUES(d.id,d.tenant_id,sent_at,auth.uid(),NULLIF(btrim(_note),''))
  ON CONFLICT(decision_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id,nudged_at = EXCLUDED.nudged_at,nudged_by = EXCLUDED.nudged_by,note = EXCLUDED.note;
  SELECT display_name INTO sender_name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  FOR recipient IN
    SELECT DISTINCT p.user_id FROM public.task_decision_participants p
    JOIN public.user_tenant_memberships m ON m.user_id = p.user_id AND m.tenant_id = d.tenant_id
      AND m.is_active AND m.role = 'abgeordneter'
    WHERE p.decision_id = d.id AND p.user_id <> d.created_by
      AND NOT EXISTS (SELECT 1 FROM public.task_decision_responses r
        WHERE r.participant_id = p.id AND r.decision_id = d.id AND r.parent_response_id IS NULL)
  LOOP
    PERFORM public.create_notification(recipient.user_id,'task_decision_request','Angestupst: ' || d.title,
      COALESCE(sender_name,'Das Büro') || ' erinnert an deine Entscheidung.'
        || COALESCE(' ' || NULLIF(btrim(_note),''),''),
      jsonb_build_object('decision_id',d.id,'nudge',true,'nudged_at',sent_at),'high',d.tenant_id);
  END LOOP;
  RETURN sent_at;
END $$;
REVOKE ALL ON FUNCTION public.nudge_dashboard_decision(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.nudge_dashboard_decision(uuid,text) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'dashboard_decision_nudges') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_decision_nudges;
  END IF;
END $$;
