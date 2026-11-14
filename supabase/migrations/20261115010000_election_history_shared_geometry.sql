-- References only: historical boundaries continue to live in the shared asset.
ALTER TABLE public.election_history_periods
  ADD COLUMN boundary_geometry_year integer,
  ADD COLUMN boundary_geometry_confirmed boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT election_history_geometry_year CHECK (
    boundary_geometry_year IS NULL OR
    (boundary_geometry_year = 2016 AND election_year IS NOT NULL AND election_year = 2016) OR
    (boundary_geometry_year = 2021 AND election_year IS NOT NULL AND election_year IN (2021, 2026))
  ),
  ADD CONSTRAINT election_history_geometry_confirmation CHECK (
    NOT boundary_geometry_confirmed OR boundary_geometry_year IS NOT NULL
  );
COMMENT ON COLUMN public.election_history_periods.boundary_geometry_confirmed IS
  'Superadmin confirmation that the selected source boundary version and district-number assignment describe this legislature. Existing superadmin RLS and election-history audit apply.';
-- No automatic assignment or confirmation of existing periods.
NOTIFY pgrst, 'reload schema';

-- Editing district-number assignments requires a fresh confirmation.
CREATE FUNCTION public.invalidate_election_history_geometry() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.period_id IS NOT DISTINCT FROM OLD.period_id
       AND NEW.district_number IS NOT DISTINCT FROM OLD.district_number THEN
      RETURN NEW;
    END IF;
  END IF;
  IF TG_OP <> 'INSERT' THEN
    UPDATE public.election_history_periods SET boundary_geometry_confirmed = false
      WHERE id = OLD.period_id AND boundary_geometry_confirmed;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    UPDATE public.election_history_periods SET boundary_geometry_confirmed = false
      WHERE id = NEW.period_id AND boundary_geometry_confirmed;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_election_history_geometry() FROM PUBLIC;
CREATE TRIGGER election_history_invalidate_geometry
AFTER INSERT OR UPDATE OR DELETE ON public.election_history_districts
FOR EACH ROW EXECUTE FUNCTION public.invalidate_election_history_geometry();
