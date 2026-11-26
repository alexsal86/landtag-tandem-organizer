-- Zwei Nachträge zu Mitarbeitergesprächen und Zuständigkeits-Matrix.
--
-- 1. reopen_meeting_protocol wies ein noch nicht abgeschlossenes Gespräch mit
--    dem Standardfehlercode P0001 ab, während Freigabe (22023) und Bestätigung
--    (22023) sprechen. Wer „nicht abgeschlossen" von „ungültige Eingabe"
--    unterscheiden will, hat damit keinen Code. Die Regel bleibt unverändert;
--    nur der Fehlercode wird an die Nachbarfunktionen angeglichen.
--
-- 2. assign_from_responsibility_matrix schrieb den Übergabeeintrag selbst,
--    obwohl der Trigger record_task_stafette_handover seit 20261121100000 jede
--    Änderung an ball_owner/ball_assignee_id/ball_external_label chronisiert.
--    Jede Übergabe erzeugte so zwei Timeline-Einträge. Der Trigger bleibt die
--    einzige Quelle der Übergabehistorie; die RPC setzt weiterhin Empfänger,
--    assigned_to und den RLS-/Rollencheck, aber keine eigene Timeline mehr.

CREATE OR REPLACE FUNCTION public.reopen_meeting_protocol(p_meeting_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.employee_meetings;
BEGIN
  m:=public.require_employee_meeting_access(p_meeting_id,true);
  IF nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Bitte einen Grund angeben' USING ERRCODE='22023'; END IF;
  IF m.status NOT IN ('completed','pending_acknowledgement','acknowledged') THEN RAISE EXCEPTION 'Gespräch ist nicht abgeschlossen' USING ERRCODE='22023'; END IF;
  INSERT INTO public.employee_meeting_audit(meeting_id,actor,action,reason,protocol_hash) VALUES(m.id,auth.uid(),'reopened',btrim(p_reason),m.protocol_hash);
  UPDATE public.employee_meetings SET status='in_progress',acknowledged_at=NULL,acknowledged_by=NULL,protocol_hash=NULL,
    acknowledgement_requested_at=NULL,acknowledgement_comment=NULL WHERE id=m.id;
  PERFORM public.create_notification(m.employee_id,'employee_protocol_response','Protokoll wieder geöffnet',btrim(p_reason),jsonb_build_object('meeting_id',m.id),'medium');
END $$;

REVOKE ALL ON FUNCTION public.reopen_meeting_protocol(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reopen_meeting_protocol(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_from_responsibility_matrix(p_tenant uuid,p_kind text,p_id uuid,p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_owner uuid; v_count integer;
BEGIN
 IF auth.uid() IS NULL OR NOT user_belongs_to_tenant(p_tenant) OR NOT EXISTS (
  SELECT 1 FROM user_tenant_memberships WHERE tenant_id=p_tenant AND user_id=auth.uid() AND is_active
  AND role IN ('abgeordneter','bueroleitung','mitarbeiter','praktikant')
 ) OR (p_user IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_user AND is_active)) THEN
  RAISE EXCEPTION 'Keine Berechtigung oder Person gehört nicht zum Büro.' USING ERRCODE='42501';
 END IF;
 IF p_kind='task' AND p_user IS NULL THEN RAISE EXCEPTION 'Person fehlt.' USING ERRCODE='22023'; END IF;
 IF p_kind='task' THEN
  SELECT user_id INTO v_owner FROM tasks WHERE id=p_id AND tenant_id=p_tenant FOR UPDATE;
 ELSIF p_kind='case_file' THEN
  SELECT user_id INTO v_owner FROM case_files WHERE id=p_id AND tenant_id=p_tenant FOR UPDATE;
 ELSE RAISE EXCEPTION 'Ungültiger Übergabetyp.' USING ERRCODE='22023'; END IF;
 IF v_owner IS NULL OR (v_owner<>auth.uid() AND NOT is_tenant_config_admin(p_tenant)) THEN
  RAISE EXCEPTION 'Nur eigene Einträge oder Übergabe durch die Leitung.' USING ERRCODE='42501';
 END IF;
 IF p_kind='task' THEN
  UPDATE tasks SET ball_assignee_id=p_user,assigned_to=p_user::text WHERE id=p_id AND tenant_id=p_tenant;
 ELSE UPDATE case_files SET assigned_to=p_user WHERE id=p_id AND tenant_id=p_tenant; END IF;
 GET DIAGNOSTICS v_count = ROW_COUNT;
 IF v_count<>1 THEN RAISE EXCEPTION 'Übergabe durch RLS verweigert.' USING ERRCODE='42501'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.assign_from_responsibility_matrix(uuid,text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assign_from_responsibility_matrix(uuid,text,uuid,uuid) TO authenticated;
