BEGIN;
-- Independent analysis register. No mandate, person or legislature rows are changed.
CREATE TABLE public.election_analysis_years (
 year integer PRIMARY KEY CHECK(year BETWEEN 1900 AND 2200), period_number integer NOT NULL CHECK(period_number>0),
 is_published boolean NOT NULL DEFAULT false, notes text
);
CREATE TABLE public.election_analysis_state (
 year integer NOT NULL REFERENCES public.election_analysis_years(year) ON DELETE RESTRICT,
 ballot text NOT NULL CHECK(ballot IN ('single','first','second')), party text NOT NULL,
 votes bigint CHECK(votes>=0), share numeric(9,5) CHECK(share BETWEEN 0 AND 100),
 seats integer CHECK(seats>=0), valid_votes bigint CHECK(valid_votes>=0), notes text,
 PRIMARY KEY(year,ballot,party), CHECK(votes IS NULL OR valid_votes IS NULL OR votes<=valid_votes),
 CHECK(ballot<>'first' OR seats IS NULL)
);
CREATE TABLE public.election_analysis_districts (
 year integer NOT NULL REFERENCES public.election_analysis_years(year) ON DELETE RESTRICT,
 ballot text NOT NULL CHECK(ballot IN ('single','first','second')),
 district_number integer NOT NULL CHECK(district_number>0), district_name text NOT NULL, party text NOT NULL,
 votes bigint CHECK(votes>=0), share numeric(9,5) CHECK(share BETWEEN 0 AND 100),
 preliminary boolean NOT NULL DEFAULT false, notes text,
 PRIMARY KEY(year,ballot,district_number,party)
);
CREATE TABLE public.election_analysis_turnout (
 year integer NOT NULL REFERENCES public.election_analysis_years(year) ON DELETE RESTRICT,
 ballot text NOT NULL CHECK(ballot IN ('single','first','second')),
 district_number integer NOT NULL CHECK(district_number>0), district_name text NOT NULL,
 eligible bigint CHECK(eligible>=0), voters bigint CHECK(voters>=0), valid_votes bigint CHECK(valid_votes>=0),
 turnout numeric(9,5) CHECK(turnout BETWEEN 0 AND 100), preliminary boolean NOT NULL DEFAULT false, notes text,
 PRIMARY KEY(year,ballot,district_number), CHECK(voters IS NULL OR eligible IS NULL OR voters<=eligible),
 CHECK(valid_votes IS NULL OR voters IS NULL OR valid_votes<=voters)
);
CREATE TABLE public.election_analysis_flows (
 year integer NOT NULL REFERENCES public.election_analysis_years(year) ON DELETE RESTRICT,
 previous_year integer NOT NULL CHECK(previous_year<year), target_party text NOT NULL, partner text NOT NULL,
 inflow bigint CHECK(inflow>=0), outflow bigint CHECK(outflow>=0), balance bigint, notes text,
 PRIMARY KEY(year,previous_year,target_party,partner), CHECK(inflow IS NULL OR outflow IS NULL OR balance IS NULL OR balance=inflow-outflow)
);
CREATE TABLE public.election_analysis_demographics (
 year integer NOT NULL REFERENCES public.election_analysis_years(year) ON DELETE RESTRICT,
 ballot text NOT NULL CHECK(ballot IN ('single','first','second')), party text NOT NULL,
 gender text NOT NULL, age_group text NOT NULL, share numeric(9,5) CHECK(share BETWEEN 0 AND 100), notes text,
 PRIMARY KEY(year,ballot,party,gender,age_group)
);
CREATE INDEX election_analysis_flow_selection ON public.election_analysis_flows(year,target_party);
CREATE INDEX election_analysis_demographic_selection ON public.election_analysis_demographics(year,ballot,gender);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['election_analysis_years','election_analysis_state','election_analysis_districts','election_analysis_turnout','election_analysis_flows','election_analysis_demographics'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
  EXECUTE format('CREATE POLICY superadmin_write ON public.%I FOR ALL TO authenticated USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()))',t);
  IF t='election_analysis_years' THEN
   EXECUTE format('CREATE POLICY published_read ON public.%I FOR SELECT TO authenticated USING (is_published)',t);
  ELSE
   EXECUTE format('CREATE POLICY published_read ON public.%I FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.election_analysis_years y WHERE y.year=%I.year AND y.is_published))',t,t);
  END IF;
 END LOOP;
END $$;
COMMIT;
