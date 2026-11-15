-- Enable the supplied 2006 and 2011 boundary versions without assigning or
-- confirming any legislature automatically. Existing confirmation and RLS apply.
ALTER TABLE public.election_history_periods
  DROP CONSTRAINT election_history_geometry_year,
  ADD CONSTRAINT election_history_geometry_year CHECK (
    boundary_geometry_year IS NULL OR
    (boundary_geometry_year IN (2006, 2011, 2016) AND election_year IS NOT NULL AND election_year = boundary_geometry_year) OR
    (boundary_geometry_year = 2021 AND election_year IS NOT NULL AND election_year IN (2021, 2026))
  );
NOTIFY pgrst, 'reload schema';
