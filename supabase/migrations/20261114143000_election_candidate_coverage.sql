BEGIN;
ALTER TABLE public.election_analysis_candidates ADD COLUMN data_release text;
-- Attestation metadata only; the existing mandate/candidacy register remains the sole source.
CREATE TABLE public.election_analysis_candidate_coverage (
 period_id uuid PRIMARY KEY REFERENCES public.election_history_periods(id) ON DELETE CASCADE,
 is_complete boolean NOT NULL DEFAULT false,
 expected_district_candidacies integer CHECK(expected_district_candidacies>0),
 source_url text, reviewed_at timestamptz, notes text,
 CHECK(NOT is_complete OR (expected_district_candidacies IS NOT NULL AND source_url IS NOT NULL AND source_url LIKE 'https://%' AND reviewed_at IS NOT NULL))
);
ALTER TABLE public.election_analysis_candidate_coverage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.election_analysis_candidate_coverage FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.election_analysis_candidate_coverage TO authenticated;
CREATE POLICY superadmin_write ON public.election_analysis_candidate_coverage FOR ALL TO authenticated USING(public.is_superadmin(auth.uid())) WITH CHECK(public.is_superadmin(auth.uid()));
CREATE POLICY published_read ON public.election_analysis_candidate_coverage FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.election_history_periods p WHERE p.id=period_id AND p.is_published));
CREATE FUNCTION public.guard_election_candidate_coverage() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE actual integer;district_count integer;covered integer;
BEGIN
 IF NEW.is_complete THEN
  SELECT count(*),count(DISTINCT district_id) INTO actual,covered FROM public.election_history_candidacies WHERE period_id=NEW.period_id AND district_id IS NOT NULL;
  SELECT count(*) INTO district_count FROM public.election_history_districts WHERE period_id=NEW.period_id;
  IF NEW.expected_district_candidacies IS NULL OR NEW.source_url IS NULL OR NEW.source_url NOT LIKE 'https://%' OR actual<>NEW.expected_district_candidacies OR district_count=0 OR covered<>district_count
    OR EXISTS(SELECT 1 FROM public.election_history_candidacies WHERE period_id=NEW.period_id AND district_id IS NOT NULL AND (votes IS NULL OR vote_share IS NULL OR outcome='unknown')) THEN
    RAISE EXCEPTION 'Alle Wahlkreiskandidaturen einschließlich erfolgloser Personen mit Stimmen, Anteil und Wahlausgang müssen vollständig vorliegen; Sollzahl und Quelle prüfen';
  END IF;
  NEW.reviewed_at:=now();
 ELSE NEW.reviewed_at:=NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_election_candidate_coverage BEFORE INSERT OR UPDATE ON public.election_analysis_candidate_coverage FOR EACH ROW EXECUTE FUNCTION public.guard_election_candidate_coverage();
CREATE FUNCTION public.invalidate_election_candidate_coverage() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN UPDATE public.election_analysis_candidate_coverage SET is_complete=false WHERE period_id=OLD.period_id AND is_complete; END IF;
 IF TG_OP<>'DELETE' THEN UPDATE public.election_analysis_candidate_coverage SET is_complete=false WHERE period_id=NEW.period_id AND is_complete; END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER invalidate_candidate_coverage AFTER INSERT OR UPDATE OR DELETE ON public.election_history_candidacies FOR EACH ROW EXECUTE FUNCTION public.invalidate_election_candidate_coverage();
CREATE TRIGGER invalidate_district_candidate_coverage AFTER INSERT OR UPDATE OR DELETE ON public.election_history_districts FOR EACH ROW EXECUTE FUNCTION public.invalidate_election_candidate_coverage();
CREATE FUNCTION public.confirm_analysis_candidate_identity(candidacy uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE c public.election_history_candidacies; v public.election_analysis_versions; official public.election_analysis_candidates; first_result public.election_analysis_districts;
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.election_history_candidacies WHERE id=candidacy FOR SHARE;
 IF NOT FOUND OR c.ballot_type<>'first_vote' OR c.votes IS NULL OR c.vote_share IS NULL THEN RAISE EXCEPTION 'Bestätigte Erststimmenkandidatur mit Ergebnis fehlt'; END IF;
 SELECT version.* INTO STRICT v FROM public.election_analysis_versions version JOIN public.election_analysis_years y ON y.year=version.year
 WHERE version.historical_district_id=c.district_id AND version.history_link_verified AND y.period_id=c.period_id FOR SHARE OF version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Wahlkreisverbindung nicht geprüft'; END IF;
 SELECT * INTO first_result FROM public.election_analysis_districts WHERE year=v.year AND district_number=v.district_number AND party=c.party AND ballot='first' AND NOT preliminary FOR SHARE;
 SELECT * INTO official FROM public.election_analysis_candidates WHERE year=v.year AND district_number=v.district_number AND party=c.party AND verified FOR UPDATE;
 IF NOT FOUND OR official.votes IS DISTINCT FROM c.votes OR abs(official.share-c.vote_share)>0.051 OR official.share IS NULL THEN RAISE EXCEPTION 'Amtliche Kandidatur und persönliches Ergebnis passen nicht zusammen'; END IF;
 IF NOT FOUND OR first_result.data_release IS NULL OR first_result.votes IS DISTINCT FROM official.votes OR first_result.share IS NULL OR abs(first_result.share-official.share)>0.051 OR (official.data_release IS NOT NULL AND official.data_release<>first_result.data_release) OR NOT EXISTS(SELECT 1 FROM public.election_analysis_source_reviews WHERE id=first_result.data_release AND status='verified') THEN RAISE EXCEPTION 'Gemeinsamer amtlich bestätigter endgültiger Datenstand fehlt'; END IF;
 IF official.person_id IS NOT NULL AND official.person_id<>c.person_id THEN RAISE EXCEPTION 'Vorhandene Personenverknüpfung zuerst prüfen'; END IF;
 UPDATE public.election_analysis_candidates SET person_id=c.person_id,data_release=first_result.data_release WHERE year=v.year AND district_number=v.district_number AND party=c.party;
END $$;
REVOKE ALL ON FUNCTION public.confirm_analysis_candidate_identity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_analysis_candidate_identity(uuid) TO authenticated;
COMMIT;
