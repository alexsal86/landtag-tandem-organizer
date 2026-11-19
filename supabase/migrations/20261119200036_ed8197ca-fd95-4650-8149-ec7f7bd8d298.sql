DO $$ DECLARE r record; BEGIN
FOR r IN SELECT p.oid::regprocedure f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND p.proname IN ('assign_contact_to_organization','can_manage_dashboard','create_knowledge_document_snapshot','create_meeting_action_task','delete_employee_hr','delete_employee_lifecycle','get_active_deputyships_for_user','get_user_role_level','handover_tasks_to_deputy','is_action_allowed','is_admin_for_audit_logs','is_deputy_for','is_feature_enabled','quick_note_owned','sync_birthday_appointments','sync_existing_contact_tags') LOOP
 EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.f);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.f);
END LOOP; END $$;