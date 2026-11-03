-- Run through the migration tool. All fixtures and state changes are rolled back.
DO $$
DECLARE
  tenant uuid;
  requester uuid;
  approver uuid;
  request_id uuid := gen_random_uuid();
  result public.gdpr_requests;
BEGIN
  SELECT tenant_id INTO tenant FROM public.user_tenant_memberships
  WHERE is_active AND role IN ('abgeordneter', 'bueroleitung')
  GROUP BY tenant_id HAVING count(DISTINCT user_id) >= 2 LIMIT 1;
  IF tenant IS NULL THEN RAISE EXCEPTION 'Test requires two active tenant admins'; END IF;
  SELECT user_id INTO requester FROM public.user_tenant_memberships
  WHERE tenant_id = tenant AND is_active AND role IN ('abgeordneter', 'bueroleitung') ORDER BY user_id LIMIT 1;
  SELECT user_id INTO approver FROM public.user_tenant_memberships
  WHERE tenant_id = tenant AND user_id <> requester AND is_active AND role IN ('abgeordneter', 'bueroleitung') ORDER BY user_id LIMIT 1;

  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
    INSERT INTO public.gdpr_requests(id,tenant_id,request_type,requested_by,reason)
    VALUES(request_id,tenant,'delete',requester,'Rollback-only approval security test');

    PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',requester)::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN
      UPDATE public.gdpr_requests SET approved_by = approver WHERE id = request_id;
      RAISE EXCEPTION USING ERRCODE='Z0002', MESSAGE='FAIL: requester could forge consent';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      PERFORM public.approve_gdpr_delete(request_id);
      RAISE EXCEPTION USING ERRCODE='Z0002', MESSAGE='FAIL: self approval succeeded';
    EXCEPTION WHEN raise_exception THEN NULL;
    END;

    PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','sub',approver)::text, true);
    PERFORM public.approve_gdpr_delete(request_id);
    SELECT * INTO result FROM public.gdpr_requests WHERE id=request_id;
    IF result.status <> 'approved' OR result.approved_by IS DISTINCT FROM approver OR result.approved_at IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='Z0002', MESSAGE='FAIL: approval identity/time not server-generated';
    END IF;
    BEGIN
      UPDATE public.gdpr_requests SET status='processing' WHERE id=request_id;
      RAISE EXCEPTION USING ERRCODE='Z0002', MESSAGE='FAIL: browser could start processing';
    EXCEPTION WHEN raise_exception THEN NULL;
    END;
    BEGIN
      PERFORM public.approve_gdpr_delete(request_id);
      RAISE EXCEPTION USING ERRCODE='Z0002', MESSAGE='FAIL: duplicate approval succeeded';
    EXCEPTION WHEN raise_exception THEN NULL;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('role','service_role')::text, true);
    BEGIN
      UPDATE public.gdpr_requests SET approved_by=requester WHERE id=request_id;
      RAISE EXCEPTION USING ERRCODE='Z0002', MESSAGE='FAIL: service could rewrite consent';
    EXCEPTION WHEN raise_exception THEN NULL;
    END;
    RAISE EXCEPTION USING ERRCODE='Z0001', MESSAGE='Roll back successful test fixtures';
  EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;
  END;
  RAISE NOTICE 'PASS: forged consent, self approval, personal identity/time, browser processing, replay and service tampering checks';
END;
$$;