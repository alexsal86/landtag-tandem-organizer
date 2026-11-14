-- Integration assertions for a disposable Supabase database AFTER migrations.
-- Not executed in the implementation session. Never run against production.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
DO $$ BEGIN
 BEGIN
  PERFORM public.get_analysis_turnout_comparison(2021,2026,'second','second','CDU');
  RAISE EXCEPTION 'Invalid ballot/year combination accepted' USING ERRCODE='XX000';
 EXCEPTION WHEN raise_exception THEN NULL; END;
 IF public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Fixture must not be a superadmin'; END IF;
 IF EXISTS(SELECT 1 FROM public.election_analysis_candidates WHERE NOT verified) THEN RAISE EXCEPTION 'Unverified candidate leaked'; END IF;
 IF EXISTS(SELECT 1 FROM public.election_analysis_geographies WHERE NOT verified) THEN RAISE EXCEPTION 'Unverified geometry leaked'; END IF;
 IF EXISTS(SELECT 1 FROM public.election_analysis_source_reviews WHERE status<>'verified') THEN RAISE EXCEPTION 'Unverified source review leaked'; END IF;
 BEGIN
  INSERT INTO public.election_analysis_geographies(id,year,source_url,sha256) VALUES('access-test',2026,'https://example.org','not-a-source');
  RAISE EXCEPTION 'Non-superadmin write succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.apply_verified_election_period(18);
  RAISE EXCEPTION 'Non-superadmin period update succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.get_analysis_district_series(1,ARRAY[2006,2011,2016,2021,2026,2027,2028,2029,2030,2031,2032]);
  RAISE EXCEPTION 'Unbounded year selection succeeded' USING ERRCODE='XX000';
 EXCEPTION WHEN raise_exception THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
  PERFORM public.get_analysis_turnout_comparison(2021,2026,'single','second','CDU');
  RAISE EXCEPTION 'Anonymous turnout RPC succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.get_analysis_district_series(1,ARRAY[2026]);
  RAISE EXCEPTION 'Anonymous RPC succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
