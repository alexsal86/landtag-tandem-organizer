-- Disposable database only, after migrations. Added but not executed in this session.
BEGIN;
INSERT INTO public.election_history_periods(id,number,name,election_year,is_published,is_current) VALUES('00000000-0000-0000-0000-00000000a001',9999,'Coverage fixture',2026,false,false);
INSERT INTO public.election_history_people(id,name) VALUES('00000000-0000-0000-0000-00000000a002','Synthetic unsuccessful candidate');
INSERT INTO public.election_history_districts(id,period_id,district_number,name) VALUES('00000000-0000-0000-0000-00000000a003','00000000-0000-0000-0000-00000000a001',1,'Synthetic district');
INSERT INTO public.election_history_candidacies(id,period_id,person_id,district_id,party,ballot_type,outcome,votes,vote_share) VALUES('00000000-0000-0000-0000-00000000a004','00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-00000000a002','00000000-0000-0000-0000-00000000a003','CDU','first_vote','not_elected',0,0);
INSERT INTO public.election_analysis_candidate_coverage(period_id,is_complete,expected_district_candidacies,source_url) VALUES('00000000-0000-0000-0000-00000000a001',true,1,'https://example.org/synthetic-fixture');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.election_analysis_candidate_coverage WHERE period_id='00000000-0000-0000-0000-00000000a001' AND is_complete AND reviewed_at IS NOT NULL) THEN RAISE EXCEPTION 'Attestation missing'; END IF;
 UPDATE public.election_history_candidacies SET votes=1 WHERE id='00000000-0000-0000-0000-00000000a004';
 IF EXISTS(SELECT 1 FROM public.election_analysis_candidate_coverage WHERE period_id='00000000-0000-0000-0000-00000000a001' AND is_complete) THEN RAISE EXCEPTION 'Attestation not invalidated'; END IF;
 BEGIN
  UPDATE public.election_analysis_candidate_coverage SET is_complete=true,expected_district_candidacies=2 WHERE period_id='00000000-0000-0000-0000-00000000a001';
  RAISE EXCEPTION 'Wrong expected count accepted' USING ERRCODE='XX000';
 EXCEPTION WHEN raise_exception THEN NULL; END;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.election_analysis_candidate_coverage WHERE period_id='00000000-0000-0000-0000-00000000a001') THEN RAISE EXCEPTION 'Draft coverage leaked'; END IF;
 BEGIN
  PERFORM public.confirm_analysis_candidate_identity('00000000-0000-0000-0000-00000000a004');
  RAISE EXCEPTION 'Non-admin identity write succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
