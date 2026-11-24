-- Expose only participation and response status, independently of birthday sharing.
-- Answer texts continue through the existing snapshot and UI reveal rule.
CREATE OR REPLACE FUNCTION public.team_weekly_question_participation(p_tenant uuid)
RETURNS TABLE(user_id uuid, display_name text, answered boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.team_ritual_member(p_tenant) OR NOT public.team_ritual_participant(p_tenant) THEN
    RAISE EXCEPTION 'Participation required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT r.user_id, COALESCE(p.display_name, 'Teammitglied')::text,
    EXISTS (SELECT 1 FROM public.team_question_answers a
      JOIN public.team_question_weeks w ON w.id = a.week_id AND w.tenant_id = a.tenant_id
      WHERE a.tenant_id = p_tenant AND a.user_id = r.user_id
        AND w.week_start = date_trunc('week', now() AT TIME ZONE 'Europe/Berlin')::date)
  FROM public.team_ritual_profiles r
  LEFT JOIN public.profiles p ON p.user_id = r.user_id AND p.tenant_id = r.tenant_id
  WHERE r.tenant_id = p_tenant AND r.opted_in AND EXISTS (
    SELECT 1 FROM public.user_tenant_memberships m
    WHERE m.tenant_id = r.tenant_id AND m.user_id = r.user_id AND m.is_active)
  ORDER BY COALESCE(p.display_name, 'Teammitglied'), r.user_id;
END $$;
REVOKE ALL ON FUNCTION public.team_weekly_question_participation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.team_weekly_question_participation(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
