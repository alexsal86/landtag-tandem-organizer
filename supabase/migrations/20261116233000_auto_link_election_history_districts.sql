-- Apply the complete block as one SQL statement (also safe in SQL editors).
DO $auto_history_links$
BEGIN
-- A same-election relationship is independent of cross-year boundary identity.
-- Use positional arguments: election_year is also a period-table column and an
-- unqualified SQL name would resolve to that column instead of the argument.
-- VOLATILE sees period links changed by the statement that fired the trigger.
CREATE OR REPLACE FUNCTION public.match_analysis_history_district(election_year integer, election_district integer)
RETURNS uuid LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=public AS $function$
 SELECT h.id FROM public.election_analysis_years y
 JOIN public.election_history_periods p ON p.id=y.period_id
   AND p.number=y.period_number AND p.election_year=y.year
 JOIN public.election_history_districts h ON h.period_id=p.id AND h.district_number=$2
 WHERE y.year=$1 AND y.year<>1952;
$function$;
REVOKE ALL ON FUNCTION public.match_analysis_history_district(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_analysis_history_district(integer,integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_analysis_period_link() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $function$
BEGIN
 IF NEW.period_id IS NULL THEN
   SELECT p.id INTO NEW.period_id FROM public.election_history_periods p
   WHERE p.number=NEW.period_number AND p.election_year=NEW.year;
 END IF;
 IF NEW.period_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.election_history_periods p
   WHERE p.id=NEW.period_id AND p.number=NEW.period_number AND (p.election_year IS NULL OR p.election_year=NEW.year)) THEN
   RAISE EXCEPTION 'Analysejahr passt nicht zur Legislaturperiode';
 END IF;
 RETURN NEW;
END $function$;

-- Assign and validate in ONE trigger. Separate BEFORE triggers previously
-- allowed the assignment and deployed validation functions to disagree.
DROP TRIGGER IF EXISTS a_analysis_history_auto_link ON public.election_analysis_versions;
CREATE OR REPLACE FUNCTION public.guard_analysis_version_link() RETURNS trigger
LANGUAGE plpgsql VOLATILE SET search_path=public AS $function$
DECLARE matching_id uuid;
BEGIN
 IF NEW.year<>1952 THEN
   SELECT h.id INTO matching_id
   FROM public.election_analysis_years y
   JOIN public.election_history_periods p ON p.id=y.period_id
     AND p.number=y.period_number AND p.election_year=y.year
   JOIN public.election_history_districts h ON h.period_id=p.id
   WHERE y.year=NEW.year AND h.district_number=NEW.district_number;
   IF matching_id IS NOT NULL AND (NEW.historical_district_id IS NULL OR NEW.historical_district_id=matching_id) THEN
     NEW.historical_district_id:=matching_id;
     NEW.history_link_verified:=true;
   END IF;
 END IF;
 IF NEW.history_link_verified AND NOT EXISTS (
   SELECT 1 FROM public.election_history_districts h
   JOIN public.election_history_periods p ON p.id=h.period_id
   JOIN public.election_analysis_years y ON y.year=NEW.year AND y.period_id=p.id
   WHERE h.id=NEW.historical_district_id AND h.district_number=NEW.district_number
     AND p.number=y.period_number AND (p.election_year IS NULL OR p.election_year=y.year)
 ) THEN
   RAISE EXCEPTION 'Historischer Wahlkreis passt nicht zur verknüpften Wahlperiode/Nummer (Jahr %, Nummer %, Historien-ID %)',
     NEW.year,NEW.district_number,NEW.historical_district_id;
 END IF;
 -- Preserve the original, independent geometry validation in full.
 IF NEW.geography_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.election_analysis_geographies g WHERE g.id=NEW.geography_id AND g.year=NEW.year) THEN
   RAISE EXCEPTION 'Geometriejahr passt nicht zur Wahlkreisversion';
 END IF;
 IF NEW.identity_key IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.election_analysis_geographies g WHERE g.id=NEW.geography_id AND g.verified) THEN
   RAISE EXCEPTION 'Geometrie ist nicht verifiziert';
 END IF;
 RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS guard_analysis_version_link ON public.election_analysis_versions;
CREATE TRIGGER guard_analysis_version_link BEFORE INSERT OR UPDATE
 ON public.election_analysis_versions FOR EACH ROW EXECUTE FUNCTION public.guard_analysis_version_link();

CREATE OR REPLACE FUNCTION public.sync_analysis_history_links(selected_year integer)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $function$
BEGIN
 IF selected_year=1952 THEN RETURN; END IF;
 -- Create missing metadata, including when history was imported after results.
 -- This creates no votes, candidates, mandates or cross-year geometry claims.
 INSERT INTO public.election_analysis_versions(year,district_number,district_name,historical_district_id,history_link_verified)
 SELECT y.year,h.district_number,h.name,h.id,true FROM public.election_analysis_years y
 JOIN public.election_history_periods p ON p.id=y.period_id
   AND p.number=y.period_number AND p.election_year=y.year
 JOIN public.election_history_districts h ON h.period_id=p.id
 WHERE y.year=selected_year AND y.year<>1952 AND h.district_number BETWEEN 1 AND 999
 ON CONFLICT (year,district_number) DO NOTHING;

 UPDATE public.election_analysis_versions v SET history_link_verified=false
 WHERE v.year=selected_year AND v.history_link_verified
   AND NOT EXISTS (
     SELECT 1 FROM public.election_history_districts h
     JOIN public.election_history_periods p ON p.id=h.period_id
     JOIN public.election_analysis_years y ON y.period_id=p.id AND y.year=v.year
     WHERE h.id=v.historical_district_id AND h.district_number=v.district_number
       AND p.number=y.period_number AND (p.election_year IS NULL OR p.election_year=y.year)
   );
 UPDATE public.election_analysis_versions v
 SET historical_district_id=h.id,history_link_verified=true
 FROM public.election_analysis_years y
 JOIN public.election_history_periods p ON p.id=y.period_id
   AND p.number=y.period_number AND p.election_year=y.year
 JOIN public.election_history_districts h ON h.period_id=p.id
 WHERE v.year=selected_year AND y.year=v.year AND y.year<>1952 AND h.district_number=v.district_number
   AND (v.historical_district_id IS NULL OR v.historical_district_id=h.id)
   AND (NOT v.history_link_verified OR v.historical_district_id IS NULL);
END $function$;
REVOKE ALL ON FUNCTION public.sync_analysis_history_links(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_analysis_history_links(integer) TO authenticated, service_role;

-- Synchronize only AFTER the whole year INSERT/UPDATE has completed.
-- Transition tables provide the affected years without NEW/OLD row timing.
CREATE OR REPLACE FUNCTION public.sync_analysis_history_on_year() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $function$
DECLARE affected_year integer;
BEGIN
 FOR affected_year IN SELECT DISTINCT changed.year FROM changed_analysis_years changed
 LOOP PERFORM public.sync_analysis_history_links(affected_year); END LOOP;
 IF TG_OP='UPDATE' THEN
   FOR affected_year IN
     SELECT previous.year FROM previous_analysis_years previous
     EXCEPT SELECT changed.year FROM changed_analysis_years changed
   LOOP PERFORM public.sync_analysis_history_links(affected_year); END LOOP;
 END IF;
 RETURN NULL;
END $function$;
DROP TRIGGER IF EXISTS sync_analysis_history_year ON public.election_analysis_years;
DROP TRIGGER IF EXISTS sync_analysis_history_year_insert ON public.election_analysis_years;
DROP TRIGGER IF EXISTS sync_analysis_history_year_update ON public.election_analysis_years;
CREATE TRIGGER sync_analysis_history_year_insert AFTER INSERT ON public.election_analysis_years
 REFERENCING NEW TABLE AS changed_analysis_years
 FOR EACH STATEMENT EXECUTE FUNCTION public.sync_analysis_history_on_year();
CREATE TRIGGER sync_analysis_history_year_update AFTER UPDATE ON public.election_analysis_years
 REFERENCING OLD TABLE AS previous_analysis_years NEW TABLE AS changed_analysis_years
 FOR EACH STATEMENT EXECUTE FUNCTION public.sync_analysis_history_on_year();

CREATE OR REPLACE FUNCTION public.sync_analysis_history_on_district() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $function$
DECLARE old_period uuid; new_period uuid; affected_year integer;
BEGIN
 IF TG_OP<>'INSERT' THEN old_period:=OLD.period_id; END IF;
 IF TG_OP<>'DELETE' THEN new_period:=NEW.period_id; END IF;
 FOR affected_year IN SELECT y.year FROM public.election_analysis_years y
   WHERE y.period_id=old_period OR y.period_id=new_period
 LOOP PERFORM public.sync_analysis_history_links(affected_year); END LOOP;
 RETURN NULL;
END $function$;
DROP TRIGGER IF EXISTS sync_analysis_history_district ON public.election_history_districts;
CREATE TRIGGER sync_analysis_history_district AFTER INSERT OR UPDATE OF period_id,district_number OR DELETE
 ON public.election_history_districts FOR EACH ROW EXECUTE FUNCTION public.sync_analysis_history_on_district();

CREATE OR REPLACE FUNCTION public.sync_analysis_history_on_period() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $function$
DECLARE affected_year integer;
BEGIN
 UPDATE public.election_analysis_years y SET period_id=NEW.id
 WHERE y.period_id IS NULL AND y.period_number=NEW.number AND y.year=NEW.election_year;
 FOR affected_year IN SELECT y.year FROM public.election_analysis_years y WHERE y.period_id=NEW.id
 LOOP PERFORM public.sync_analysis_history_links(affected_year); END LOOP;
 RETURN NULL;
END $function$;
DROP TRIGGER IF EXISTS sync_analysis_history_period ON public.election_history_periods;
CREATE TRIGGER sync_analysis_history_period AFTER INSERT OR UPDATE OF number,election_year
 ON public.election_history_periods FOR EACH ROW EXECUTE FUNCTION public.sync_analysis_history_on_period();

-- Reconcile all existing periods now; no selected-year or per-district clicks.
UPDATE public.election_analysis_years y SET period_id=p.id
FROM public.election_history_periods p
WHERE y.period_id IS NULL AND y.period_number=p.number AND y.year=p.election_year;
DECLARE
 affected_year integer;
BEGIN
 FOR affected_year IN SELECT year FROM public.election_analysis_years
 LOOP PERFORM public.sync_analysis_history_links(affected_year); END LOOP;
END;
END;
$auto_history_links$;
