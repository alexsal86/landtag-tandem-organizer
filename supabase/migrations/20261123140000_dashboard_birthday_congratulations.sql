-- One office task per contact and birthday year, shared by all dashboard users.
CREATE UNIQUE INDEX IF NOT EXISTS tasks_birthday_congratulations_unique
ON public.tasks (tenant_id, source_id) WHERE source_type = 'birthday_congratulations';

CREATE OR REPLACE FUNCTION public.request_birthday_congratulations(_contact_id uuid, _tenant_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE contact_row public.contacts%ROWTYPE; owner_id uuid; task_id uuid; agenda_row record; planned jsonb;
  today date := (now() AT TIME ZONE 'Europe/Berlin')::date; source_key text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_tenant_memberships WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id AND is_active
  ) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  -- Serialize repeated requests before checking for an existing task.
  SELECT * INTO contact_row FROM public.contacts WHERE id = _contact_id AND tenant_id = _tenant_id FOR UPDATE;
  IF NOT FOUND OR contact_row.birthday IS NULL OR to_char(contact_row.birthday::date,'MM-DD') <> to_char(today,'MM-DD') THEN
    RAISE EXCEPTION 'No birthday today';
  END IF;
  source_key := _contact_id::text || ':' || extract(year FROM today)::text;
  SELECT id INTO task_id FROM public.tasks WHERE tenant_id = _tenant_id
    AND source_type = 'birthday_congratulations' AND source_id = source_key;
  IF task_id IS NOT NULL THEN RETURN task_id; END IF;
  FOR agenda_row IN
    SELECT a.result_text FROM public.meeting_agenda_items a JOIN public.meetings m ON m.id = a.meeting_id
    WHERE m.tenant_id = _tenant_id AND a.system_type = 'birthdays'
      AND m.meeting_date::date BETWEEN today - 14 AND today ORDER BY a.updated_at DESC
  LOOP
    BEGIN
      planned := agenda_row.result_text::jsonb -> _contact_id::text;
      IF planned IS NOT NULL THEN EXIT; END IF;
    EXCEPTION WHEN invalid_text_representation THEN planned := NULL;
    END;
  END LOOP;
  SELECT m.user_id INTO owner_id FROM public.user_tenant_memberships m
    WHERE m.tenant_id = _tenant_id AND m.is_active AND m.role IN ('bueroleitung','mitarbeiter')
      AND m.user_id::text IN (SELECT jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(planned->'assigned_to') = 'array' THEN planned->'assigned_to' ELSE '[]'::jsonb END))
    ORDER BY m.created_at,m.user_id LIMIT 1;
  IF owner_id IS NULL THEN
  SELECT user_id INTO owner_id FROM public.user_tenant_memberships
    WHERE tenant_id = _tenant_id AND is_active AND role IN ('bueroleitung','mitarbeiter')
    ORDER BY (role = 'bueroleitung') DESC, created_at, user_id LIMIT 1;
  END IF;
  IF owner_id IS NULL THEN RAISE EXCEPTION 'No active office employee available'; END IF;
  INSERT INTO public.tasks(user_id,tenant_id,title,description,assigned_to,status,priority,category,
    ball_owner,ball_assignee_id,next_action,source_type,source_id,timeline)
  VALUES(auth.uid(),_tenant_id,'Glückwünsche veranlassen: ' || contact_row.name,
    'Bitte Geburtstagsglückwünsche für ' || contact_row.name || ' mit der bestehenden Jour-fixe-Planung abstimmen.',
    owner_id::text,'todo','medium','personal','office',owner_id,'Glückwünsche abstimmen und veranlassen',
    'birthday_congratulations',source_key,
    jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'type','system','at',now(),
      'text','Geburtstagsglückwünsche über das Dashboard beim Büro beauftragt.')))
  RETURNING id INTO task_id;
  RETURN task_id;
END $$;
REVOKE ALL ON FUNCTION public.request_birthday_congratulations(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_birthday_congratulations(uuid,uuid) TO authenticated;
