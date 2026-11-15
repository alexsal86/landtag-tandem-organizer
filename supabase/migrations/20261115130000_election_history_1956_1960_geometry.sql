-- Explicit 1956 -> 1960 boundary alias. Equal reconstructed coordinates in
-- later source files do not imply verified original historical identities.
ALTER TABLE public.election_history_periods
  DROP CONSTRAINT election_history_geometry_year,
  ADD CONSTRAINT election_history_geometry_year CHECK (
    boundary_geometry_year IS NULL OR
    (boundary_geometry_year IN (1972, 1992, 1996, 2001, 2006, 2011, 2016)
      AND election_year IS NOT NULL AND election_year = boundary_geometry_year) OR
    (boundary_geometry_year = 1960 AND election_year IS NOT NULL AND election_year IN (1956, 1960)) OR
    (boundary_geometry_year = 1968 AND election_year IS NOT NULL AND election_year IN (1964, 1968)) OR
    (boundary_geometry_year = 1988 AND election_year IS NOT NULL AND election_year IN (1976, 1980, 1984, 1988)) OR
    (boundary_geometry_year = 2021 AND election_year IS NOT NULL AND election_year IN (2021, 2026))
  );

-- Explicit source lists have the same 1–70 labels; this reuses names only.
CREATE OR REPLACE FUNCTION public.election_history_source_district_name(source_year integer, source_number integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN source_year IN (1976, 1980, 1984, 1988) AND source_number = 37 THEN 'Mannheim III'
    WHEN source_year IN (1956, 1960, 1964, 1968, 1972) THEN (SELECT v.name FROM (VALUES
    (1, 'Stuttgart I'),
    (2, 'Stuttgart II'),
    (3, 'Stuttgart III'),
    (4, 'Stuttgart IV'),
    (5, 'Stuttgart V'),
    (6, 'Heilbronn-Stadt'),
    (7, 'Ulm-Stadt'),
    (8, 'Böblingen'),
    (9, 'Leonberg'),
    (10, 'Ludwigsburg I'),
    (11, 'Ludwigsburg II'),
    (12, 'Heilbronn-Land I'),
    (13, 'Heilbronn-Land II'),
    (14, 'Öhringen'),
    (15, 'Crailsheim'),
    (16, 'Aalen'),
    (17, 'Heidenheim'),
    (18, 'Ulm-Land'),
    (19, 'Göppingen I'),
    (20, 'Göppingen II'),
    (21, 'Schwäbisch Gmünd'),
    (22, 'Backnang'),
    (23, 'Waiblingen I'),
    (24, 'Waiblingen II'),
    (25, 'Esslingen I'),
    (26, 'Esslingen II'),
    (27, 'Nürtingen'),
    (28, 'Karlsruhe-Stadt I'),
    (29, 'Karlsruhe-Stadt II'),
    (30, 'Heidelberg-Stadt'),
    (31, 'Mannheim-Stadt I'),
    (32, 'Mannheim-Stadt II'),
    (33, 'Mannheim-Stadt III'),
    (34, 'Karlsruhe-Land I'),
    (35, 'Karlsruhe-Land II'),
    (36, 'Pforzheim'),
    (37, 'Bruchsal'),
    (38, 'Mannheim-Land I'),
    (39, 'Mannheim-Land II'),
    (40, 'Heidelberg-Land'),
    (41, 'Sinsheim'),
    (42, 'Mosbach'),
    (43, 'Tauberbischofsheim'),
    (44, 'Freiburg-Stadt'),
    (45, 'Überlingen'),
    (46, 'Konstanz I'),
    (47, 'Konstanz II'),
    (48, 'Donaueschingen'),
    (49, 'Waldshut'),
    (50, 'Lörrach'),
    (51, 'Freiburg-Land'),
    (52, 'Emmendingen'),
    (53, 'Villingen'),
    (54, 'Lahr'),
    (55, 'Offenburg'),
    (56, 'Baden-Baden'),
    (57, 'Rastatt'),
    (58, 'Tübingen'),
    (59, 'Calw'),
    (60, 'Freudenstadt'),
    (61, 'Rottweil'),
    (62, 'Tuttlingen'),
    (63, 'Balingen'),
    (64, 'Hechingen'),
    (65, 'Reutlingen'),
    (66, 'Ehingen'),
    (67, 'Saulgau'),
    (68, 'Biberach'),
    (69, 'Ravensburg'),
    (70, 'Wangen')
    ) AS v(number, name) WHERE v.number = source_number)
    ELSE NULL
  END;
$$;
REVOKE ALL ON FUNCTION public.election_history_source_district_name(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.election_history_source_district_name(integer, integer) TO authenticated;



UPDATE public.election_history_districts d
SET name = public.election_history_source_district_name(p.election_year, d.district_number)
FROM public.election_history_periods p
WHERE p.id = d.period_id AND p.election_year IN (1956, 1960)
  AND public.election_history_source_district_name(p.election_year, d.district_number) IS NOT NULL
  AND d.name IS DISTINCT FROM public.election_history_source_district_name(p.election_year, d.district_number);

INSERT INTO public.election_history_districts(period_id, district_number, name, boundary_note, source_url)
SELECT p.id, districts.number, public.election_history_source_district_name(p.election_year, districts.number),
  'Historische Rekonstruktion aus Quelle 1960 (Gebietsstand 15.05.1960); für 1956 identische Grenzen bestätigt. Moderne Gemarkungen und spätere Stadtteilgrenzen enthalten Näherungen. Zuordnungen separat prüfen.',
  'https://d-nb.info/1278245642/34'
FROM public.election_history_periods p CROSS JOIN generate_series(1, 70) AS districts(number)
WHERE p.election_year IN (1956, 1960)
ON CONFLICT (period_id, district_number) DO NOTHING;

-- The existing source-name trigger uses the expanded lookup. No renumbering,
-- merging, or reassignment of personal/mandate/candidacy records takes place.
UPDATE public.election_history_periods SET boundary_geometry_confirmed = false
WHERE election_year IN (1956, 1960) AND boundary_geometry_confirmed;
NOTIFY pgrst, 'reload schema';
