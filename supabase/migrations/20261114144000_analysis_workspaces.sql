BEGIN;
ALTER TABLE public.election_analysis_source_reviews ALTER COLUMN sha256 DROP NOT NULL;
ALTER TABLE public.election_analysis_state ADD COLUMN direct_seats integer CHECK(direct_seats>=0),ADD COLUMN list_seats integer CHECK(list_seats>=0);
CREATE TABLE public.election_analysis_scenarios (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),description text NOT NULL DEFAULT '' CHECK(length(description)<=2000),
 visibility text NOT NULL DEFAULT 'private' CHECK(visibility IN('private','tenant')),year integer NOT NULL CHECK(year BETWEEN 1900 AND 2200),ballot text NOT NULL CHECK(ballot IN('single','first','second')),
 model_version text NOT NULL CHECK(model_version IN('shares-v1','bw-lwg-2026-v1')),data_release text NOT NULL CHECK(length(data_release) BETWEEN 1 AND 200),params jsonb NOT NULL DEFAULT '{}',
 input_snapshot jsonb NOT NULL,result_snapshot jsonb NOT NULL,revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(jsonb_typeof(params)='object' AND octet_length(params::text)<=16000),
 CHECK(jsonb_typeof(input_snapshot)='object' AND octet_length(input_snapshot::text)<=1500000),
 CHECK(jsonb_typeof(result_snapshot)='object' AND octet_length(result_snapshot::text)<=750000)
);
CREATE INDEX analysis_scenarios_tenant_updated ON public.election_analysis_scenarios(tenant_id,updated_at DESC);
ALTER TABLE public.election_analysis_scenarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.election_analysis_scenarios FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.election_analysis_scenarios TO authenticated;
CREATE POLICY scenario_read ON public.election_analysis_scenarios FOR SELECT TO authenticated USING(public.is_tenant_member(tenant_id,auth.uid()) AND (owner_id=auth.uid() OR visibility='tenant'));
CREATE POLICY scenario_insert ON public.election_analysis_scenarios FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid() AND public.is_tenant_member(tenant_id,auth.uid()));
CREATE POLICY scenario_update ON public.election_analysis_scenarios FOR UPDATE TO authenticated USING(owner_id=auth.uid() AND public.is_tenant_member(tenant_id,auth.uid())) WITH CHECK(owner_id=auth.uid() AND public.is_tenant_member(tenant_id,auth.uid()));
CREATE POLICY scenario_delete ON public.election_analysis_scenarios FOR DELETE TO authenticated USING(owner_id=auth.uid() AND public.is_tenant_member(tenant_id,auth.uid()));
CREATE FUNCTION public.guard_analysis_scenario() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE pair record;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.tenant_id<>OLD.tenant_id OR NEW.owner_id<>OLD.owner_id OR NEW.id<>OLD.id THEN RAISE EXCEPTION 'Szenario-Eigentümer und Büro sind unveränderlich'; END IF;
  NEW.revision:=OLD.revision+1;NEW.created_at:=OLD.created_at;
 ELSE NEW.revision:=1;NEW.created_at:=now(); END IF;
 NEW.updated_at:=now();
 FOR pair IN SELECT key,value FROM jsonb_each(NEW.params) LOOP
  IF length(pair.key)>160 OR jsonb_typeof(pair.value)<>'string' OR length(pair.value::text)>6000 OR
   NOT(pair.key IN('analysisYear','analysisBallot','analysisSection','researchTool','scenarioMapParty','seatBalancing','seatThresholdParty','seatLotOrder','seatCorrections','seatSpecialFirst') OR pair.key LIKE 'scenarioDelta\_%' ESCAPE '\' OR pair.key LIKE 'seatFirst\_%' ESCAPE '\' OR pair.key LIKE 'seatSecond\_%' ESCAPE '\' OR pair.key LIKE 'seatDirect\_%' ESCAPE '\' OR pair.key LIKE 'seatDistrictLot\_%' ESCAPE '\') THEN
   RAISE EXCEPTION 'Nicht unterstützter oder regionaler Szenarioparameter: %',pair.key;
  END IF;
 END LOOP;
 IF NEW.model_version='bw-lwg-2026-v1' AND (NEW.year<>2026 OR NEW.ballot<>'second') THEN RAISE EXCEPTION 'Wahlrecht nur für 2026 implementiert'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_analysis_scenario BEFORE INSERT OR UPDATE ON public.election_analysis_scenarios FOR EACH ROW EXECUTE FUNCTION public.guard_analysis_scenario();

CREATE TABLE public.election_analysis_local_results (
 year integer NOT NULL REFERENCES public.election_analysis_years(year),ballot text NOT NULL CHECK(ballot IN('single','first','second')),
 district_number integer NOT NULL CHECK(district_number BETWEEN 1 AND 70),unit_type text NOT NULL CHECK(unit_type IN('municipality','ward')),
 unit_key text NOT NULL CHECK(length(unit_key) BETWEEN 8 AND 80 AND unit_key ~ '^[0-9]{8}(:[A-Za-z0-9._-]+)?$'),name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),party text NOT NULL CHECK(length(party) BETWEEN 1 AND 80),
 boundary_key text NOT NULL CHECK(length(boundary_key) BETWEEN 1 AND 160),eligible bigint CHECK(eligible>=0),voters bigint CHECK(voters>=0),valid_votes bigint NOT NULL CHECK(valid_votes>=0),votes bigint NOT NULL CHECK(votes>=0 AND votes<=valid_votes),
 data_release text NOT NULL CHECK(length(data_release) BETWEEN 1 AND 160),source_url text NOT NULL CHECK(source_url LIKE 'https://%'),preliminary boolean NOT NULL,is_verified boolean NOT NULL DEFAULT false,
 PRIMARY KEY(year,ballot,district_number,unit_type,unit_key,party),CHECK(voters IS NULL OR eligible IS NULL OR voters<=eligible),CHECK(voters IS NULL OR valid_votes<=voters),CHECK((unit_type='municipality' AND strpos(unit_key,':')=0) OR(unit_type='ward' AND strpos(unit_key,':')>0)),CHECK((year<2026 AND ballot='single')OR(year>=2026 AND ballot IN('first','second')))
);
ALTER TABLE public.election_analysis_local_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.election_analysis_local_results FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.election_analysis_local_results TO authenticated;
CREATE POLICY local_superadmin ON public.election_analysis_local_results FOR ALL TO authenticated USING(public.is_superadmin(auth.uid())) WITH CHECK(public.is_superadmin(auth.uid()));
CREATE POLICY local_read ON public.election_analysis_local_results FOR SELECT TO authenticated USING(is_verified AND EXISTS(SELECT 1 FROM public.election_analysis_years y WHERE y.year=election_analysis_local_results.year AND y.is_published));
CREATE FUNCTION public.guard_local_result_coherence() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE variants integer;total_votes numeric;valid bigint;
BEGIN
 SELECT count(DISTINCT jsonb_build_array(boundary_key,eligible,voters,valid_votes,data_release,preliminary)),sum(votes),max(valid_votes)
 INTO variants,total_votes,valid FROM public.election_analysis_local_results WHERE year=NEW.year AND ballot=NEW.ballot AND district_number=NEW.district_number AND unit_type=NEW.unit_type AND unit_key=NEW.unit_key;
 IF variants>1 OR total_votes>valid THEN RAISE EXCEPTION 'Gebietsparteien haben widersprüchliche Nenner, Zuschnitte, Datenstände oder Stimmensummen'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER guard_local_result_coherence AFTER INSERT OR UPDATE ON public.election_analysis_local_results DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.guard_local_result_coherence();
CREATE FUNCTION public.get_analysis_local_page(selected_year integer,selected_ballot text,district integer,area_type text,selected_party text,search_text text,page_offset integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF selected_year IS NULL OR selected_ballot IS NULL OR district IS NULL OR area_type IS NULL OR selected_party IS NULL OR length(selected_party)>80 OR page_offset IS NULL OR selected_ballot NOT IN('single','first','second') OR district NOT BETWEEN 1 AND 70 OR area_type NOT IN('municipality','ward') OR length(coalesce(search_text,''))>100 OR page_offset<0 OR page_offset>100000 THEN RAISE EXCEPTION 'Ungültige Gebietsauswahl'; END IF;
 RETURN jsonb_build_object(
  'total',(SELECT count(*) FROM public.election_analysis_local_results r WHERE r.year=selected_year AND r.ballot=selected_ballot AND r.district_number=district AND r.unit_type=area_type AND r.party=selected_party AND strpos(lower(r.name||' '||r.unit_key),lower(coalesce(search_text,'')))>0),
  'rows',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM(SELECT * FROM public.election_analysis_local_results r WHERE r.year=selected_year AND r.ballot=selected_ballot AND r.district_number=district AND r.unit_type=area_type AND r.party=selected_party AND strpos(lower(r.name||' '||r.unit_key),lower(coalesce(search_text,'')))>0 ORDER BY r.name,r.unit_key LIMIT 25 OFFSET page_offset)x),'[]'::jsonb),
  'parties',coalesce((SELECT jsonb_agg(p.party) FROM(SELECT DISTINCT r.party FROM public.election_analysis_local_results r WHERE r.year=selected_year AND r.ballot=selected_ballot AND r.district_number=district AND r.unit_type=area_type ORDER BY r.party LIMIT 60)p),'[]'::jsonb)
 );
END $$;
CREATE FUNCTION public.import_analysis_local_rows(rows_to_import jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE row_data jsonb; incoming public.election_analysis_local_results; existing public.election_analysis_local_results; inserted_count integer:=0;conflict_count integer:=0;identical_count integer:=0;
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins' USING ERRCODE='42501'; END IF;
 IF rows_to_import IS NULL OR jsonb_typeof(rows_to_import)<>'array' OR jsonb_array_length(rows_to_import)>5000 OR octet_length(rows_to_import::text)>4000000 THEN RAISE EXCEPTION 'Höchstens 5.000 Zeilen / 4 MB je Import'; END IF;
 FOR row_data IN SELECT value FROM jsonb_array_elements(rows_to_import) LOOP
  incoming:=jsonb_populate_record(NULL::public.election_analysis_local_results,row_data);
  SELECT * INTO existing FROM public.election_analysis_local_results WHERE year=incoming.year AND ballot=incoming.ballot AND district_number=incoming.district_number AND unit_type=incoming.unit_type AND unit_key=incoming.unit_key AND party=incoming.party FOR UPDATE;
  IF FOUND THEN IF to_jsonb(existing)=to_jsonb(incoming) THEN identical_count:=identical_count+1;ELSE conflict_count:=conflict_count+1;END IF;
  ELSE
   INSERT INTO public.election_analysis_local_results SELECT (incoming).* ON CONFLICT DO NOTHING;
   IF FOUND THEN inserted_count:=inserted_count+1;ELSE conflict_count:=conflict_count+1;END IF;
  END IF;
 END LOOP;
 RETURN jsonb_build_object('inserted',inserted_count,'identical',identical_count,'conflicts',conflict_count,'existing_rows_preserved',true);
END $$;
REVOKE ALL ON FUNCTION public.get_analysis_local_page(integer,text,integer,text,text,text,integer),public.import_analysis_local_rows(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_analysis_local_page(integer,text,integer,text,text,text,integer),public.import_analysis_local_rows(jsonb) TO authenticated;
COMMIT;
