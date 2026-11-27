-- Selbsttest für den Erfolgspfad von convert_topic_to_catalog.
--
-- Der Ablauf legt Themen, Zuständigkeiten, einen Vorgangslink und die
-- Katalogeinträge an, führt die echte Konvertierung und das echte Zusammenführen
-- aus und rollt danach alles in einer Untertransaktion zurück. Damit bleiben
-- keine Gremien, Regionen, Links oder Zuständigkeiten aus dem Test zurück
-- (Muster: knowledge_qa_selftest).
--
-- Geprüft wird:
-- - die Konvertierung erhält das Thema (inaktiv, Label unverändert) und den
--   historischen Vorgangslink,
-- - Zuständigkeiten wandern auf das Ziel, andere Primaries bleiben bestehen,
-- - ein zweiter Aufruf nutzt den vorhandenen Link weiter,
-- - beim Zusammenführen von Gremien bzw. Regionen zeigen die
--   topic_catalog_links auf das Ziel, die Quelle verschwindet und
--   kollidierende Zuständigkeiten bleiben als genau eine Primary-Zeile bestehen.
CREATE OR REPLACE FUNCTION public.topic_catalog_conversion_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor uuid := auth.uid();
  admin boolean := false;
  second_user uuid;
  t1 uuid; t2 uuid; t3 uuid; t4 uuid;
  c1 uuid; c2 uuid; r1 uuid; r2 uuid;
  label1 text; label2 text; label3 text; label4 text;
  focus text;
  item uuid;
  converted jsonb;
  reused jsonb;
  marker text := 'selbsttest-' || left(replace(gen_random_uuid()::text, '-', ''), 10);
  checks jsonb := '{}'::jsonb;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Bitte anmelden.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_tenant_memberships m
    WHERE m.tenant_id = p_tenant AND m.user_id = actor AND m.is_active
  ) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft.' USING ERRCODE = '42501';
  END IF;

  admin := public.is_tenant_config_admin(p_tenant);
  IF NOT admin THEN
    BEGIN
      PERFORM public.convert_topic_to_catalog(gen_random_uuid(), 'committee');
      RETURN jsonb_build_object('ok', false, 'mode', 'denied_but_allowed',
        'message', 'Konvertierung ohne Leitungsrolle war möglich.');
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', SQLERRM LIKE '%Nur die Büroleitung%',
        'mode', 'role_denied', 'message', SQLERRM);
    END;
  END IF;

  BEGIN
    label1 := marker || ' Ausschuss A';
    label2 := marker || ' Ausschuss B';
    label3 := marker || ' Stadtteil A';
    label4 := marker || ' Stadtteil B';
    focus := marker || ' Bürgerdialog';

    INSERT INTO public.topics (tenant_id, name, label, is_active, created_by)
      VALUES (p_tenant, marker || '-a', label1, true, actor) RETURNING id INTO t1;
    INSERT INTO public.topics (tenant_id, name, label, is_active, created_by)
      VALUES (p_tenant, marker || '-b', label2, true, actor) RETURNING id INTO t2;
    INSERT INTO public.topics (tenant_id, name, label, is_active, created_by)
      VALUES (p_tenant, marker || '-c', label3, true, actor) RETURNING id INTO t3;
    INSERT INTO public.topics (tenant_id, name, label, is_active, created_by)
      VALUES (p_tenant, marker || '-d', label4, true, actor) RETURNING id INTO t4;

    SELECT m.user_id INTO second_user
    FROM public.user_tenant_memberships m
    WHERE m.tenant_id = p_tenant AND m.is_active AND m.user_id <> actor
    LIMIT 1;

    INSERT INTO public.employee_responsibilities (tenant_id, user_id, kind, topic_id, level)
      VALUES (p_tenant, actor, 'topic', t1, 'primary');
    IF second_user IS NOT NULL THEN
      INSERT INTO public.employee_responsibilities (tenant_id, user_id, kind, topic_id, level)
        VALUES (p_tenant, second_user, 'topic', t1, 'primary');
    END IF;
    INSERT INTO public.employee_responsibilities (tenant_id, user_id, kind, role_focus, level)
      VALUES (p_tenant, actor, 'role_focus', focus, 'primary');

    INSERT INTO public.case_items (subject, summary, user_id, tenant_id)
      VALUES (marker || ' Vorgang', 'Selbsttest', actor, p_tenant) RETURNING id INTO item;
    INSERT INTO public.case_item_topics (tenant_id, case_item_id, topic_id, created_by)
      VALUES (p_tenant, item, t1, actor);

    converted := public.convert_topic_to_catalog(t1, 'committee');
    c1 := (converted->>'id')::uuid;
    reused := public.convert_topic_to_catalog(t1, 'committee');

    checks := checks || jsonb_build_object(
      'committee_created', EXISTS (
        SELECT 1 FROM public.committees x
        WHERE x.id = c1 AND x.tenant_id = p_tenant AND x.name = label1
      ),
      'topic_preserved', EXISTS (
        SELECT 1 FROM public.topics x
        WHERE x.id = t1 AND x.label = label1 AND x.is_active = false
      ),
      'link_written', EXISTS (
        SELECT 1 FROM public.topic_catalog_links l
        WHERE l.tenant_id = p_tenant AND l.topic_id = t1
          AND l.kind = 'committee' AND l.committee_id = c1
      ),
      'repeat_reuses_link', COALESCE((reused->>'reused')::boolean, false)
        AND (reused->>'id')::uuid = c1,
      'primary_moved', EXISTS (
        SELECT 1 FROM public.employee_responsibilities r
        WHERE r.tenant_id = p_tenant AND r.user_id = actor
          AND r.kind = 'committee' AND r.committee_id = c1 AND r.level = 'primary'
      ) AND NOT EXISTS (
        SELECT 1 FROM public.employee_responsibilities r
        WHERE r.tenant_id = p_tenant AND r.user_id = actor
          AND r.kind = 'topic' AND r.topic_id = t1
      ),
      'other_primary_kept', EXISTS (
        SELECT 1 FROM public.employee_responsibilities r
        WHERE r.tenant_id = p_tenant AND r.user_id = actor
          AND r.kind = 'role_focus' AND r.role_focus = focus AND r.level = 'primary'
      ),
      'history_link_kept', EXISTS (
        SELECT 1 FROM public.case_item_topics l
        WHERE l.tenant_id = p_tenant AND l.case_item_id = item AND l.topic_id = t1
      )
    );

    -- Ohne zweites aktives Büromitglied lässt sich das Mitziehen einer zweiten
    -- Primary-Person nicht belegen. Der Check wird dann nicht stillschweigend
    -- wahr, sondern bleibt als ungeprüft außen vor und wird im Modus gemeldet.
    IF second_user IS NOT NULL THEN
      checks := checks || jsonb_build_object(
        'second_primary_moved', EXISTS (
          SELECT 1 FROM public.employee_responsibilities r
          WHERE r.tenant_id = p_tenant AND r.user_id = second_user
            AND r.kind = 'committee' AND r.committee_id = c1 AND r.level = 'primary'
        )
      );
    END IF;

    INSERT INTO public.employee_responsibilities (tenant_id, user_id, kind, topic_id, level)
      VALUES (p_tenant, actor, 'topic', t2, 'primary');
    converted := public.convert_topic_to_catalog(t2, 'committee');
    c2 := (converted->>'id')::uuid;
    PERFORM public.merge_responsibility_catalog(p_tenant, 'committee', c2, c1);

    checks := checks || jsonb_build_object(
      'merge_link_repointed', EXISTS (
        SELECT 1 FROM public.topic_catalog_links l
        WHERE l.tenant_id = p_tenant AND l.topic_id = t2
          AND l.kind = 'committee' AND l.committee_id = c1
      ),
      'merge_source_removed', NOT EXISTS (
        SELECT 1 FROM public.committees x WHERE x.id = c2
      ),
      'merge_keeps_single_primary', (
        SELECT count(*) FROM public.employee_responsibilities r
        WHERE r.tenant_id = p_tenant AND r.user_id = actor
          AND r.kind = 'committee' AND r.committee_id = c1
      ) = 1
    );

    converted := public.convert_topic_to_catalog(t3, 'region', 'stadtteil');
    r1 := (converted->>'id')::uuid;
    converted := public.convert_topic_to_catalog(t4, 'region', 'stadtteil');
    r2 := (converted->>'id')::uuid;
    PERFORM public.merge_responsibility_catalog(p_tenant, 'region', r2, r1);

    checks := checks || jsonb_build_object(
      'region_link_written', EXISTS (
        SELECT 1 FROM public.topic_catalog_links l
        WHERE l.tenant_id = p_tenant AND l.topic_id = t3
          AND l.kind = 'region' AND l.region_id = r1
      ),
      'region_link_repointed', EXISTS (
        SELECT 1 FROM public.topic_catalog_links l
        WHERE l.tenant_id = p_tenant AND l.topic_id = t4
          AND l.kind = 'region' AND l.region_id = r1
      ),
      'region_source_removed', NOT EXISTS (
        SELECT 1 FROM public.regions x WHERE x.id = r2
      )
    );

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX001';
  EXCEPTION
    WHEN SQLSTATE 'ZX001' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'mode', 'error', 'message', SQLERRM, 'checks', checks);
  END;

  RETURN jsonb_build_object(
    'ok', NOT EXISTS (
      SELECT 1 FROM jsonb_each(checks) e
      WHERE jsonb_typeof(e.value) = 'boolean' AND e.value <> 'true'::jsonb
    ),
    'mode', CASE WHEN second_user IS NULL THEN 'checked_without_second_member' ELSE 'checked' END,
    'complete', second_user IS NOT NULL,
    'unverified', CASE WHEN second_user IS NULL
      THEN jsonb_build_array('second_primary_moved')
      ELSE '[]'::jsonb END,
    'checks', checks
  );
END $$;

REVOKE ALL ON FUNCTION public.topic_catalog_conversion_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.topic_catalog_conversion_selftest(uuid) TO authenticated;
