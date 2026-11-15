-- 1952 has 74 technical IDs but region-scoped historical numbering. Never
-- associate an existing mandate or district by a bare technical ID.
ALTER TABLE public.election_history_periods
  DROP CONSTRAINT election_history_geometry_year,
  ADD CONSTRAINT election_history_geometry_year CHECK (
    boundary_geometry_year IS NULL OR
    (boundary_geometry_year IN (1952, 1972, 1992, 1996, 2001, 2006, 2011, 2016)
      AND election_year IS NOT NULL AND election_year = boundary_geometry_year) OR
    (boundary_geometry_year = 1960 AND election_year IS NOT NULL AND election_year IN (1956, 1960)) OR
    (boundary_geometry_year = 1968 AND election_year IS NOT NULL AND election_year IN (1964, 1968)) OR
    (boundary_geometry_year = 1988 AND election_year IS NOT NULL AND election_year IN (1976, 1980, 1984, 1988)) OR
    (boundary_geometry_year = 2021 AND election_year IS NOT NULL AND election_year IN (2021, 2026))
  );
ALTER TABLE public.election_history_districts ADD COLUMN geometry_source_key text;
ALTER TABLE public.election_history_districts ADD CONSTRAINT election_history_geometry_source_key
  CHECK (geometry_source_key IS NULL OR geometry_source_key ~ '^1952:(NW|NB|SB|SWH):[1-9][0-9]?$');
CREATE UNIQUE INDEX election_history_district_source_unique
  ON public.election_history_districts(period_id, geometry_source_key) WHERE geometry_source_key IS NOT NULL;

CREATE FUNCTION public.election_history_1952_source()
RETURNS TABLE(source_key text, technical_number integer, region text, historical_number integer, name text)
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT * FROM (VALUES
    ('1952:NW:1', 1, 'NW', 1, 'Stuttgart I'),
    ('1952:NW:2', 2, 'NW', 2, 'Stuttgart II'),
    ('1952:NW:3', 3, 'NW', 3, 'Stuttgart III'),
    ('1952:NW:4', 4, 'NW', 4, 'Stuttgart IV'),
    ('1952:NW:5', 5, 'NW', 5, 'Stuttgart V'),
    ('1952:NW:6', 6, 'NW', 6, 'Heilbronn-Stadt'),
    ('1952:NW:7', 7, 'NW', 7, 'Ulm-Stadt'),
    ('1952:NW:8', 8, 'NW', 8, 'Aalen'),
    ('1952:NW:9', 9, 'NW', 9, 'Backnang'),
    ('1952:NW:10', 10, 'NW', 10, 'Böblingen'),
    ('1952:NW:11', 11, 'NW', 11, 'Crailsheim'),
    ('1952:NW:12', 12, 'NW', 12, 'Esslingen I'),
    ('1952:NW:13', 13, 'NW', 13, 'Esslingen II'),
    ('1952:NW:14', 14, 'NW', 14, 'Göppingen I'),
    ('1952:NW:15', 15, 'NW', 15, 'Göppingen II'),
    ('1952:NW:16', 16, 'NW', 16, 'Heidenheim'),
    ('1952:NW:17', 17, 'NW', 17, 'Heilbronn-Land I'),
    ('1952:NW:18', 18, 'NW', 18, 'Heilbronn-Land II'),
    ('1952:NW:19', 19, 'NW', 19, 'Leonberg'),
    ('1952:NW:20', 20, 'NW', 20, 'Ludwigsburg I'),
    ('1952:NW:21', 21, 'NW', 21, 'Ludwigsburg II'),
    ('1952:NW:22', 22, 'NW', 22, 'Nürtingen'),
    ('1952:NW:23', 23, 'NW', 23, 'Öhringen'),
    ('1952:NW:24', 24, 'NW', 24, 'Schwäbisch Gmünd'),
    ('1952:NW:25', 25, 'NW', 25, 'Ulm-Land'),
    ('1952:NW:26', 26, 'NW', 26, 'Vaihingen/Enz'),
    ('1952:NW:27', 27, 'NW', 27, 'Waiblingen I'),
    ('1952:NW:28', 28, 'NW', 28, 'Waiblingen II'),
    ('1952:NB:29', 29, 'NB', 29, 'Karlsruhe-Stadt I'),
    ('1952:NB:30', 30, 'NB', 30, 'Karlsruhe-Stadt II'),
    ('1952:NB:31', 31, 'NB', 31, 'Heidelberg-Stadt'),
    ('1952:NB:32', 32, 'NB', 32, 'Mannheim-Stadt I'),
    ('1952:NB:33', 33, 'NB', 33, 'Mannheim-Stadt II'),
    ('1952:NB:34', 34, 'NB', 34, 'Mannheim-Stadt III'),
    ('1952:NB:35', 35, 'NB', 35, 'Bruchsal'),
    ('1952:NB:36', 36, 'NB', 36, 'Buchen'),
    ('1952:NB:37', 37, 'NB', 37, 'Heidelberg-Land'),
    ('1952:NB:38', 38, 'NB', 38, 'Karlsruhe-Land I'),
    ('1952:NB:39', 39, 'NB', 39, 'Karlsruhe-Land II'),
    ('1952:NB:40', 40, 'NB', 40, 'Mannheim-Land I'),
    ('1952:NB:41', 41, 'NB', 41, 'Mannheim-Land II'),
    ('1952:NB:42', 42, 'NB', 42, 'Mosbach'),
    ('1952:NB:43', 43, 'NB', 43, 'Pforzheim'),
    ('1952:NB:44', 44, 'NB', 44, 'Sinsheim'),
    ('1952:NB:45', 45, 'NB', 45, 'Tauberbischofsheim'),
    ('1952:SB:1', 46, 'SB', 1, 'Überlingen-Meßkirch'),
    ('1952:SB:2', 47, 'SB', 2, 'Stockach-Engen'),
    ('1952:SB:3', 48, 'SB', 3, 'Konstanz Stadt und Land'),
    ('1952:SB:4', 49, 'SB', 4, 'Donaueschingen-Neustadt'),
    ('1952:SB:5', 50, 'SB', 5, 'Villingen-Wolfach'),
    ('1952:SB:6', 51, 'SB', 6, 'Waldshut-Säckingen'),
    ('1952:SB:7', 52, 'SB', 7, 'Freiburg und westliche Vororte'),
    ('1952:SB:8', 53, 'SB', 8, 'Freiburg-Stadt'),
    ('1952:SB:9', 54, 'SB', 9, 'Müllheim-Lörrach'),
    ('1952:SB:10', 55, 'SB', 10, 'Lörrach'),
    ('1952:SB:11', 56, 'SB', 11, 'Emmendingen'),
    ('1952:SB:12', 57, 'SB', 12, 'Lahr'),
    ('1952:SB:13', 58, 'SB', 13, 'Offenburg'),
    ('1952:SB:14', 59, 'SB', 14, 'Kehl-Achern'),
    ('1952:SB:15', 60, 'SB', 15, 'Rastatt'),
    ('1952:SB:16', 61, 'SB', 16, 'Baden-Baden-Bühl'),
    ('1952:SWH:1', 62, 'SWH', 1, 'Reutlingen ohne Urach'),
    ('1952:SWH:2', 63, 'SWH', 2, 'Tübingen'),
    ('1952:SWH:3', 64, 'SWH', 3, 'Calw'),
    ('1952:SWH:4', 65, 'SWH', 4, 'Freudenstadt-Horb'),
    ('1952:SWH:5', 66, 'SWH', 5, 'Rottweil ohne Schwenningen'),
    ('1952:SWH:6', 67, 'SWH', 6, 'Tuttlingen mit Schwenningen und Wilflingen'),
    ('1952:SWH:7', 68, 'SWH', 7, 'Balingen'),
    ('1952:SWH:8', 69, 'SWH', 8, 'Hechingen-Sigmaringen ohne Wilflingen'),
    ('1952:SWH:9', 70, 'SWH', 9, 'Münsingen-Ehingen-Urach'),
    ('1952:SWH:10', 71, 'SWH', 10, 'Biberach ohne Schussenried'),
    ('1952:SWH:11', 72, 'SWH', 11, 'Saulgau mit Aulendorf-Wilhelmsdorf und Schussenried'),
    ('1952:SWH:12', 73, 'SWH', 12, 'Ravensburg-Friedrichshafen ohne Aulendorf-Wilhelmsdorf'),
    ('1952:SWH:13', 74, 'SWH', 13, 'Wangen mit Tettnang Mitte und Ost')
  ) AS source(source_key, technical_number, region, historical_number, name);
$$;
REVOKE ALL ON FUNCTION public.election_history_1952_source() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.election_history_1952_source() TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_election_history_1988_district_name() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE selected_year integer; canonical_name text; source_district record;
BEGIN
  SELECT p.election_year INTO selected_year FROM public.election_history_periods p WHERE p.id = NEW.period_id;
  IF NEW.geometry_source_key IS NOT NULL THEN
    IF selected_year IS DISTINCT FROM 1952 THEN
      RAISE EXCEPTION 'Der regionale 1952-Quellenschlüssel gehört nur zur Wahl 1952.' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO source_district FROM public.election_history_1952_source() s WHERE s.source_key = NEW.geometry_source_key;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unbekannte regionale 1952-Quelle.' USING ERRCODE = '23514'; END IF;
    NEW.district_number := NULL; -- Never present 1–74 as historical numbers.
    NEW.number_label := source_district.region || ' ' || source_district.historical_number;
    NEW.name := source_district.name;
    RETURN NEW;
  END IF;
  -- Legacy 1952 records stay unresolved until a person explicitly assigns
  -- their mandates/candidacies to an appropriate regional source record.
  canonical_name := public.election_history_source_district_name(selected_year, NEW.district_number);
  IF canonical_name IS NOT NULL THEN NEW.name := canonical_name;
  ELSIF selected_year IN (1976, 1980, 1984, 1988) AND lower(btrim(NEW.name)) = 'wiesloch' THEN
    RAISE EXCEPTION '1976–1988 existiert kein eigener Wahlkreis Wiesloch; Wahlkreis 37 ist Mannheim III.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_election_history_1988_district_name() FROM PUBLIC;
DROP TRIGGER IF EXISTS election_history_1988_district_name ON public.election_history_districts;
CREATE TRIGGER election_history_1988_district_name
BEFORE INSERT OR UPDATE ON public.election_history_districts
FOR EACH ROW EXECUTE FUNCTION public.guard_election_history_1988_district_name();

INSERT INTO public.election_history_districts(period_id, district_number, number_label, geometry_source_key, name, boundary_note)
SELECT p.id, NULL, s.region || ' ' || s.historical_number, s.source_key, s.name,
  'Rekonstruktion 1952, Gebietsstand 09.03.1952; lokale Näherungen. Region und historische Nummer bilden die Zuordnung. Technische Kennungen sind keine historischen Wahlkreisnummern.'
FROM public.election_history_periods p CROSS JOIN public.election_history_1952_source() s
WHERE p.election_year = 1952
ON CONFLICT (period_id, geometry_source_key) WHERE geometry_source_key IS NOT NULL DO NOTHING;

-- Source-key edits require a fresh period confirmation, just like number edits.
CREATE OR REPLACE FUNCTION public.invalidate_election_history_geometry() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.period_id IS NOT DISTINCT FROM OLD.period_id
       AND NEW.district_number IS NOT DISTINCT FROM OLD.district_number
       AND NEW.geometry_source_key IS NOT DISTINCT FROM OLD.geometry_source_key THEN
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

-- No renumbering, inferred merging, or relinking of any existing records.
UPDATE public.election_history_periods SET boundary_geometry_confirmed = false
WHERE election_year = 1952 AND boundary_geometry_confirmed;
NOTIFY pgrst, 'reload schema';
