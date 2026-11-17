-- Sourced snapshots; mandate intervals and election-result datasets remain independent.
BEGIN;
ALTER TABLE public.election_history_periods
  ADD COLUMN seat_total integer,
  ADD COLUMN seat_distribution jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN seat_basis text NOT NULL DEFAULT 'unknown',
  ADD COLUMN seat_reference_date date,
  ADD COLUMN seat_source_url text,
  ADD COLUMN seat_notes text;

CREATE OR REPLACE FUNCTION public.guard_election_period_seats()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE r jsonb; n integer; allocated integer := 0; names text[] := ARRAY[]::text[]; label text;
BEGIN
  IF NEW.seat_total IS NOT NULL AND (NEW.seat_total < 1 OR NEW.seat_total > 1000) THEN
    RAISE EXCEPTION 'Gesamtsitze müssen zwischen 1 und 1000 liegen';
  END IF;
  IF NEW.seat_basis NOT IN ('unknown','election_result','opening','as_of') THEN
    RAISE EXCEPTION 'Ungültiger Bezugsstand der Sitzzahlen';
  END IF;
  IF NEW.seat_basis = 'as_of' AND NEW.seat_reference_date IS NULL THEN
    RAISE EXCEPTION 'Stichtag der Sitzverteilung fehlt';
  END IF;
  IF NEW.seat_source_url IS NOT NULL AND NEW.seat_source_url !~* '^https?://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'Ungültige Quellenadresse der Sitzzahlen';
  END IF;
  IF jsonb_typeof(NEW.seat_distribution) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Sitzverteilung muss eine Liste sein';
  END IF;
  IF jsonb_array_length(NEW.seat_distribution) > 30 THEN RAISE EXCEPTION 'Höchstens 30 Parteien / Fraktionen'; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(NEW.seat_distribution) LOOP
    IF jsonb_typeof(r) IS DISTINCT FROM 'object'
      OR jsonb_typeof(r->'faction') IS DISTINCT FROM 'string'
      OR jsonb_typeof(r->'seats') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Ungültiger Eintrag der Sitzverteilung';
    END IF;
    label := lower(btrim(r->>'faction'));
    IF length(label) NOT BETWEEN 1 AND 100 OR label = ANY(names)
      OR (r->>'seats') !~ '^[0-9]{1,4}$' THEN
      RAISE EXCEPTION 'Doppelte Partei oder ungültige Sitzzahl';
    END IF;
    n := (r->>'seats')::integer;
    IF n > 1000 THEN RAISE EXCEPTION 'Zu viele Sitze'; END IF;
    names := array_append(names, label); allocated := allocated + n;
  END LOOP;
  IF allocated > 1000 OR (NEW.seat_total IS NOT NULL AND allocated > NEW.seat_total) THEN
    RAISE EXCEPTION 'Parteisitze überschreiten die Gesamtsitzzahl';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER guard_election_period_seats
BEFORE INSERT OR UPDATE OF seat_total,seat_distribution,seat_basis,seat_reference_date,seat_source_url
ON public.election_history_periods FOR EACH ROW EXECUTE FUNCTION public.guard_election_period_seats();

-- Only fill untouched snapshots, matched by both period number and election year.
WITH supplied AS (
 SELECT * FROM jsonb_to_recordset($seats$[{"number": 1, "election_year": 1952, "seat_total": 121, "seat_distribution": [{"faction": "CDU", "seats": 50}, {"faction": "SPD", "seats": 38}, {"faction": "FDP/DVP", "seats": 23}, {"faction": "BHE", "seats": 6}, {"faction": "KPD", "seats": 4}], "seat_basis": "election_result", "seat_reference_date": null, "seat_source_url": "https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf", "seat_notes": "Wahl zur Verfassunggebenden Landesversammlung. Nicht jede Partei bildete eine eigenständige Fraktion."}, {"number": 2, "election_year": 1956, "seat_total": 120, "seat_distribution": [{"faction": "CDU", "seats": 56}, {"faction": "SPD", "seats": 36}, {"faction": "FDP/DVP", "seats": 21}, {"faction": "GB/BHE", "seats": 7}], "seat_basis": "election_result", "seat_reference_date": null, "seat_source_url": "https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf", "seat_notes": null}, {"number": 3, "election_year": 1960, "seat_total": 121, "seat_distribution": [{"faction": "CDU", "seats": 52}, {"faction": "SPD", "seats": 44}, {"faction": "FDP/DVP", "seats": 18}, {"faction": "GB/BHE", "seats": 7}], "seat_basis": "election_result", "seat_reference_date": "1961-03-12", "seat_source_url": "https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf", "seat_notes": "Einschließlich der Wiederholungswahl am 12.03.1961 in zwei Wahlkreisen."}, {"number": 4, "election_year": 1964, "seat_total": 120, "seat_distribution": [{"faction": "CDU", "seats": 59}, {"faction": "SPD", "seats": 47}, {"faction": "FDP/DVP", "seats": 14}], "seat_basis": "election_result", "seat_reference_date": null, "seat_source_url": "https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf", "seat_notes": null}, {"number": 5, "election_year": 1968, "seat_total": 127, "seat_distribution": [{"faction": "CDU", "seats": 60}, {"faction": "SPD", "seats": 37}, {"faction": "FDP/DVP", "seats": 18}, {"faction": "NPD", "seats": 12}], "seat_basis": "election_result", "seat_reference_date": null, "seat_source_url": "https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf", "seat_notes": null}, {"number": 6, "election_year": 1972, "seat_total": 120, "seat_distribution": [{"faction": "CDU", "seats": 65}, {"faction": "SPD", "seats": 45}, {"faction": "FDP/DVP", "seats": 10}], "seat_basis": "election_result", "seat_reference_date": null, "seat_source_url": "https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf", "seat_notes": null}, {"number": 7, "election_year": 1976, "seat_total": 121, "seat_distribution": [{"faction": "CDU", "seats": 71}, {"faction": "SPD", "seats": 41}, {"faction": "FDP/DVP", "seats": 9}], "seat_basis": "election_result", "seat_reference_date": null, "seat_source_url": "https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf", "seat_notes": null}, {"number": 8, "election_year": 1980, "seat_total": 124, "seat_distribution": [{"faction": "CDU", "seats": 68}, {"faction": "SPD", "seats": 40}, {"faction": "FDP/DVP", "seats": 10}, {"faction": "Grüne", "seats": 6}], "seat_basis": "election_result", "seat_reference_date": null, "seat_source_url": "https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf", "seat_notes": null}, {"number": 9, "election_year": 1984, "seat_total": 126, "seat_distribution": [{"faction": "CDU", "seats": 68}, {"faction": "SPD", "seats": 41}, {"faction": "FDP/DVP", "seats": 8}, {"faction": "Grüne", "seats": 9}], "seat_basis": "election_result", "seat_reference_date": null, "seat_source_url": "https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf", "seat_notes": null}, {"number": 10, "election_year": 1988, "seat_total": 125, "seat_distribution": [{"faction": "CDU", "seats": 66}, {"faction": "SPD", "seats": 42}, {"faction": "FDP/DVP", "seats": 7}, {"faction": "Grüne", "seats": 10}], "seat_basis": "election_result", "seat_reference_date": null, "seat_source_url": "https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf", "seat_notes": null}, {"number": 11, "election_year": 1992, "seat_total": 146, "seat_distribution": [{"faction": "CDU", "seats": 64}, {"faction": "SPD", "seats": 46}, {"faction": "FDP/DVP", "seats": 8}, {"faction": "Grüne", "seats": 13}, {"faction": "REP", "seats": 15}], "seat_basis": "election_result", "seat_reference_date": null, "seat_source_url": "https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf", "seat_notes": null}, {"number": 12, "election_year": 1996, "seat_total": 155, "seat_distribution": [{"faction": "CDU", "seats": 69}, {"faction": "SPD", "seats": 39}, {"faction": "FDP/DVP", "seats": 14}, {"faction": "Grüne", "seats": 19}, {"faction": "REP", "seats": 14}], "seat_basis": "election_result", "seat_reference_date": null, "seat_source_url": "https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf", "seat_notes": null}, {"number": 13, "election_year": 2001, "seat_total": 128, "seat_distribution": [{"faction": "CDU", "seats": 63}, {"faction": "SPD", "seats": 45}, {"faction": "FDP/DVP", "seats": 10}, {"faction": "Grüne", "seats": 10}], "seat_basis": "election_result", "seat_reference_date": null, "seat_source_url": "https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf", "seat_notes": null}, {"number": 14, "election_year": 2006, "seat_total": 139, "seat_distribution": [{"faction": "CDU", "seats": 69}, {"faction": "SPD", "seats": 38}, {"faction": "FDP/DVP", "seats": 15}, {"faction": "Grüne", "seats": 17}], "seat_basis": "election_result", "seat_reference_date": null, "seat_source_url": "https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf", "seat_notes": null}, {"number": 15, "election_year": 2011, "seat_total": 138, "seat_distribution": [{"faction": "CDU", "seats": 60}, {"faction": "SPD", "seats": 35}, {"faction": "FDP/DVP", "seats": 7}, {"faction": "Grüne", "seats": 36}], "seat_basis": "election_result", "seat_reference_date": null, "seat_source_url": "https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf", "seat_notes": null}, {"number": 16, "election_year": 2016, "seat_total": 143, "seat_distribution": [{"faction": "CDU", "seats": 42}, {"faction": "SPD", "seats": 19}, {"faction": "FDP/DVP", "seats": 12}, {"faction": "Grüne", "seats": 47}, {"faction": "AfD", "seats": 23}], "seat_basis": "election_result", "seat_reference_date": null, "seat_source_url": "https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf", "seat_notes": null}, {"number": 17, "election_year": 2021, "seat_total": 154, "seat_distribution": [{"faction": "CDU", "seats": 42}, {"faction": "SPD", "seats": 19}, {"faction": "FDP/DVP", "seats": 18}, {"faction": "Grüne", "seats": 58}, {"faction": "AfD", "seats": 17}], "seat_basis": "election_result", "seat_reference_date": null, "seat_source_url": "https://www.statistik-bw.de/fileadmin/user_upload/Service/Veroeff/Statistisches_Monatsheft/Beitrag25_12_06.pdf", "seat_notes": null}, {"number": 18, "election_year": 2026, "seat_total": 157, "seat_distribution": [{"faction": "CDU", "seats": 56}, {"faction": "SPD", "seats": 10}, {"faction": "Grüne", "seats": 56}, {"faction": "AfD", "seats": 35}], "seat_basis": "election_result", "seat_reference_date": "2026-03-27", "seat_source_url": "https://www.landtag-bw.de/de/aktuelles/themen/landtagswahl-2026", "seat_notes": "Amtliches Endergebnis, festgestellt am 27.03.2026."}]$seats$::jsonb)
 AS x(number integer,election_year integer,seat_total integer,seat_distribution jsonb,seat_basis text,seat_reference_date date,seat_source_url text,seat_notes text)
)
UPDATE public.election_history_periods p SET
 seat_total = COALESCE(p.seat_total,s.seat_total), seat_distribution = s.seat_distribution,
 seat_basis = s.seat_basis, seat_reference_date = s.seat_reference_date,
 seat_source_url = s.seat_source_url, seat_notes = s.seat_notes
FROM supplied s
WHERE p.number = s.number AND COALESCE(p.election_year,extract(year FROM p.election_date)::integer) = s.election_year
 AND p.seat_distribution = '[]'::jsonb AND p.seat_basis = 'unknown'
 AND p.seat_source_url IS NULL AND p.seat_reference_date IS NULL AND p.seat_notes IS NULL
 AND (p.seat_total IS NULL OR p.seat_total = s.seat_total);
COMMIT;
