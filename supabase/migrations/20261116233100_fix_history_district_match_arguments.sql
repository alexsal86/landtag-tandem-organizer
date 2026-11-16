-- Forward repair for databases where the original automatic linking migration
-- was already installed. On a failed original migration, rerun its corrected
-- complete block first; this repair does not install the other linking triggers.
DO $repair_history_match$
BEGIN
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

IF to_regprocedure('public.sync_analysis_history_links(integer)') IS NOT NULL THEN
  UPDATE public.election_analysis_years y SET period_id=p.id
  FROM public.election_history_periods p
  WHERE y.period_id IS NULL AND y.period_number=p.number AND y.year=p.election_year;
  DECLARE affected_year integer;
  BEGIN
    FOR affected_year IN SELECT year FROM public.election_analysis_years
    LOOP PERFORM public.sync_analysis_history_links(affected_year); END LOOP;
  END;
END IF;
END;
$repair_history_match$;
