-- Disposable Supabase database only; fixtures are synthetic and rolled back.
-- Added for later execution. NOT executed in the implementation session.
BEGIN;
INSERT INTO auth.users(id,email,aud,role) VALUES
 ('00000000-0000-0000-0000-00000000b001','synthetic-owner@example.invalid','authenticated','authenticated'),
 ('00000000-0000-0000-0000-00000000b002','synthetic-reader@example.invalid','authenticated','authenticated'),
 ('00000000-0000-0000-0000-00000000b003','synthetic-other@example.invalid','authenticated','authenticated');
INSERT INTO public.tenants(id,name) VALUES('00000000-0000-0000-0000-00000000b010','Synthetic A'),('00000000-0000-0000-0000-00000000b020','Synthetic B');
INSERT INTO public.user_tenant_memberships(user_id,tenant_id,is_active) VALUES
 ('00000000-0000-0000-0000-00000000b001','00000000-0000-0000-0000-00000000b010',true),
 ('00000000-0000-0000-0000-00000000b002','00000000-0000-0000-0000-00000000b010',true),
 ('00000000-0000-0000-0000-00000000b003','00000000-0000-0000-0000-00000000b020',true);
INSERT INTO public.election_analysis_local_results(year,ballot,district_number,unit_type,unit_key,name,party,boundary_key,eligible,voters,valid_votes,votes,data_release,source_url,preliminary,is_verified) VALUES
 (2026,'second',1,'municipality','99999999','Synthetic unit','Synthetic A','synthetic',100,80,70,30,'synthetic','https://example.org/synthetic',false,false),
 (2026,'second',1,'municipality','99999999','Synthetic unit','Synthetic B','synthetic',100,80,70,40,'synthetic','https://example.org/synthetic',false,false);
SET CONSTRAINTS guard_local_result_coherence IMMEDIATE;
DO $$ BEGIN
 BEGIN
  INSERT INTO public.election_analysis_local_results(year,ballot,district_number,unit_type,unit_key,name,party,boundary_key,eligible,voters,valid_votes,votes,data_release,source_url,preliminary,is_verified) VALUES(2026,'second',1,'municipality','99999999','Synthetic unit','Synthetic C','synthetic',100,80,50,1,'synthetic','https://example.org/synthetic',false,false);
  RAISE EXCEPTION 'Incoherent denominator accepted' USING ERRCODE='XX000';
 EXCEPTION WHEN raise_exception THEN NULL; END;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',true);
INSERT INTO public.election_analysis_scenarios(id,tenant_id,owner_id,name,visibility,year,ballot,model_version,data_release,input_snapshot,result_snapshot) VALUES
 ('00000000-0000-0000-0000-00000000b100','00000000-0000-0000-0000-00000000b010','00000000-0000-0000-0000-00000000b001','Synthetic private','private',2026,'second','shares-v1','synthetic','{}','{}'),
 ('00000000-0000-0000-0000-00000000b101','00000000-0000-0000-0000-00000000b010','00000000-0000-0000-0000-00000000b001','Synthetic shared','tenant',2026,'second','shares-v1','synthetic','{}','{}');
UPDATE public.election_analysis_scenarios SET description='revision' WHERE id='00000000-0000-0000-0000-00000000b100' AND revision=1;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.election_analysis_scenarios WHERE id='00000000-0000-0000-0000-00000000b100' AND revision=2) THEN RAISE EXCEPTION 'Revision did not advance'; END IF;
 BEGIN
  UPDATE public.election_analysis_scenarios SET params='{"scenarioDistrict":"1"}' WHERE id='00000000-0000-0000-0000-00000000b100';
  RAISE EXCEPTION 'Regional parameter accepted' USING ERRCODE='XX000';
 EXCEPTION WHEN raise_exception THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b002',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.election_analysis_local_results WHERE unit_key='99999999') THEN RAISE EXCEPTION 'Unverified local result leaked'; END IF;
 IF EXISTS(SELECT 1 FROM public.election_analysis_scenarios WHERE id='00000000-0000-0000-0000-00000000b100') THEN RAISE EXCEPTION 'Private scenario leaked'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.election_analysis_scenarios WHERE id='00000000-0000-0000-0000-00000000b101') THEN RAISE EXCEPTION 'Shared scenario missing'; END IF;
 UPDATE public.election_analysis_scenarios SET name='forbidden' WHERE id='00000000-0000-0000-0000-00000000b101';
 IF FOUND THEN RAISE EXCEPTION 'Non-owner update succeeded'; END IF;
 BEGIN
  PERFORM public.import_analysis_local_rows('[]');RAISE EXCEPTION 'Non-admin central import succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b003',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.election_analysis_scenarios WHERE tenant_id='00000000-0000-0000-0000-00000000b010') THEN RAISE EXCEPTION 'Cross-tenant scenario leaked'; END IF;
END $$;
ROLLBACK;
