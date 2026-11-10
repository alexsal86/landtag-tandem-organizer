DO $$
DECLARE tid uuid; owner_id uuid; rid uuid:=gen_random_uuid(); aid uuid; task1 uuid; task2 uuid; result jsonb; old_claims text:=current_setting('request.jwt.claims',true); old_role text:=current_setting('request.jwt.claim.role',true); blocked boolean:=false;
BEGIN
 SELECT m.tenant_id,m.user_id INTO tid,owner_id FROM public.user_tenant_memberships m JOIN auth.users u ON u.id=m.user_id WHERE m.is_active AND m.role='abgeordneter' ORDER BY m.tenant_id LIMIT 1;
 IF tid IS NULL THEN RAISE EXCEPTION 'Test braucht ein Büro mit berechtigtem Konto'; END IF;
 BEGIN
   PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
   PERFORM set_config('request.jwt.claim.role','service_role',true);
   INSERT INTO public.automation_rules(id,tenant_id,name,module,trigger_type,trigger_config,conditions,actions,created_by) VALUES(rid,tid,'[TEST] Einheitliche Jahresroutine','tasks','manual','{"schedule_kind":"annual","month":"11","day":"15","hour":"9","month_end":"false","timezone":"Europe/Berlin"}','{"all":[]}',jsonb_build_array(jsonb_build_object('type','run_annual_routine','payload',jsonb_build_object('title','[TEST] Büroaufgabe','assigned_to',owner_id::text))),owner_id);
   SELECT id INTO aid FROM public.annual_tasks WHERE automation_rule_id=rid;
   IF aid IS NULL THEN RAISE EXCEPTION 'Automatische Jahresverknüpfung fehlt'; END IF;
   UPDATE public.automation_rules SET trigger_config=jsonb_set(trigger_config,'{month}','"12"') WHERE id=rid;
   IF NOT EXISTS(SELECT 1 FROM public.annual_tasks WHERE id=aid AND due_month=12) THEN RAISE EXCEPTION 'Bearbeitung wird nicht synchronisiert'; END IF;
   result:=public.execute_annual_automation_routine(rid,aid,2026); task1:=(result->>'task_id')::uuid;
   result:=public.execute_annual_automation_routine(rid,aid,2026); task2:=(result->>'task_id')::uuid;
   IF task1 IS NULL OR task1<>task2 OR result->>'reused'<>'true' THEN RAISE EXCEPTION 'Doppelte Jahresübergabe'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.tasks WHERE id=task1 AND next_action_due='2026-12-15' AND assigned_to=owner_id::text AND tenant_id=tid) THEN RAISE EXCEPTION 'Stafette oder Jahresfrist falsch'; END IF;
   BEGIN UPDATE public.automation_rules SET trigger_config=jsonb_set(trigger_config,'{schedule_kind}','"monthly"') WHERE id=rid; EXCEPTION WHEN OTHERS THEN blocked:=true; END;
   IF NOT blocked THEN RAISE EXCEPTION 'Monatliche Systemausführung nicht gesperrt'; END IF;
   blocked:=false;
   BEGIN UPDATE public.automation_rules SET actions=jsonb_set(actions,'{0,payload,system_function}','"execute_reset_vacation_days"') WHERE id=rid; EXCEPTION WHEN OTHERS THEN blocked:=true; END;
   IF NOT blocked THEN RAISE EXCEPTION 'Austausch der Routine nicht gesperrt'; END IF;
   RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Rollback erfolgreicher Routine-Tests';
 EXCEPTION WHEN no_data_found THEN NULL;
 END;
 PERFORM set_config('request.jwt.claims',COALESCE(old_claims,''),true);
 PERFORM set_config('request.jwt.claim.role',COALESCE(old_role,''),true);
END $$;
CREATE UNIQUE INDEX annual_system_routine_per_tenant ON public.annual_tasks(tenant_id,execute_function) WHERE execute_function IS NOT NULL;