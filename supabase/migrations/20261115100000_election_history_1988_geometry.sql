-- 1988's district 37 is Mannheim III, not the later district Wiesloch.
-- The source has exactly 70 districts: do not create an extra district or
-- replace any district IDs/mandate links based on matching names or numbers.
ALTER TABLE public.election_history_periods
  DROP CONSTRAINT election_history_geometry_year,
  ADD CONSTRAINT election_history_geometry_year CHECK (
    boundary_geometry_year IS NULL OR
    (boundary_geometry_year IN (1988, 1992, 1996, 2001, 2006, 2011, 2016)
      AND election_year IS NOT NULL AND election_year = boundary_geometry_year) OR
    (boundary_geometry_year = 2021 AND election_year IS NOT NULL AND election_year IN (2021, 2026))
  );

CREATE FUNCTION public.guard_election_history_1988_district_name() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.election_history_periods p WHERE p.id = NEW.period_id AND p.election_year = 1988) THEN
    IF NEW.district_number = 37 THEN
      NEW.name := 'Mannheim III';
    ELSIF lower(btrim(NEW.name)) = 'wiesloch' THEN
      RAISE EXCEPTION '1988 existiert kein eigener Wahlkreis Wiesloch; Wahlkreis 37 ist Mannheim III.' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_election_history_1988_district_name() FROM PUBLIC;
CREATE TRIGGER election_history_1988_district_name
BEFORE INSERT OR UPDATE ON public.election_history_districts
FOR EACH ROW EXECUTE FUNCTION public.guard_election_history_1988_district_name();

UPDATE public.election_history_districts d SET name = 'Mannheim III'
FROM public.election_history_periods p
WHERE p.id = d.period_id AND p.election_year = 1988 AND d.district_number = 37
  AND d.name IS DISTINCT FROM 'Mannheim III';

-- No automatic period assignment or confirmation, no later-year renaming.
NOTIFY pgrst, 'reload schema';
