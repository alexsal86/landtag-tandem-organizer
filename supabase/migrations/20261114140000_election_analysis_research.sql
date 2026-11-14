BEGIN;
ALTER TABLE public.election_analysis_years ADD COLUMN period_id uuid REFERENCES public.election_history_periods(id) ON DELETE RESTRICT;
UPDATE public.election_analysis_years y SET period_id=p.id FROM public.election_history_periods p
 WHERE p.number=y.period_number AND (p.election_year IS NULL OR p.election_year=y.year);
ALTER TABLE public.election_analysis_state ADD COLUMN data_release text;
ALTER TABLE public.election_analysis_districts ADD COLUMN data_release text;
ALTER TABLE public.election_analysis_turnout ADD COLUMN data_release text;
UPDATE public.election_analysis_state SET data_release='legacy-final-'||year;
UPDATE public.election_analysis_districts SET data_release='legacy-'||CASE WHEN preliminary THEN 'preliminary-' ELSE 'final-' END||year;
UPDATE public.election_analysis_turnout SET data_release='legacy-'||CASE WHEN preliminary THEN 'preliminary-' ELSE 'final-' END||year;
ALTER TABLE public.election_history_periods ADD COLUMN expected_ends_on date, ADD COLUMN ends_on_is_expected boolean NOT NULL DEFAULT false;
-- Preserve the entered date, but stop presenting a future regular end as an actual exit.
UPDATE public.election_history_periods SET expected_ends_on=ends_on,ends_on_is_expected=true WHERE ends_on>CURRENT_DATE;

CREATE FUNCTION public.guard_expected_election_period_end() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.ends_on>CURRENT_DATE THEN
  NEW.ends_on_is_expected:=true;
  NEW.expected_ends_on:=coalesce(NEW.expected_ends_on,NEW.ends_on);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_expected_election_period_end BEFORE INSERT OR UPDATE ON public.election_history_periods
 FOR EACH ROW EXECUTE FUNCTION public.guard_expected_election_period_end();

-- Keep the shared period relationship explicit even when years are edited later.
CREATE FUNCTION public.guard_analysis_period_link() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.period_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.election_history_periods p
   WHERE p.id=NEW.period_id AND p.number=NEW.period_number AND (p.election_year IS NULL OR p.election_year=NEW.year)) THEN
   RAISE EXCEPTION 'Analysejahr passt nicht zur Legislaturperiode';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_analysis_period_link BEFORE INSERT OR UPDATE ON public.election_analysis_years
 FOR EACH ROW EXECUTE FUNCTION public.guard_analysis_period_link();

CREATE TABLE public.election_analysis_geographies (
 id text PRIMARY KEY, year integer NOT NULL, source_url text NOT NULL CHECK(source_url LIKE 'https://%'),
 sha256 text NOT NULL, asset_path text, verified boolean NOT NULL DEFAULT false, notes text
);
CREATE TABLE public.election_analysis_versions (
 year integer NOT NULL, district_number integer NOT NULL CHECK(district_number BETWEEN 1 AND 999), district_name text NOT NULL,
 geography_id text REFERENCES public.election_analysis_geographies(id) ON DELETE RESTRICT,
 identity_key text, historical_district_id uuid REFERENCES public.election_history_districts(id) ON DELETE RESTRICT,
 history_link_verified boolean NOT NULL DEFAULT false, notes text, PRIMARY KEY(year,district_number),
 CHECK(identity_key IS NULL OR geography_id IS NOT NULL), CHECK(NOT history_link_verified OR historical_district_id IS NOT NULL)
);
INSERT INTO public.election_analysis_versions(year,district_number,district_name,historical_district_id,notes)
SELECT d.year,d.district_number,min(d.district_name), h.id,
 CASE WHEN d.year=2006 AND d.district_number=59 THEN 'Waldshut 2006: rekonstruierter Vergleich auf Zuschnitt 2011; historische Identität nicht geprüft.' ELSE 'Historische Identität noch nicht geprüft.' END
FROM public.election_analysis_districts d JOIN public.election_analysis_years y ON y.year=d.year
LEFT JOIN public.election_history_districts h ON h.period_id=y.period_id AND h.district_number=d.district_number
GROUP BY d.year,d.district_number,h.id;
CREATE INDEX election_analysis_identity ON public.election_analysis_versions(identity_key) WHERE identity_key IS NOT NULL;
CREATE TABLE public.election_analysis_candidates (
 year integer NOT NULL REFERENCES public.election_analysis_years(year), district_number integer NOT NULL,
 party text NOT NULL, candidate_name text NOT NULL, votes bigint CHECK(votes>=0), share numeric CHECK(share BETWEEN 0 AND 100),
 source_url text NOT NULL CHECK(source_url LIKE 'https://%'), verified boolean NOT NULL DEFAULT false,
 person_id uuid REFERENCES public.election_history_people(id) ON DELETE RESTRICT,
 PRIMARY KEY(year,district_number,party), FOREIGN KEY(year,district_number) REFERENCES public.election_analysis_versions(year,district_number)
);
CREATE TABLE public.election_analysis_source_reviews (
 id text PRIMARY KEY, kind text NOT NULL, source_url text NOT NULL CHECK(source_url LIKE 'https://%'), sha256 text NOT NULL,
 retrieved_at timestamptz NOT NULL, status text NOT NULL CHECK(status IN ('pending','verified','conflict')), summary jsonb NOT NULL
);
CREATE TABLE public.election_analysis_period_proposals (
 period_number integer PRIMARY KEY, election_year integer NOT NULL, election_date date, starts_on date, ends_on date,
 expected_ends_on date, election_source_url text NOT NULL, term_source_url text NOT NULL,
 verified boolean NOT NULL DEFAULT false, notes text,
 CHECK(ends_on IS NULL OR starts_on IS NULL OR ends_on>=starts_on),
 CHECK(election_date IS NULL OR starts_on IS NULL OR election_date<=starts_on),
 CHECK(NOT verified OR election_source_url LIKE 'https://%'),
 CHECK(NOT verified OR (starts_on IS NULL AND ends_on IS NULL) OR term_source_url LIKE 'https://%')
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['election_analysis_geographies','election_analysis_versions','election_analysis_candidates','election_analysis_source_reviews','election_analysis_period_proposals'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
  EXECUTE format('CREATE POLICY superadmin_write ON public.%I FOR ALL TO authenticated USING(public.is_superadmin(auth.uid())) WITH CHECK(public.is_superadmin(auth.uid()))',t);
 END LOOP;
END $$;
CREATE POLICY read_verified_geography ON public.election_analysis_geographies FOR SELECT TO authenticated USING(verified);
CREATE POLICY read_analysis_versions ON public.election_analysis_versions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.election_analysis_years y WHERE y.year=election_analysis_versions.year AND y.is_published));
CREATE POLICY read_verified_candidates ON public.election_analysis_candidates FOR SELECT TO authenticated USING(verified AND EXISTS(SELECT 1 FROM public.election_analysis_years y WHERE y.year=election_analysis_candidates.year AND y.is_published));
CREATE POLICY read_verified_reviews ON public.election_analysis_source_reviews FOR SELECT TO authenticated USING(status='verified');
CREATE POLICY read_verified_period_proposals ON public.election_analysis_period_proposals FOR SELECT TO authenticated USING(verified);

CREATE FUNCTION public.guard_analysis_version_link() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.history_link_verified AND NOT EXISTS(SELECT 1 FROM public.election_history_districts h
   JOIN public.election_history_periods p ON p.id=h.period_id
   JOIN public.election_analysis_years y ON y.year=NEW.year AND y.period_id=p.id
   WHERE h.id=NEW.historical_district_id AND h.district_number=NEW.district_number) THEN
   RAISE EXCEPTION 'Historischer Wahlkreis passt nicht zur verknüpften Wahlperiode/Nummer';
 END IF;
 IF NEW.geography_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.election_analysis_geographies g WHERE g.id=NEW.geography_id AND g.year=NEW.year) THEN
   RAISE EXCEPTION 'Geometriejahr passt nicht zur Wahlkreisversion';
 END IF;
 IF NEW.identity_key IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.election_analysis_geographies g WHERE g.id=NEW.geography_id AND g.verified) THEN
   RAISE EXCEPTION 'Geometrie ist nicht verifiziert';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_analysis_version_link BEFORE INSERT OR UPDATE ON public.election_analysis_versions FOR EACH ROW EXECUTE FUNCTION public.guard_analysis_version_link();

CREATE FUNCTION public.get_analysis_district_series(district integer, selected_years integer[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF district IS NULL OR district NOT BETWEEN 1 AND 70 OR selected_years IS NULL OR cardinality(selected_years)=0 OR cardinality(selected_years)>10 THEN RAISE EXCEPTION 'Ungültiger Wahlkreis oder zu viele Wahljahre'; END IF;
 RETURN jsonb_build_object(
  'results',coalesce((SELECT jsonb_agg(to_jsonb(d)) FROM public.election_analysis_districts d WHERE d.district_number=district AND d.year=ANY(selected_years)),'[]'::jsonb),
  'turnout',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.election_analysis_turnout t WHERE t.district_number=district AND t.year=ANY(selected_years)),'[]'::jsonb),
  'state',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM public.election_analysis_state s WHERE s.year=ANY(selected_years)),'[]'::jsonb),
  'versions',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM public.election_analysis_versions v WHERE v.district_number=district AND v.year=ANY(selected_years)),'[]'::jsonb)
 );
END $$;
CREATE FUNCTION public.get_analysis_comparison(before_year integer,after_year integer,before_ballot text,after_ballot text,selected_parties text[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF selected_parties IS NULL OR cardinality(selected_parties)>5 OR cardinality(selected_parties)=0 OR NOT selected_parties<@ARRAY['CDU','GRÜNE','SPD','FDP','AfD']::text[] THEN RAISE EXCEPTION 'Ungültige Parteiauswahl'; END IF;
 IF before_ballot NOT IN('single','first','second') OR after_ballot NOT IN('single','first','second') THEN RAISE EXCEPTION 'Ungültige Stimmenart'; END IF;
 RETURN jsonb_build_object(
  'results',coalesce((SELECT jsonb_agg(to_jsonb(d)) FROM public.election_analysis_districts d WHERE d.party=ANY(selected_parties) AND ((d.year=before_year AND d.ballot=before_ballot) OR (d.year=after_year AND d.ballot=after_ballot))),'[]'::jsonb),
  'turnout','[]'::jsonb,
  'state',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM public.election_analysis_state s WHERE s.party=ANY(selected_parties) AND ((s.year=before_year AND s.ballot=before_ballot) OR(s.year=after_year AND s.ballot=after_ballot))),'[]'::jsonb),
  'versions',coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM public.election_analysis_versions v WHERE v.year IN(before_year,after_year)),'[]'::jsonb)
 );
END $$;
CREATE FUNCTION public.get_analysis_district_history(district integer,selected_year integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF district IS NULL OR district NOT BETWEEN 1 AND 70 OR selected_year IS NULL THEN RAISE EXCEPTION 'Ungültige Wahlkreisauswahl'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
  'period_id',p.id,'period_name',p.name,'period_number',p.number,'district_id',h.id,'district_name',h.name,
  'mandate_id',m.id,'person_id',m.person_id,'person_name',coalesce(person.name,m.person_name),'party',m.party,
  'mandate_type',m.mandate_type,'original_mandate',m.original_mandate,'entry_type',m.entry_type,
  'starts_on',m.starts_on,'ends_on',m.ends_on,'start_from_period',m.start_from_period,'end_from_period',m.end_from_period,
  'end_is_expected',m.end_from_period AND p.ends_on_is_expected,'notes',m.notes) ORDER BY p.number DESC)
 FROM public.election_analysis_versions v JOIN public.election_history_districts h ON h.id=v.historical_district_id
 JOIN public.election_history_periods p ON p.id=h.period_id JOIN public.election_history_mandates m ON m.district_id=h.id
 LEFT JOIN public.election_history_people person ON person.id=m.person_id
 WHERE v.history_link_verified AND p.is_published AND (v.year=selected_year AND v.district_number=district OR
  v.identity_key IS NOT NULL AND v.identity_key IN(SELECT anchor.identity_key FROM public.election_analysis_versions anchor WHERE anchor.year=selected_year AND anchor.district_number=district AND anchor.identity_key IS NOT NULL))), '[]'::jsonb);
END $$;
CREATE FUNCTION public.apply_verified_election_period(period_number_to_apply integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE proposal public.election_analysis_period_proposals; current_row public.election_history_periods; changed public.election_history_periods;
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins' USING ERRCODE='42501'; END IF;
 SELECT * INTO proposal FROM public.election_analysis_period_proposals WHERE period_number=period_number_to_apply AND verified;
 IF NOT FOUND THEN RAISE EXCEPTION 'Kein amtlich bestätigter Terminvorschlag'; END IF;
 SELECT * INTO current_row FROM public.election_history_periods WHERE number=period_number_to_apply FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Legislaturperiode fehlt'; END IF;
 IF current_row.election_year IS NOT NULL AND current_row.election_year<>proposal.election_year THEN RAISE EXCEPTION 'Vorhandenes Wahljahr widerspricht dem Vorschlag; zuerst manuell prüfen'; END IF;
 -- Fill only missing values; never replace already entered/confirmed dates.
 UPDATE public.election_history_periods SET
  election_year=coalesce(election_year,proposal.election_year),election_date=coalesce(election_date,proposal.election_date),
  starts_on=coalesce(starts_on,proposal.starts_on),ends_on=coalesce(ends_on,proposal.ends_on),
  expected_ends_on=coalesce(expected_ends_on,proposal.expected_ends_on),source_url=coalesce(nullif(source_url,''),nullif(proposal.term_source_url,''),proposal.election_source_url)
 WHERE id=current_row.id RETURNING * INTO changed;
 RETURN jsonb_build_object('before',to_jsonb(current_row),'after',to_jsonb(changed),'existing_dates_preserved',true);
END $$;
REVOKE ALL ON FUNCTION public.get_analysis_district_series(integer,integer[]),public.get_analysis_comparison(integer,integer,text,text,text[]),public.get_analysis_district_history(integer,integer),public.apply_verified_election_period(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_analysis_district_series(integer,integer[]),public.get_analysis_comparison(integer,integer,text,text,text[]),public.get_analysis_district_history(integer,integer),public.apply_verified_election_period(integer) TO authenticated;
COMMIT;
