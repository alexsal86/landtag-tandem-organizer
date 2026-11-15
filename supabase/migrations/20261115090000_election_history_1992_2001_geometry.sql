-- Additional selected-year manifests; never infer historical assignments or
-- confirmations from the existence of a source file or matching shape alone.
ALTER TABLE public.election_history_periods
  DROP CONSTRAINT election_history_geometry_year,
  ADD CONSTRAINT election_history_geometry_year CHECK (
    boundary_geometry_year IS NULL OR
    (boundary_geometry_year IN (1992, 1996, 2001, 2006, 2011, 2016)
      AND election_year IS NOT NULL AND election_year = boundary_geometry_year) OR
    (boundary_geometry_year = 2021 AND election_year IS NOT NULL AND election_year IN (2021, 2026))
  );
NOTIFY pgrst, 'reload schema';
