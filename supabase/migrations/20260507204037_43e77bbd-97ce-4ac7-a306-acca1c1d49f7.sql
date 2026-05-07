-- 1. View hardening
ALTER VIEW public.v_rls_coverage SET (security_invoker = true);

-- 2. Revoke EXECUTE from authenticated for trigger functions + internal helpers
DO $$
DECLARE
  r record;
  fname text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname,
           'public.' || quote_ident(p.proname) || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig,
           pg_get_function_result(p.oid) AS rettype
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('authenticated', p.oid, 'execute')
  LOOP
    fname := r.proname;
    IF r.rettype = 'trigger'
       OR fname LIKE 'audit\_%' ESCAPE '\'
       OR fname LIKE 'cleanup\_%' ESCAPE '\'
       OR fname LIKE 'auto\_%' ESCAPE '\'
       OR fname LIKE 'dispatch\_%' ESCAPE '\'
       OR fname LIKE 'notify\_automation\_%' ESCAPE '\'
       OR fname LIKE 'enforce\_%' ESCAPE '\'
       OR fname LIKE 'handle\_%' ESCAPE '\'
       OR fname LIKE 'validate\_%' ESCAPE '\'
       OR fname LIKE 'ensure\_%' ESCAPE '\'
       OR fname LIKE 'log\_%' ESCAPE '\'
       OR fname LIKE 'expire\_%' ESCAPE '\'
       OR fname LIKE 'archive\_%' ESCAPE '\'
       OR fname LIKE 'touch\_%' ESCAPE '\'
       OR fname LIKE 'gdpr\_%' ESCAPE '\'
       OR fname LIKE 'generate\_%\_token' ESCAPE '\'
       OR fname IN ('check_archive_after_creator_response',
                    'check_and_archive_decision',
                    'create_appointment_feedback_entry',
                    'create_appointment_feedback_on_past',
                    'create_feedback_for_past_appointment',
                    'create_letter_followup_task',
                    'create_matrix_widget_improvement_trigger',
                    'reconcile_employee_meeting_requests',
                    'cleanup_workflow_runs',
                    'auto_update_poll_status')
    THEN
      EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM authenticated';
    END IF;
  END LOOP;
END $$;