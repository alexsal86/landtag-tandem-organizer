BEGIN;
ALTER TABLE public.election_history_state_list_entries
 ADD COLUMN birth_year integer CHECK(birth_year BETWEEN 1850 AND 2200),
 ADD COLUMN district_number integer CHECK(district_number BETWEEN 1 AND 70),
 ADD COLUMN district_name text,
 ADD COLUMN candidacy_role text CHECK(candidacy_role IN('direct','substitute','list_only')),
 ADD COLUMN residence text,
 ADD COLUMN source_name text,
 ADD COLUMN source_snapshot jsonb;
CREATE INDEX state_list_connection_lookup ON public.election_history_state_list_entries(connection_id) WHERE connection_id IS NOT NULL;
CREATE FUNCTION public.history_list_person_key(label text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path=public AS $$
 SELECT lower(regexp_replace(btrim(regexp_replace(
  CASE WHEN strpos($1,',')>0 THEN btrim(split_part($1,',',2))||' '||btrim(split_part($1,',',1)) ELSE $1 END,
  '\m(dr|prof)\.[[:space:]]*','','gi')),'[[:space:]]+',' ','g'));
$$;
CREATE OR REPLACE FUNCTION public.link_election_state_list_entry() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE matches uuid[]; list_party text;
BEGIN
 NEW.person_name:=btrim(NEW.person_name);
 IF NEW.link_mode='unlinked' AND NEW.connection_id IS NULL THEN RETURN NEW; END IF;
 IF NEW.link_mode='manual' AND NEW.connection_id IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.election_history_mandates WHERE connection_id=NEW.connection_id) THEN RAISE EXCEPTION 'Die gewählte Mandatshistorie existiert nicht mehr.'; END IF;
  RETURN NEW;
 END IF;
 -- Uniqueness is counted across ALL histories before checking party/birth year.
 SELECT array_agg(DISTINCT m.connection_id) INTO matches
 FROM public.election_history_mandates m LEFT JOIN public.election_history_people p ON p.id=m.person_id
 WHERE m.connection_id IS NOT NULL AND
  (public.history_list_person_key(m.person_name)=public.history_list_person_key(NEW.person_name)
   OR public.history_list_person_key(p.name)=public.history_list_person_key(NEW.person_name));
 SELECT party INTO list_party FROM public.election_history_state_lists WHERE id=NEW.list_id;
 IF cardinality(matches)=1
  AND EXISTS(SELECT 1 FROM public.election_history_mandates m WHERE m.connection_id=matches[1]
   AND public.history_result_party(m.party)=public.history_result_party(list_party))
  AND NOT EXISTS(SELECT 1 FROM public.election_history_mandates m JOIN public.election_history_mandate_birthdays b ON b.mandate_id=m.id
   WHERE m.connection_id=matches[1] AND NEW.birth_year IS NOT NULL AND b.birth_year<>NEW.birth_year)
  AND NOT EXISTS(SELECT 1 FROM public.election_history_state_list_entries e WHERE e.list_id=NEW.list_id AND e.connection_id=matches[1] AND e.id<>NEW.id)
 THEN NEW.connection_id:=matches[1]; NEW.link_mode:='auto';
 ELSE NEW.connection_id:=NULL; NEW.link_mode:='unlinked'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER election_state_list_entry_link ON public.election_history_state_list_entries;
CREATE TRIGGER election_state_list_entry_link BEFORE INSERT OR UPDATE OF person_name,connection_id,link_mode,list_id,birth_year
 ON public.election_history_state_list_entries FOR EACH ROW EXECUTE FUNCTION public.link_election_state_list_entry();
CREATE OR REPLACE FUNCTION public.sync_election_state_list_connections() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE mapping record;
BEGIN
 FOR mapping IN SELECT o.connection_id AS old_id,(array_agg(DISTINCT n.connection_id))[1] AS new_id
   FROM old_mandates o JOIN new_mandates n ON n.id=o.id
   WHERE o.connection_id IS NOT NULL AND n.connection_id IS NOT NULL AND o.connection_id IS DISTINCT FROM n.connection_id
   GROUP BY o.connection_id HAVING count(DISTINCT n.connection_id)=1
 LOOP
   IF NOT EXISTS(SELECT 1 FROM public.election_history_mandates WHERE connection_id=mapping.old_id) THEN
     UPDATE public.election_history_state_list_entries e
     SET connection_id=CASE WHEN EXISTS(SELECT 1 FROM public.election_history_state_list_entries other WHERE other.list_id=e.list_id AND other.connection_id=mapping.new_id AND other.id<>e.id) THEN NULL ELSE mapping.new_id END,
       link_mode=CASE WHEN EXISTS(SELECT 1 FROM public.election_history_state_list_entries other WHERE other.list_id=e.list_id AND other.connection_id=mapping.new_id AND other.id<>e.id) THEN 'unlinked' ELSE 'manual' END
     WHERE e.connection_id=mapping.old_id;
   END IF;
 END LOOP;
 UPDATE public.election_history_state_list_entries e SET link_mode='auto'
 WHERE e.link_mode<>'manual' AND public.history_list_person_key(e.person_name) IN (
   SELECT public.history_list_person_key(coalesce(n.person_name,p.name)) FROM new_mandates n LEFT JOIN public.election_history_people p ON p.id=n.person_id
   UNION SELECT public.history_list_person_key(coalesce(o.person_name,p.name)) FROM old_mandates o LEFT JOIN public.election_history_people p ON p.id=o.person_id
 );
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_election_state_list_matches() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 UPDATE public.election_history_state_list_entries e SET link_mode='auto'
 WHERE e.link_mode<>'manual' AND public.history_list_person_key(e.person_name) IN (
   SELECT public.history_list_person_key(coalesce(n.person_name,p.name)) FROM new_mandates n LEFT JOIN public.election_history_people p ON p.id=n.person_id
 );
 RETURN NULL;
END $$;

-- The supplied workbook is data, not identity confirmation or an election result.
DO $import$
DECLARE selected_period uuid; r record; selected_list uuid; old_entry public.election_history_state_list_entries%ROWTYPE;
BEGIN
 SELECT id INTO STRICT selected_period FROM public.election_history_periods WHERE number=18 AND election_year=2026;
 FOR r IN SELECT * FROM jsonb_to_recordset($rows$[
{"party": "GRÜNE", "position": 1, "person_name": "Thekla Walker", "source_name": "Walker, Thekla", "district_number": 5, "district_name": "Böblingen", "candidacy_role": "direct", "residence": "Böblingen", "birth_year": 1969, "source_row": 9},
{"party": "GRÜNE", "position": 2, "person_name": "Cem Özdemir", "source_name": "Özdemir, Cem", "district_number": 2, "district_name": "Stuttgart II", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1965, "source_row": 10},
{"party": "GRÜNE", "position": 3, "person_name": "Muhterem Aras", "source_name": "Aras, Muhterem", "district_number": 1, "district_name": "Stuttgart I", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1966, "source_row": 11},
{"party": "GRÜNE", "position": 4, "person_name": "Andreas Schwarz", "source_name": "Schwarz, Andreas", "district_number": 8, "district_name": "Kirchheim", "candidacy_role": "direct", "residence": "Kirchheim unter Teck", "birth_year": 1979, "source_row": 12},
{"party": "GRÜNE", "position": 5, "person_name": "Petra Olschowski", "source_name": "Olschowski, Petra", "district_number": 4, "district_name": "Stuttgart IV", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1965, "source_row": 13},
{"party": "GRÜNE", "position": 6, "person_name": "Oliver Hildenbrand", "source_name": "Hildenbrand, Oliver", "district_number": 3, "district_name": "Stuttgart III", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1988, "source_row": 14},
{"party": "GRÜNE", "position": 7, "person_name": "Sandra Boser", "source_name": "Boser, Sandra", "district_number": 50, "district_name": "Lahr", "candidacy_role": "direct", "residence": "Wolfach", "birth_year": 1976, "source_row": 15},
{"party": "GRÜNE", "position": 8, "person_name": "Pascal Haggenmüller", "source_name": "Haggenmüller, Pascal", "district_number": 30, "district_name": "Bretten", "candidacy_role": "direct", "residence": "Mannheim", "birth_year": 1988, "source_row": 16},
{"party": "GRÜNE", "position": 9, "person_name": "Petra Krebs", "source_name": "Krebs, Petra", "district_number": 68, "district_name": "Wangen", "candidacy_role": "direct", "residence": "Wangen im Allgäu", "birth_year": 1969, "source_row": 17},
{"party": "GRÜNE", "position": 10, "person_name": "Daniel Lede Abal", "source_name": "Lede Abal, Daniel", "district_number": 62, "district_name": "Tübingen", "candidacy_role": "direct", "residence": "Tübingen", "birth_year": 1976, "source_row": 18},
{"party": "GRÜNE", "position": 11, "person_name": "Andrea Lindlohr", "source_name": "Lindlohr, Andrea", "district_number": 7, "district_name": "Esslingen", "candidacy_role": "direct", "residence": "Esslingen am Neckar", "birth_year": 1975, "source_row": 19},
{"party": "GRÜNE", "position": 12, "person_name": "Andre Baumann", "source_name": "Dr. Baumann, Andre", "district_number": 40, "district_name": "Schwetzingen", "candidacy_role": "direct", "residence": "Schwetzingen", "birth_year": 1973, "source_row": 20},
{"party": "GRÜNE", "position": 13, "person_name": "Cindy Holmberg", "source_name": "Holmberg, Cindy", "district_number": 61, "district_name": "Hechingen-Münsingen", "candidacy_role": "direct", "residence": "Reutlingen", "birth_year": 1975, "source_row": 21},
{"party": "GRÜNE", "position": 14, "person_name": "Florian Haßler", "source_name": "Haßler, Florian", "district_number": 16, "district_name": "Schorndorf", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1977, "source_row": 22},
{"party": "GRÜNE", "position": 15, "person_name": "Nese Erikli", "source_name": "Erikli, Nese", "district_number": 56, "district_name": "Konstanz", "candidacy_role": "direct", "residence": "Konstanz", "birth_year": 1981, "source_row": 23},
{"party": "GRÜNE", "position": 16, "person_name": "Thomas Poreski", "source_name": "Poreski, Thomas", "district_number": 60, "district_name": "Reutlingen", "candidacy_role": "direct", "residence": "Reutlingen", "birth_year": 1963, "source_row": 24},
{"party": "GRÜNE", "position": 17, "person_name": "Elke Zimmer", "source_name": "Zimmer, Elke", "district_number": 36, "district_name": "Mannheim II", "candidacy_role": "direct", "residence": "Mannheim", "birth_year": 1966, "source_row": 25},
{"party": "GRÜNE", "position": 18, "person_name": "Michael Joukov", "source_name": "Joukov, Michael", "district_number": 64, "district_name": "Ulm", "candidacy_role": "direct", "residence": "Ulm", "birth_year": 1981, "source_row": 26},
{"party": "GRÜNE", "position": 19, "person_name": "Swantje Sperling", "source_name": "Sperling, Swantje", "district_number": 15, "district_name": "Waiblingen", "candidacy_role": "direct", "residence": "Leutenbach", "birth_year": 1983, "source_row": 27},
{"party": "GRÜNE", "position": 20, "person_name": "Jens Metzger", "source_name": "Metzger, Jens", "district_number": 55, "district_name": "Tuttlingen-Donaueschingen", "candidacy_role": "direct", "residence": "Tuttlingen", "birth_year": 1990, "source_row": 28},
{"party": "GRÜNE", "position": 21, "person_name": "Clara Schweizer", "source_name": "Schweizer, Clara", "district_number": 9, "district_name": "Nürtingen", "candidacy_role": "direct", "residence": "Nürtingen", "birth_year": 2002, "source_row": 29},
{"party": "GRÜNE", "position": 22, "person_name": "Martin Hahn", "source_name": "Hahn, Martin", "district_number": 67, "district_name": "Bodensee", "candidacy_role": "direct", "residence": "Überlingen", "birth_year": 1963, "source_row": 30},
{"party": "GRÜNE", "position": 23, "person_name": "Ute Leidig", "source_name": "Dr. Leidig, Ute", "district_number": 27, "district_name": "Karlsruhe I", "candidacy_role": "direct", "residence": "Karlsruhe", "birth_year": 1963, "source_row": 31},
{"party": "GRÜNE", "position": 24, "person_name": "Thomas Hentschel", "source_name": "Hentschel, Thomas", "district_number": 32, "district_name": "Rastatt", "candidacy_role": "direct", "residence": "Gernsbach", "birth_year": 1964, "source_row": 32},
{"party": "GRÜNE", "position": 25, "person_name": "Martina Braun", "source_name": "Braun, Martina", "district_number": 54, "district_name": "Villingen-Schwenningen", "candidacy_role": "direct", "residence": "Furtwangen im Schwarzwald", "birth_year": 1960, "source_row": 33},
{"party": "GRÜNE", "position": 26, "person_name": "Erwin Köhler", "source_name": "Köhler, Erwin", "district_number": 19, "district_name": "Eppingen", "candidacy_role": "direct", "residence": "Lauffen am Neckar", "birth_year": 1995, "source_row": 34},
{"party": "GRÜNE", "position": 27, "person_name": "Daniela Evers", "source_name": "Evers, Daniela", "district_number": 46, "district_name": "Freiburg I", "candidacy_role": "direct", "residence": "Titisee-Neustadt", "birth_year": 1971, "source_row": 35},
{"party": "GRÜNE", "position": 28, "person_name": "Tayfun Tok", "source_name": "Tok, Tayfun", "district_number": 14, "district_name": "Bietigheim-Bissingen", "candidacy_role": "direct", "residence": "Murr", "birth_year": 1986, "source_row": 36},
{"party": "GRÜNE", "position": 29, "person_name": "Anna Deparnay-Grunenberg", "source_name": "Deparnay-Grunenberg, Anna", "district_number": 48, "district_name": "Breisgau", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1976, "source_row": 37},
{"party": "GRÜNE", "position": 30, "person_name": "Ralf Nentwich", "source_name": "Nentwich, Ralf", "district_number": 17, "district_name": "Backnang", "candidacy_role": "direct", "residence": "Murrhardt", "birth_year": 1982, "source_row": 38},
{"party": "GRÜNE", "position": 31, "person_name": "Sarah Hagmann", "source_name": "Hagmann, Sarah", "district_number": 58, "district_name": "Lörrach", "candidacy_role": "direct", "residence": "Lörrach", "birth_year": 1985, "source_row": 39},
{"party": "GRÜNE", "position": 32, "person_name": "Bernd Mettenleiter", "source_name": "Mettenleiter, Bernd", "district_number": 52, "district_name": "Kehl", "candidacy_role": "direct", "residence": "Achern", "birth_year": 1971, "source_row": 40},
{"party": "GRÜNE", "position": 33, "person_name": "Meike Günter", "source_name": "Günter, Meike", "district_number": 13, "district_name": "Vaihingen", "candidacy_role": "direct", "residence": "Vaihingen an der Enz", "birth_year": 1974, "source_row": 41},
{"party": "GRÜNE", "position": 34, "person_name": "Niklas Nüssle", "source_name": "Nüssle, Niklas", "district_number": 59, "district_name": "Waldshut", "candidacy_role": "direct", "residence": "Wutöschingen", "birth_year": 1994, "source_row": 42},
{"party": "GRÜNE", "position": 35, "person_name": "Silke Gericke", "source_name": "Gericke, Silke", "district_number": 12, "district_name": "Ludwigsburg", "candidacy_role": "direct", "residence": "Ludwigsburg", "birth_year": 1974, "source_row": 43},
{"party": "GRÜNE", "position": 36, "person_name": "Peter Seimer", "source_name": "Seimer, Peter", "district_number": 6, "district_name": "Leonberg", "candidacy_role": "direct", "residence": "Aidlingen", "birth_year": 1993, "source_row": 44},
{"party": "GRÜNE", "position": 37, "person_name": "Fadime Tuncer", "source_name": "Tuncer, Fadime", "district_number": 39, "district_name": "Weinheim", "candidacy_role": "direct", "residence": "Schriesheim", "birth_year": 1969, "source_row": 45},
{"party": "GRÜNE", "position": 38, "person_name": "Yannick Veits", "source_name": "Veits, Yannick", "district_number": 37, "district_name": "Wiesloch", "candidacy_role": "direct", "residence": "Nußloch", "birth_year": 1994, "source_row": 46},
{"party": "GRÜNE", "position": 39, "person_name": "Clara Resch", "source_name": "Resch, Clara", "district_number": 24, "district_name": "Heidenheim", "candidacy_role": "direct", "residence": "Heidenheim an der Brenz", "birth_year": 1995, "source_row": 47},
{"party": "GRÜNE", "position": 40, "person_name": "Gerd Bayer", "source_name": "Bayer, Gerd", "district_number": 23, "district_name": "Main-Tauber", "candidacy_role": "direct", "residence": "Niederstetten", "birth_year": 1981, "source_row": 48},
{"party": "GRÜNE", "position": 41, "person_name": "Stefanie Seemann", "source_name": "Seemann, Stefanie", "district_number": 44, "district_name": "Enz", "candidacy_role": "direct", "residence": "Mühlacker", "birth_year": 1959, "source_row": 49},
{"party": "GRÜNE", "position": 42, "person_name": "Hermann Katzenstein", "source_name": "Katzenstein, Hermann", "district_number": 41, "district_name": "Sinsheim", "candidacy_role": "direct", "residence": "Neckargemünd", "birth_year": 1969, "source_row": 50},
{"party": "GRÜNE", "position": 43, "person_name": "Gudula Achterberg", "source_name": "Achterberg, Gudula", "district_number": 18, "district_name": "Heilbronn", "candidacy_role": "direct", "residence": "Leingarten", "birth_year": 1965, "source_row": 51},
{"party": "GRÜNE", "position": 44, "person_name": "Rüdiger Tonojan", "source_name": "Tonojan, Rüdiger", "district_number": 49, "district_name": "Emmendingen", "candidacy_role": "direct", "residence": "Denzlingen", "birth_year": 1972, "source_row": 52},
{"party": "GRÜNE", "position": 45, "person_name": "Mariska Ott", "source_name": "Dr. Ott, Mariska", "district_number": 10, "district_name": "Göppingen", "candidacy_role": "direct", "residence": "Göppingen", "birth_year": 1982, "source_row": 53},
{"party": "GRÜNE", "position": 46, "person_name": "Daniel Belling", "source_name": "Dr. Belling, Daniel", "district_number": 45, "district_name": "Freudenstadt", "candidacy_role": "direct", "residence": "Leonberg", "birth_year": 1986, "source_row": 54},
{"party": "GRÜNE", "position": 47, "person_name": "Lea Geldner", "source_name": "Geldner, Lea", "district_number": 22, "district_name": "Schwäbisch Hall", "candidacy_role": "direct", "residence": "Rot am See", "birth_year": 1991, "source_row": 55},
{"party": "GRÜNE", "position": 48, "person_name": "Kai Keune", "source_name": "Keune, Kai", "district_number": 31, "district_name": "Ettlingen", "candidacy_role": "direct", "residence": "Ettlingen", "birth_year": 1983, "source_row": 56},
{"party": "GRÜNE", "position": 49, "person_name": "Saskia Frank", "source_name": "Frank, Saskia", "district_number": 57, "district_name": "Singen", "candidacy_role": "direct", "residence": "Rielasingen-Worblingen", "birth_year": 1987, "source_row": 57},
{"party": "GRÜNE", "position": 50, "person_name": "Artur Eichin", "source_name": "Eichin, Artur", "district_number": 53, "district_name": "Rottweil", "candidacy_role": "direct", "residence": "Löffingen", "birth_year": 1982, "source_row": 58},
{"party": "GRÜNE", "position": 51, "person_name": "Anna Wiech", "source_name": "Wiech, Anna", "district_number": 69, "district_name": "Ravensburg", "candidacy_role": "direct", "residence": "Ravensburg", "birth_year": 1977, "source_row": 59},
{"party": "GRÜNE", "position": 52, "person_name": "Berat Gürbüz", "source_name": "Gürbüz, Berat", "district_number": 66, "district_name": "Biberach", "candidacy_role": "direct", "residence": "Warthausen", "birth_year": 2002, "source_row": 60},
{"party": "GRÜNE", "position": 53, "person_name": "Maren Seifert", "source_name": "Seifert, Maren", "district_number": 51, "district_name": "Offenburg", "candidacy_role": "direct", "residence": "Offenburg", "birth_year": 1977, "source_row": 61},
{"party": "GRÜNE", "position": 54, "person_name": "Arno Meuter", "source_name": "Meuter, Arno", "district_number": 38, "district_name": "Neckar-Odenwald", "candidacy_role": "direct", "residence": "Aglasterhausen", "birth_year": 1996, "source_row": 62},
{"party": "GRÜNE", "position": 55, "person_name": "Martina Häusler", "source_name": "Häusler, Martina", "district_number": 25, "district_name": "Schwäbisch Gmünd", "candidacy_role": "direct", "residence": "Schwäbisch Gmünd", "birth_year": 1964, "source_row": 63},
{"party": "GRÜNE", "position": 56, "person_name": "Mario Dietel", "source_name": "Dietel, Mario", "district_number": 21, "district_name": "Hohenlohe", "candidacy_role": "direct", "residence": "Öhringen", "birth_year": 2000, "source_row": 64},
{"party": "GRÜNE", "position": 57, "person_name": "Hanna Stauß", "source_name": "Stauß, Hanna", "district_number": 70, "district_name": "Sigmaringen", "candidacy_role": "direct", "residence": "Sigmaringen", "birth_year": 1997, "source_row": 65},
{"party": "GRÜNE", "position": 58, "person_name": "Benjamin Bauer", "source_name": "Bauer, Benjamin", "district_number": 28, "district_name": "Karlsruhe II", "candidacy_role": "direct", "residence": "Karlsruhe", "birth_year": 1989, "source_row": 66},
{"party": "GRÜNE", "position": 59, "person_name": "Nicole Heger", "source_name": "Heger, Nicole", "district_number": 29, "district_name": "Bruchsal", "candidacy_role": "direct", "residence": "Waghäusel", "birth_year": 1970, "source_row": 67},
{"party": "GRÜNE", "position": 60, "person_name": "Julian Beier", "source_name": "Beier, Julian", "district_number": 11, "district_name": "Geislingen", "candidacy_role": "direct", "residence": "Gingen an der Fils", "birth_year": 1994, "source_row": 68},
{"party": "GRÜNE", "position": 61, "person_name": "Jiska Dannenberger", "source_name": "Dannenberger, Jiska", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Heidelberg", "birth_year": 2001, "source_row": 69},
{"party": "GRÜNE", "position": 62, "person_name": "Fynn Rubehn", "source_name": "Rubehn, Fynn", "district_number": 43, "district_name": "Calw", "candidacy_role": "direct", "residence": "Herrenberg", "birth_year": 2004, "source_row": 70},
{"party": "GRÜNE", "position": 63, "person_name": "Miriam Sonnenbichler", "source_name": "Sonnenbichler, Miriam", "district_number": 27, "district_name": "Karlsruhe I", "candidacy_role": "substitute", "residence": "Karlsruhe", "birth_year": 1978, "source_row": 71},
{"party": "GRÜNE", "position": 64, "person_name": "Maurice Rößler", "source_name": "Rößler, Maurice", "district_number": 63, "district_name": "Balingen", "candidacy_role": "direct", "residence": "Burladingen", "birth_year": 1995, "source_row": 72},
{"party": "GRÜNE", "position": 65, "person_name": "Susanne Bublitz", "source_name": "Dr. Bublitz, Susanne", "district_number": 21, "district_name": "Hohenlohe", "candidacy_role": "substitute", "residence": "Bretzfeld", "birth_year": 1976, "source_row": 73},
{"party": "GRÜNE", "position": 66, "person_name": "Tobias Hocke-Beck", "source_name": "Hocke-Beck, Tobias", "district_number": 65, "district_name": "Ehingen", "candidacy_role": "direct", "residence": "Birenbach", "birth_year": 1992, "source_row": 74},
{"party": "GRÜNE", "position": 67, "person_name": "Sibylle Riegger-Gnamm", "source_name": "Riegger-Gnamm, Sibylle", "district_number": 20, "district_name": "Neckarsulm", "candidacy_role": "direct", "residence": "Bad Friedrichshall", "birth_year": 1966, "source_row": 75},
{"party": "GRÜNE", "position": 68, "person_name": "Joachim Heck", "source_name": "Dr. Heck, Joachim", "district_number": 33, "district_name": "Baden-Baden", "candidacy_role": "direct", "residence": "Sinzheim", "birth_year": 1982, "source_row": 76},
{"party": "GRÜNE", "position": 69, "person_name": "Laura Däuber", "source_name": "Däuber, Laura", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Friesenheim", "birth_year": 2003, "source_row": 77},
{"party": "GRÜNE", "position": 70, "person_name": "Simon Schwarz", "source_name": "Schwarz, Simon", "district_number": 42, "district_name": "Pforzheim", "candidacy_role": "direct", "residence": "Pfinztal", "birth_year": 1982, "source_row": 78},
{"party": "CDU", "position": 1, "person_name": "Manuel Hagel", "source_name": "Hagel, Manuel", "district_number": 65, "district_name": "Ehingen", "candidacy_role": "direct", "residence": "Ehingen (Donau)", "birth_year": 1988, "source_row": 79},
{"party": "CDU", "position": 2, "person_name": "Nicole Razavi", "source_name": "Razavi, Nicole", "district_number": 11, "district_name": "Geislingen", "candidacy_role": "direct", "residence": "Salach", "birth_year": 1965, "source_row": 80},
{"party": "CDU", "position": 3, "person_name": "Marion Gentges", "source_name": "Gentges, Marion", "district_number": 50, "district_name": "Lahr", "candidacy_role": "direct", "residence": "Zell am Harmersbach", "birth_year": 1971, "source_row": 81},
{"party": "CDU", "position": 4, "person_name": "Thomas Strobl", "source_name": "Strobl, Thomas", "district_number": 18, "district_name": "Heilbronn", "candidacy_role": "direct", "residence": "Heilbronn", "birth_year": 1960, "source_row": 82},
{"party": "CDU", "position": 5, "person_name": "Nicole Hoffmeister-Kraut", "source_name": "Dr. Hoffmeister-Kraut, Nicole", "district_number": 63, "district_name": "Balingen", "candidacy_role": "direct", "residence": "Balingen", "birth_year": 1972, "source_row": 83},
{"party": "CDU", "position": 6, "person_name": "Bastian Schneider", "source_name": "Dr. Schneider, Bastian", "district_number": 39, "district_name": "Weinheim", "candidacy_role": "direct", "residence": "Edingen-Neckarhausen", "birth_year": 1990, "source_row": 84},
{"party": "CDU", "position": 7, "person_name": "Cornelia von Loga", "source_name": "von Loga, Cornelia", "district_number": 33, "district_name": "Baden-Baden", "candidacy_role": "direct", "residence": "Baden-Baden", "birth_year": 1979, "source_row": 85},
{"party": "CDU", "position": 8, "person_name": "Andreas Deuschle", "source_name": "Deuschle, Andreas", "district_number": 7, "district_name": "Esslingen", "candidacy_role": "direct", "residence": "Esslingen am Neckar", "birth_year": 1978, "source_row": 86},
{"party": "CDU", "position": 9, "person_name": "Teresa Schreiber", "source_name": "Schreiber, Teresa", "district_number": 1, "district_name": "Stuttgart I", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1998, "source_row": 87},
{"party": "CDU", "position": 10, "person_name": "Volker Schebesta", "source_name": "Schebesta, Volker", "district_number": 51, "district_name": "Offenburg", "candidacy_role": "direct", "residence": "Offenburg", "birth_year": 1971, "source_row": 88},
{"party": "CDU", "position": 11, "person_name": "Tobias Vogt", "source_name": "Vogt, Tobias", "district_number": 14, "district_name": "Bietigheim-Bissingen", "candidacy_role": "direct", "residence": "Kirchheim am Neckar", "birth_year": 1985, "source_row": 89},
{"party": "CDU", "position": 12, "person_name": "Isabell Huber", "source_name": "Huber, Isabell", "district_number": 20, "district_name": "Neckarsulm", "candidacy_role": "direct", "residence": "Wüstenrot", "birth_year": 1987, "source_row": 90},
{"party": "CDU", "position": 13, "person_name": "Thomas Dörflinger", "source_name": "Dörflinger, Thomas", "district_number": 66, "district_name": "Biberach", "candidacy_role": "direct", "residence": "Ummendorf", "birth_year": 1969, "source_row": 91},
{"party": "CDU", "position": 14, "person_name": "Patrick Rapp", "source_name": "Dr. Rapp, Patrick", "district_number": 48, "district_name": "Breisgau", "candidacy_role": "direct", "residence": "Oberried", "birth_year": 1969, "source_row": 92},
{"party": "CDU", "position": 15, "person_name": "Ansgar Mayr", "source_name": "Mayr, Ansgar", "district_number": 30, "district_name": "Bretten", "candidacy_role": "direct", "residence": "Stutensee", "birth_year": 1972, "source_row": 93},
{"party": "CDU", "position": 16, "person_name": "Siegfried Lorek", "source_name": "Lorek, Siegfried", "district_number": 15, "district_name": "Waiblingen", "candidacy_role": "direct", "residence": "Winnenden", "birth_year": 1977, "source_row": 94},
{"party": "CDU", "position": 17, "person_name": "Sarah Schweizer", "source_name": "Schweizer, Sarah", "district_number": 10, "district_name": "Göppingen", "candidacy_role": "direct", "residence": "Göppingen", "birth_year": 1983, "source_row": 95},
{"party": "CDU", "position": 18, "person_name": "Katrin Schütz", "source_name": "Schütz, Katrin", "district_number": 28, "district_name": "Karlsruhe II", "candidacy_role": "direct", "residence": "Karlsruhe", "birth_year": 1967, "source_row": 96},
{"party": "CDU", "position": 19, "person_name": "Raimund Haser", "source_name": "Haser, Raimund", "district_number": 68, "district_name": "Wangen", "candidacy_role": "direct", "residence": "Kißlegg", "birth_year": 1975, "source_row": 97},
{"party": "CDU", "position": 20, "person_name": "Katrin Kern", "source_name": "Kern, Katrin", "district_number": 47, "district_name": "Freiburg II", "candidacy_role": "direct", "residence": "Freiburg im Breisgau", "birth_year": 1980, "source_row": 98},
{"party": "CDU", "position": 21, "person_name": "Christian Gehring", "source_name": "Gehring, Christian", "district_number": 16, "district_name": "Schorndorf", "candidacy_role": "direct", "residence": "Kernen im Remstal", "birth_year": 1979, "source_row": 99},
{"party": "CDU", "position": 22, "person_name": "Natalie Pfau-Weller", "source_name": "Dr. Pfau-Weller, Natalie", "district_number": 8, "district_name": "Kirchheim", "candidacy_role": "direct", "residence": "Kirchheim unter Teck", "birth_year": 1987, "source_row": 100},
{"party": "CDU", "position": 23, "person_name": "Lennart Christ", "source_name": "Christ, Lennart", "district_number": 35, "district_name": "Mannheim I", "candidacy_role": "direct", "residence": "Mannheim", "birth_year": 1998, "source_row": 101},
{"party": "CDU", "position": 24, "person_name": "Ilona Boos", "source_name": "Boos, Ilona", "district_number": 70, "district_name": "Sigmaringen", "candidacy_role": "direct", "residence": "Meßkirch", "birth_year": 1973, "source_row": 102},
{"party": "CDU", "position": 25, "person_name": "Stefan Teufel", "source_name": "Teufel, Stefan", "district_number": 53, "district_name": "Rottweil", "candidacy_role": "direct", "residence": "Zimmern ob Rottweil", "birth_year": 1972, "source_row": 103},
{"party": "CDU", "position": 26, "person_name": "Michael Preusch", "source_name": "Dr. Preusch, Michael", "district_number": 19, "district_name": "Eppingen", "candidacy_role": "direct", "residence": "Eppingen", "birth_year": 1975, "source_row": 104},
{"party": "CDU", "position": 27, "person_name": "Katrin Schindele", "source_name": "Schindele, Katrin", "district_number": 45, "district_name": "Freudenstadt", "candidacy_role": "direct", "residence": "Baiersbronn", "birth_year": 1987, "source_row": 105},
{"party": "CDU", "position": 28, "person_name": "Isabell Rathgeb", "source_name": "Rathgeb, Isabell", "district_number": 22, "district_name": "Schwäbisch Hall", "candidacy_role": "direct", "residence": "Stimpfach", "birth_year": 1980, "source_row": 106},
{"party": "CDU", "position": 29, "person_name": "Manuel Hailfinger", "source_name": "Hailfinger, Manuel", "district_number": 61, "district_name": "Hechingen-Münsingen", "candidacy_role": "direct", "residence": "Sonnenbühl", "birth_year": 1982, "source_row": 107},
{"party": "CDU", "position": 30, "person_name": "Guido Wolf", "source_name": "Wolf, Guido", "district_number": 55, "district_name": "Tuttlingen-Donaueschingen", "candidacy_role": "direct", "residence": "Tuttlingen", "birth_year": 1961, "source_row": 108},
{"party": "CDU", "position": 31, "person_name": "Regina Dvořák-Vučetić", "source_name": "Dvořák-Vučetić, Regina", "district_number": 5, "district_name": "Böblingen", "candidacy_role": "direct", "residence": "Böblingen", "birth_year": 1974, "source_row": 109},
{"party": "CDU", "position": 32, "person_name": "Andreas Sturm", "source_name": "Sturm, Andreas", "district_number": 40, "district_name": "Schwetzingen", "candidacy_role": "direct", "residence": "Neulußheim", "birth_year": 1986, "source_row": 110},
{"party": "CDU", "position": 33, "person_name": "Tim Breitkreuz", "source_name": "Dr. Breitkreuz, Tim", "district_number": 21, "district_name": "Hohenlohe", "candidacy_role": "direct", "residence": "Untermünkheim", "birth_year": 1994, "source_row": 111},
{"party": "CDU", "position": 34, "person_name": "Antje Rommelspacher", "source_name": "Rommelspacher, Antje", "district_number": 69, "district_name": "Ravensburg", "candidacy_role": "direct", "residence": "Ravensburg", "birth_year": 1974, "source_row": 112},
{"party": "CDU", "position": 35, "person_name": "Andrea Gnann", "source_name": "Gnann, Andrea", "district_number": 56, "district_name": "Konstanz", "candidacy_role": "direct", "residence": "Radolfzell am Bodensee", "birth_year": 1977, "source_row": 113},
{"party": "CDU", "position": 36, "person_name": "Nicole Huber", "source_name": "Huber, Nicole", "district_number": 34, "district_name": "Heidelberg", "candidacy_role": "direct", "residence": "Heidelberg", "birth_year": 1973, "source_row": 114},
{"party": "CDU", "position": 37, "person_name": "Maren Steege", "source_name": "Steege, Maren", "district_number": 9, "district_name": "Nürtingen", "candidacy_role": "direct", "residence": "Filderstadt", "birth_year": 1982, "source_row": 115},
{"party": "CDU", "position": 38, "person_name": "Shajeevan Thavakkumar", "source_name": "Thavakkumar, Shajeevan", "district_number": 3, "district_name": "Stuttgart III", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1993, "source_row": 116},
{"party": "CDU", "position": 39, "person_name": "Theresa Keller", "source_name": "Keller, Theresa", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Ulm", "birth_year": 1994, "source_row": 117},
{"party": "CDU", "position": 40, "person_name": "Nico Gunzelmann", "source_name": "Gunzelmann, Nico", "district_number": 44, "district_name": "Enz", "candidacy_role": "direct", "residence": "Wiernsheim", "birth_year": 2002, "source_row": 118},
{"party": "CDU", "position": 41, "person_name": "Johannes Vetter", "source_name": "Vetter, Johannes", "district_number": 50, "district_name": "Lahr", "candidacy_role": "substitute", "residence": "Offenburg", "birth_year": 1993, "source_row": 119},
{"party": "CDU", "position": 42, "person_name": "Tatjana Strohmaier", "source_name": "Strohmaier, Tatjana", "district_number": 4, "district_name": "Stuttgart IV", "candidacy_role": "substitute", "residence": "Stuttgart", "birth_year": 1983, "source_row": 120},
{"party": "CDU", "position": 43, "person_name": "Sengül Engelhorn", "source_name": "Engelhorn, Sengül", "district_number": 36, "district_name": "Mannheim II", "candidacy_role": "direct", "residence": "Mannheim", "birth_year": 1975, "source_row": 121},
{"party": "CDU", "position": 44, "person_name": "Konrad Epple", "source_name": "Epple, Konrad", "district_number": 13, "district_name": "Vaihingen", "candidacy_role": "direct", "residence": "Ditzingen", "birth_year": 1963, "source_row": 122},
{"party": "CDU", "position": 45, "person_name": "Maximilian Menton", "source_name": "Dr. Menton, Maximilian", "district_number": 60, "district_name": "Reutlingen", "candidacy_role": "direct", "residence": "Reutlingen", "birth_year": 1995, "source_row": 123},
{"party": "CDU", "position": 46, "person_name": "Katrin Merkel", "source_name": "Dr. Merkel, Katrin", "district_number": 52, "district_name": "Kehl", "candidacy_role": "direct", "residence": "Kappelrodeck", "birth_year": 1981, "source_row": 124},
{"party": "CDU", "position": 47, "person_name": "Jessica Kläber", "source_name": "Kläber, Jessica", "district_number": 6, "district_name": "Leonberg", "candidacy_role": "substitute", "residence": "Rutesheim", "birth_year": 1987, "source_row": 125},
{"party": "CDU", "position": 48, "person_name": "Robin Schuster", "source_name": "Schuster, Robin", "district_number": 27, "district_name": "Karlsruhe I", "candidacy_role": "direct", "residence": "Karlsruhe", "birth_year": 1984, "source_row": 126},
{"party": "CDU", "position": 49, "person_name": "Steffen Kirsch", "source_name": "Kirsch, Steffen", "district_number": 12, "district_name": "Ludwigsburg", "candidacy_role": "substitute", "residence": "Remseck am Neckar", "birth_year": 1981, "source_row": 127},
{"party": "CDU", "position": 50, "person_name": "Alexander Bruns", "source_name": "Dr. Bruns, Alexander", "district_number": 67, "district_name": "Bodensee", "candidacy_role": "direct", "residence": "Überlingen", "birth_year": 1966, "source_row": 128},
{"party": "CDU", "position": 51, "person_name": "Andreas Braun", "source_name": "Braun, Andreas", "district_number": 54, "district_name": "Villingen-Schwenningen", "candidacy_role": "direct", "residence": "Unterkirnach", "birth_year": 1982, "source_row": 129},
{"party": "CDU", "position": 52, "person_name": "Selina Häußer", "source_name": "Häußer, Selina", "district_number": 17, "district_name": "Backnang", "candidacy_role": "substitute", "residence": "Backnang", "birth_year": 2001, "source_row": 130},
{"party": "CDU", "position": 53, "person_name": "Sabine Brenner", "source_name": "Brenner, Sabine", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Mannheim", "birth_year": 1962, "source_row": 131},
{"party": "CDU", "position": 54, "person_name": "Diana Arnold", "source_name": "Arnold, Diana", "district_number": 62, "district_name": "Tübingen", "candidacy_role": "direct", "residence": "Rottenburg am Neckar", "birth_year": 1982, "source_row": 132},
{"party": "CDU", "position": 55, "person_name": "Max Müller", "source_name": "Müller, Max", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Göppingen", "birth_year": 1997, "source_row": 133},
{"party": "CDU", "position": 56, "person_name": "Angelika Doetsch", "source_name": "Doetsch, Angelika", "district_number": 46, "district_name": "Freiburg I", "candidacy_role": "substitute", "residence": "Kirchzarten", "birth_year": 1965, "source_row": 134},
{"party": "CDU", "position": 57, "person_name": "Lorenzo Saladino", "source_name": "Saladino, Lorenzo", "district_number": 31, "district_name": "Ettlingen", "candidacy_role": "direct", "residence": "Ettlingen", "birth_year": 1981, "source_row": 135},
{"party": "CDU", "position": 58, "person_name": "Theresia Paul", "source_name": "Paul, Theresia", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Bad Mergentheim", "birth_year": 1989, "source_row": 136},
{"party": "CDU", "position": 59, "person_name": "Ann-Cathrin Müller", "source_name": "Müller, Ann-Cathrin", "district_number": 61, "district_name": "Hechingen-Münsingen", "candidacy_role": "substitute", "residence": "Pfronstetten", "birth_year": 1975, "source_row": 137},
{"party": "CDU", "position": 60, "person_name": "Georg Müller", "source_name": "Dr. Müller, Georg", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Pforzheim", "birth_year": 1960, "source_row": 138},
{"party": "CDU", "position": 61, "person_name": "Elena Nowitzki", "source_name": "Nowitzki, Elena", "district_number": 30, "district_name": "Bretten", "candidacy_role": "substitute", "residence": "Oberderdingen", "birth_year": 1982, "source_row": 139},
{"party": "CDU", "position": 62, "person_name": "Natascha Thoma-Widmann", "source_name": "Thoma-Widmann, Natascha", "district_number": 48, "district_name": "Breisgau", "candidacy_role": "substitute", "residence": "Ebringen", "birth_year": 1971, "source_row": 140},
{"party": "CDU", "position": 63, "person_name": "Heike Breitenbücher", "source_name": "Breitenbücher, Heike", "district_number": 14, "district_name": "Bietigheim-Bissingen", "candidacy_role": "substitute", "residence": "Marbach am Neckar", "birth_year": 1967, "source_row": 141},
{"party": "CDU", "position": 64, "person_name": "Martina Seif", "source_name": "Seif, Martina", "district_number": 60, "district_name": "Reutlingen", "candidacy_role": "substitute", "residence": "Dußlingen", "birth_year": 1977, "source_row": 142},
{"party": "CDU", "position": 65, "person_name": "Sandra Bühler", "source_name": "Bühler, Sandra", "district_number": 39, "district_name": "Weinheim", "candidacy_role": "substitute", "residence": "Ilvesheim", "birth_year": 1971, "source_row": 143},
{"party": "CDU", "position": 66, "person_name": "Hans-Jörg Autenrieth", "source_name": "Autenrieth, Hans-Jörg", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Eislingen/Fils", "birth_year": 1966, "source_row": 144},
{"party": "CDU", "position": 67, "person_name": "Christoph Stetter", "source_name": "Stetter, Christoph", "district_number": 57, "district_name": "Singen", "candidacy_role": "direct", "residence": "Stockach", "birth_year": 1981, "source_row": 145},
{"party": "CDU", "position": 68, "person_name": "Petra Zein", "source_name": "Zein, Petra", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Heidenheim an der Brenz", "birth_year": 1965, "source_row": 146},
{"party": "CDU", "position": 69, "person_name": "Alexander Becker", "source_name": "Dr. Becker, Alexander", "district_number": 32, "district_name": "Rastatt", "candidacy_role": "direct", "residence": "Ötigheim", "birth_year": 1972, "source_row": 147},
{"party": "CDU", "position": 70, "person_name": "Kerstin Specht", "source_name": "Specht, Kerstin", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Laichingen", "birth_year": 1978, "source_row": 148},
{"party": "CDU", "position": 71, "person_name": "Uttam Das", "source_name": "Dr. Das, Uttam", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Besigheim", "birth_year": 1972, "source_row": 149},
{"party": "CDU", "position": 72, "person_name": "Alexandra Mußler", "source_name": "Mußler, Alexandra", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Rheinfelden (Baden)", "birth_year": 1964, "source_row": 150},
{"party": "CDU", "position": 73, "person_name": "Nico Ruß", "source_name": "Ruß, Nico", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Biberach an der Riß", "birth_year": 1994, "source_row": 151},
{"party": "CDU", "position": 74, "person_name": "Karin Häußler", "source_name": "Häußler, Karin", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Giengen an der Brenz", "birth_year": 1956, "source_row": 152},
{"party": "CDU", "position": 75, "person_name": "Stephan Schwarzmüller", "source_name": "Schwarzmüller, Stephan", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Weil am Rhein", "birth_year": 1997, "source_row": 153},
{"party": "FDP", "position": 1, "person_name": "Hans-Ulrich Rülke", "source_name": "Dr. Rülke, Hans-Ulrich", "district_number": 42, "district_name": "Pforzheim", "candidacy_role": "direct", "residence": "Pforzheim", "birth_year": 1961, "source_row": 154},
{"party": "FDP", "position": 2, "person_name": "Jochen Haußmann", "source_name": "Haußmann, Jochen", "district_number": 16, "district_name": "Schorndorf", "candidacy_role": "direct", "residence": "Kernen im Remstal", "birth_year": 1966, "source_row": 155},
{"party": "FDP", "position": 3, "person_name": "Alena Fink-Trauschel", "source_name": "Fink-Trauschel, Alena", "district_number": 31, "district_name": "Ettlingen", "candidacy_role": "direct", "residence": "Ettlingen", "birth_year": 1999, "source_row": 156},
{"party": "FDP", "position": 4, "person_name": "Claudia Felden", "source_name": "Felden, Claudia", "district_number": 37, "district_name": "Wiesloch", "candidacy_role": "direct", "residence": "Leimen", "birth_year": 1960, "source_row": 157},
{"party": "FDP", "position": 5, "person_name": "Erik Schweickert", "source_name": "Dr. Schweickert, Erik", "district_number": 44, "district_name": "Enz", "candidacy_role": "direct", "residence": "Niefern-Öschelbronn", "birth_year": 1972, "source_row": 158},
{"party": "FDP", "position": 6, "person_name": "Friedrich Haag", "source_name": "Haag, Friedrich", "district_number": 2, "district_name": "Stuttgart II", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1989, "source_row": 159},
{"party": "FDP", "position": 7, "person_name": "Nico Weinmann", "source_name": "Weinmann, Nico", "district_number": 18, "district_name": "Heilbronn", "candidacy_role": "direct", "residence": "Heilbronn", "birth_year": 1972, "source_row": 160},
{"party": "FDP", "position": 8, "person_name": "Daniel Karrais", "source_name": "Karrais, Daniel", "district_number": 53, "district_name": "Rottweil", "candidacy_role": "direct", "residence": "Rottweil", "birth_year": 1990, "source_row": 161},
{"party": "FDP", "position": 9, "person_name": "Nikolai Reith", "source_name": "Reith, Nikolai", "district_number": 55, "district_name": "Tuttlingen-Donaueschingen", "candidacy_role": "direct", "residence": "Donaueschingen", "birth_year": 1969, "source_row": 162},
{"party": "FDP", "position": 10, "person_name": "Julia Goll", "source_name": "Goll, Julia", "district_number": 15, "district_name": "Waiblingen", "candidacy_role": "direct", "residence": "Waiblingen", "birth_year": 1964, "source_row": 163},
{"party": "FDP", "position": 11, "person_name": "Timm Kern", "source_name": "Dr. Kern, Timm", "district_number": 61, "district_name": "Hechingen-Münsingen", "candidacy_role": "direct", "residence": "Tübingen", "birth_year": 1972, "source_row": 164},
{"party": "FDP", "position": 12, "person_name": "Christian Jung", "source_name": "Dr. Jung, Christian", "district_number": 30, "district_name": "Bretten", "candidacy_role": "direct", "residence": "Bruchsal", "birth_year": 1977, "source_row": 165},
{"party": "FDP", "position": 13, "person_name": "Klaus Hoher", "source_name": "Hoher, Klaus", "district_number": 67, "district_name": "Bodensee", "candidacy_role": "direct", "residence": "Salem", "birth_year": 1968, "source_row": 166},
{"party": "FDP", "position": 14, "person_name": "Georg Heitlinger", "source_name": "Heitlinger, Georg", "district_number": 19, "district_name": "Eppingen", "candidacy_role": "direct", "residence": "Eppingen", "birth_year": 1970, "source_row": 167},
{"party": "FDP", "position": 15, "person_name": "Hans Dieter Scheerer", "source_name": "Scheerer, Hans Dieter", "district_number": 6, "district_name": "Leonberg", "candidacy_role": "direct", "residence": "Weil der Stadt", "birth_year": 1958, "source_row": 168},
{"party": "FDP", "position": 16, "person_name": "Dennis Birnstock", "source_name": "Birnstock, Dennis", "district_number": 9, "district_name": "Nürtingen", "candidacy_role": "direct", "residence": "Filderstadt", "birth_year": 1991, "source_row": 169},
{"party": "FDP", "position": 17, "person_name": "Tim Nusser", "source_name": "Nusser, Tim", "district_number": 34, "district_name": "Heidelberg", "candidacy_role": "direct", "residence": "Heidelberg", "birth_year": 1996, "source_row": 170},
{"party": "FDP", "position": 18, "person_name": "Sanja Tömmes", "source_name": "Tömmes, Sanja", "district_number": 52, "district_name": "Kehl", "candidacy_role": "direct", "residence": "Kehl", "birth_year": 1973, "source_row": 171},
{"party": "FDP", "position": 19, "person_name": "Patrick Konopka", "source_name": "Konopka, Patrick", "district_number": 56, "district_name": "Konstanz", "candidacy_role": "direct", "residence": "Allensbach", "birth_year": 1981, "source_row": 172},
{"party": "FDP", "position": 20, "person_name": "Irene Schuster", "source_name": "Schuster, Irene", "district_number": 62, "district_name": "Tübingen", "candidacy_role": "direct", "residence": "Tübingen", "birth_year": 1988, "source_row": 173},
{"party": "FDP", "position": 21, "person_name": "Anja Widenmann", "source_name": "Widenmann, Anja", "district_number": 69, "district_name": "Ravensburg", "candidacy_role": "direct", "residence": "Schlier", "birth_year": 1998, "source_row": 174},
{"party": "FDP", "position": 22, "person_name": "Wolfgang Vogt", "source_name": "Vogt, Wolfgang", "district_number": 12, "district_name": "Ludwigsburg", "candidacy_role": "direct", "residence": "Ludwigsburg", "birth_year": 1965, "source_row": 175},
{"party": "FDP", "position": 23, "person_name": "Kathrin Kölbl", "source_name": "Kölbl, Kathrin", "district_number": 36, "district_name": "Mannheim II", "candidacy_role": "direct", "residence": "Mannheim", "birth_year": 1963, "source_row": 176},
{"party": "FDP", "position": 24, "person_name": "Luca Köngeter", "source_name": "Köngeter, Luca", "district_number": 22, "district_name": "Schwäbisch Hall", "candidacy_role": "direct", "residence": "Gaildorf", "birth_year": 2004, "source_row": 177},
{"party": "FDP", "position": 25, "person_name": "Albrecht Raible", "source_name": "Raible, Albrecht", "district_number": 63, "district_name": "Balingen", "candidacy_role": "direct", "residence": "Hechingen", "birth_year": 1985, "source_row": 178},
{"party": "FDP", "position": 26, "person_name": "Nathalie Wagner", "source_name": "Wagner, Nathalie", "district_number": 59, "district_name": "Waldshut", "candidacy_role": "direct", "residence": "Waldshut-Tiengen", "birth_year": 1994, "source_row": 179},
{"party": "FDP", "position": 27, "person_name": "Helena Herzig", "source_name": "Herzig, Helena", "district_number": 13, "district_name": "Vaihingen", "candidacy_role": "direct", "residence": "Ditzingen", "birth_year": 1999, "source_row": 180},
{"party": "FDP", "position": 28, "person_name": "Finn Pfaller", "source_name": "Pfaller, Finn", "district_number": 21, "district_name": "Hohenlohe", "candidacy_role": "direct", "residence": "Tübingen", "birth_year": 2002, "source_row": 181},
{"party": "FDP", "position": 29, "person_name": "Oskar Weiß", "source_name": "Weiß, Oskar", "district_number": 35, "district_name": "Mannheim I", "candidacy_role": "direct", "residence": "Mannheim", "birth_year": 2003, "source_row": 182},
{"party": "FDP", "position": 30, "person_name": "Klara Sanwald", "source_name": "Sanwald, Klara", "district_number": 24, "district_name": "Heidenheim", "candidacy_role": "direct", "residence": "Heidenheim an der Brenz", "birth_year": 1998, "source_row": 183},
{"party": "FDP", "position": 31, "person_name": "Anke Hillmann-Richter", "source_name": "Hillmann-Richter, Anke", "district_number": 64, "district_name": "Ulm", "candidacy_role": "direct", "residence": "Ulm", "birth_year": 1973, "source_row": 184},
{"party": "FDP", "position": 32, "person_name": "Linus Kionka", "source_name": "Kionka, Linus", "district_number": 47, "district_name": "Freiburg II", "candidacy_role": "direct", "residence": "Ihringen", "birth_year": 2005, "source_row": 185},
{"party": "FDP", "position": 33, "person_name": "Björn Brenner", "source_name": "Dr. Brenner, Björn", "district_number": 70, "district_name": "Sigmaringen", "candidacy_role": "direct", "residence": "Albstadt", "birth_year": 1982, "source_row": 186},
{"party": "FDP", "position": 34, "person_name": "Marc Juric", "source_name": "Juric, Marc", "district_number": 17, "district_name": "Backnang", "candidacy_role": "direct", "residence": "Aspach", "birth_year": 1991, "source_row": 187},
{"party": "FDP", "position": 35, "person_name": "Ann-Kathrin Stulz", "source_name": "Stulz, Ann-Kathrin", "district_number": 51, "district_name": "Offenburg", "candidacy_role": "direct", "residence": "Durbach", "birth_year": 2003, "source_row": 188},
{"party": "FDP", "position": 36, "person_name": "Christine Watrinet", "source_name": "Dr. Watrinet, Christine", "district_number": 5, "district_name": "Böblingen", "candidacy_role": "direct", "residence": "Holzgerlingen", "birth_year": 1965, "source_row": 189},
{"party": "FDP", "position": 37, "person_name": "Sean-Anthony Braun von Stumm", "source_name": "Braun von Stumm, Sean-Anthony", "district_number": 28, "district_name": "Karlsruhe II", "candidacy_role": "direct", "residence": "Karlsruhe", "birth_year": 1997, "source_row": 190},
{"party": "FDP", "position": 38, "person_name": "Juliane Becker", "source_name": "Becker, Juliane", "district_number": 4, "district_name": "Stuttgart IV", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1969, "source_row": 191},
{"party": "FDP", "position": 39, "person_name": "Matthias Mand", "source_name": "Mand, Matthias", "district_number": 49, "district_name": "Emmendingen", "candidacy_role": "direct", "residence": "Kenzingen", "birth_year": 1980, "source_row": 192},
{"party": "FDP", "position": 40, "person_name": "Claudia Schober", "source_name": "Schober, Claudia", "district_number": 1, "district_name": "Stuttgart I", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1976, "source_row": 193},
{"party": "FDP", "position": 41, "person_name": "Niclas Moldenhauer", "source_name": "Dr. Moldenhauer, Niclas", "district_number": 29, "district_name": "Bruchsal", "candidacy_role": "direct", "residence": "Bruchsal", "birth_year": 1988, "source_row": 194},
{"party": "FDP", "position": 42, "person_name": "Felix Düster", "source_name": "Düster, Felix", "district_number": 58, "district_name": "Lörrach", "candidacy_role": "direct", "residence": "Grenzach-Wyhlen", "birth_year": 1990, "source_row": 195},
{"party": "FDP", "position": 43, "person_name": "Daniel Derscheid", "source_name": "Derscheid, Daniel", "district_number": 68, "district_name": "Wangen", "candidacy_role": "direct", "residence": "Vogt", "birth_year": 1986, "source_row": 196},
{"party": "FDP", "position": 44, "person_name": "Paul Wien", "source_name": "Wien, Paul", "district_number": 14, "district_name": "Bietigheim-Bissingen", "candidacy_role": "direct", "residence": "Großbottwar", "birth_year": 1990, "source_row": 197},
{"party": "FDP", "position": 45, "person_name": "Petra Zink", "source_name": "Zink, Petra", "district_number": 32, "district_name": "Rastatt", "candidacy_role": "direct", "residence": "Gaggenau", "birth_year": 1984, "source_row": 198},
{"party": "FDP", "position": 46, "person_name": "Tobias Wirth", "source_name": "Wirth, Tobias", "district_number": 7, "district_name": "Esslingen", "candidacy_role": "direct", "residence": "Esslingen am Neckar", "birth_year": 2005, "source_row": 199},
{"party": "FDP", "position": 47, "person_name": "Alexander Hampo", "source_name": "Hampo, Alexander", "district_number": 20, "district_name": "Neckarsulm", "candidacy_role": "direct", "residence": "Weinsberg", "birth_year": 1997, "source_row": 200},
{"party": "FDP", "position": 48, "person_name": "Chris-Robert Berendt", "source_name": "Berendt, Chris-Robert", "district_number": 25, "district_name": "Schwäbisch Gmünd", "candidacy_role": "direct", "residence": "Winnenden", "birth_year": 1978, "source_row": 201},
{"party": "FDP", "position": 49, "person_name": "Nicole Falkenstein", "source_name": "Falkenstein, Nicole", "district_number": 8, "district_name": "Kirchheim", "candidacy_role": "direct", "residence": "Kirchheim unter Teck", "birth_year": 1972, "source_row": 202},
{"party": "FDP", "position": 50, "person_name": "Peter Körber", "source_name": "Körber, Peter", "district_number": 10, "district_name": "Göppingen", "candidacy_role": "direct", "residence": "Wäschenbeuren", "birth_year": 1964, "source_row": 203},
{"party": "FDP", "position": 51, "person_name": "Lothar Hanser", "source_name": "Hanser, Lothar", "district_number": 48, "district_name": "Breisgau", "candidacy_role": "direct", "residence": "Pfaffenweiler", "birth_year": 1954, "source_row": 204},
{"party": "FDP", "position": 52, "person_name": "Holger Höfs", "source_name": "Höfs, Holger", "district_number": 40, "district_name": "Schwetzingen", "candidacy_role": "direct", "residence": "Oftersheim", "birth_year": 1966, "source_row": 205},
{"party": "FDP", "position": 53, "person_name": "Heschu Hasan", "source_name": "Hasan, Heschu", "district_number": 46, "district_name": "Freiburg I", "candidacy_role": "direct", "residence": "Kirchzarten", "birth_year": 1989, "source_row": 206},
{"party": "FDP", "position": 54, "person_name": "Christian Ritter", "source_name": "Ritter, Christian", "district_number": 38, "district_name": "Neckar-Odenwald", "candidacy_role": "direct", "residence": "Haßmersheim", "birth_year": 1986, "source_row": 207},
{"party": "FDP", "position": 55, "person_name": "Jennifer Röcker", "source_name": "Röcker, Jennifer", "district_number": 11, "district_name": "Geislingen", "candidacy_role": "direct", "residence": "Kuchen", "birth_year": 1979, "source_row": 208},
{"party": "FDP", "position": 56, "person_name": "Jörg Breier", "source_name": "Breier, Jörg", "district_number": 27, "district_name": "Karlsruhe I", "candidacy_role": "direct", "residence": "Karlsruhe", "birth_year": 1973, "source_row": 209},
{"party": "FDP", "position": 57, "person_name": "Uwe Schwarz", "source_name": "Schwarz, Uwe", "district_number": 65, "district_name": "Ehingen", "candidacy_role": "direct", "residence": "Berghülen", "birth_year": 1966, "source_row": 210},
{"party": "FDP", "position": 58, "person_name": "Andrea Pachaly-Szalay", "source_name": "Pachaly-Szalay, Andrea", "district_number": 42, "district_name": "Pforzheim", "candidacy_role": "substitute", "residence": "Pforzheim", "birth_year": 1969, "source_row": 211},
{"party": "FDP", "position": 59, "person_name": "Oliver Lukner", "source_name": "Lukner, Oliver", "district_number": 66, "district_name": "Biberach", "candidacy_role": "direct", "residence": "Biberach an der Riß", "birth_year": 1970, "source_row": 212},
{"party": "FDP", "position": 60, "person_name": "Udo Zahn", "source_name": "Zahn, Udo", "district_number": 50, "district_name": "Lahr", "candidacy_role": "direct", "residence": "Ringsheim", "birth_year": 1978, "source_row": 213},
{"party": "FDP", "position": 61, "person_name": "Veit Grünberg", "source_name": "Grünberg, Veit", "district_number": 45, "district_name": "Freudenstadt", "candidacy_role": "direct", "residence": "Pfalzgrafenweiler", "birth_year": 1994, "source_row": 214},
{"party": "FDP", "position": 62, "person_name": "Nico Klemann", "source_name": "Klemann, Nico", "district_number": 57, "district_name": "Singen", "candidacy_role": "direct", "residence": "Singen (Hohentwiel)", "birth_year": 1993, "source_row": 215},
{"party": "FDP", "position": 63, "person_name": "Karl-Georg Degenhardt", "source_name": "Degenhardt, Karl-Georg", "district_number": 33, "district_name": "Baden-Baden", "candidacy_role": "direct", "residence": "Baden-Baden", "birth_year": 1958, "source_row": 216},
{"party": "FDP", "position": 64, "person_name": "Olaf Hautzinger", "source_name": "Hautzinger, Olaf", "district_number": 41, "district_name": "Sinsheim", "candidacy_role": "direct", "residence": "Sinsheim", "birth_year": 1981, "source_row": 217},
{"party": "FDP", "position": 65, "person_name": "Felix Wanke", "source_name": "Wanke, Felix", "district_number": 26, "district_name": "Aalen", "candidacy_role": "direct", "residence": "Hüttlingen", "birth_year": 1998, "source_row": 218},
{"party": "FDP", "position": 66, "person_name": "Christian Schwarz", "source_name": "Schwarz, Christian", "district_number": 39, "district_name": "Weinheim", "candidacy_role": "direct", "residence": "Ladenburg", "birth_year": 1976, "source_row": 219},
{"party": "AfD", "position": 1, "person_name": "Emil Sänze", "source_name": "Sänze, Emil", "district_number": 53, "district_name": "Rottweil", "candidacy_role": "direct", "residence": "Sulz am Neckar", "birth_year": 1950, "source_row": 220},
{"party": "AfD", "position": 2, "person_name": "Martin Rothweiler", "source_name": "Rothweiler, Martin", "district_number": 54, "district_name": "Villingen-Schwenningen", "candidacy_role": "direct", "residence": "Villingen-Schwenningen", "birth_year": 1978, "source_row": 221},
{"party": "AfD", "position": 3, "person_name": "Anton Baron", "source_name": "Baron, Anton", "district_number": 21, "district_name": "Hohenlohe", "candidacy_role": "direct", "residence": "Öhringen", "birth_year": 1987, "source_row": 222},
{"party": "AfD", "position": 4, "person_name": "Daniel Lindenschmid", "source_name": "Lindenschmid, Daniel", "district_number": 17, "district_name": "Backnang", "candidacy_role": "direct", "residence": "Backnang", "birth_year": 1992, "source_row": 223},
{"party": "AfD", "position": 5, "person_name": "Dennis Klecker", "source_name": "Klecker, Dennis", "district_number": 19, "district_name": "Eppingen", "candidacy_role": "direct", "residence": "Ilsfeld", "birth_year": 1990, "source_row": 224},
{"party": "AfD", "position": 6, "person_name": "Miguel Klauß", "source_name": "Klauß, Miguel", "district_number": 43, "district_name": "Calw", "candidacy_role": "direct", "residence": "Nagold", "birth_year": 1986, "source_row": 225},
{"party": "AfD", "position": 7, "person_name": "Bernhard Eisenhut", "source_name": "Eisenhut, Bernhard", "district_number": 57, "district_name": "Singen", "candidacy_role": "direct", "residence": "Rielasingen-Worblingen", "birth_year": 1958, "source_row": 226},
{"party": "AfD", "position": 8, "person_name": "Carmen Haug", "source_name": "Haug, Carmen", "district_number": 68, "district_name": "Wangen", "candidacy_role": "direct", "residence": "Bad Waldsee", "birth_year": 1976, "source_row": 227},
{"party": "AfD", "position": 9, "person_name": "Karlheinz Kolb", "source_name": "Kolb, Karlheinz", "district_number": 40, "district_name": "Schwetzingen", "candidacy_role": "direct", "residence": "Ketsch", "birth_year": 1954, "source_row": 228},
{"party": "AfD", "position": 10, "person_name": "Hans-Peter Hörner", "source_name": "Hörner, Hans-Peter", "district_number": 63, "district_name": "Balingen", "candidacy_role": "direct", "residence": "Balingen", "birth_year": 1951, "source_row": 229},
{"party": "AfD", "position": 11, "person_name": "Sandro Scheer", "source_name": "Scheer, Sandro", "district_number": 10, "district_name": "Göppingen", "candidacy_role": "direct", "residence": "Ebersbach an der Fils", "birth_year": 1978, "source_row": 230},
{"party": "AfD", "position": 12, "person_name": "Alexsei Zimmer", "source_name": "Zimmer, Alexsei", "district_number": 42, "district_name": "Pforzheim", "candidacy_role": "direct", "residence": "Pforzheim", "birth_year": 1988, "source_row": 231},
{"party": "AfD", "position": 13, "person_name": "Joachim Kuhs", "source_name": "Kuhs, Joachim", "district_number": 33, "district_name": "Baden-Baden", "candidacy_role": "substitute", "residence": "Baden-Baden", "birth_year": 1956, "source_row": 232},
{"party": "AfD", "position": 14, "person_name": "Nikolaos Boutakoglou", "source_name": "Boutakoglou, Nikolaos", "district_number": 13, "district_name": "Vaihingen", "candidacy_role": "direct", "residence": "Vaihingen an der Enz", "birth_year": 1983, "source_row": 233},
{"party": "AfD", "position": 15, "person_name": "Andreas Auer", "source_name": "Auer, Andreas", "district_number": 6, "district_name": "Leonberg", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1962, "source_row": 234},
{"party": "AfD", "position": 16, "person_name": "Christian Köhler", "source_name": "Köhler, Christian", "district_number": 4, "district_name": "Stuttgart IV", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1968, "source_row": 235},
{"party": "AfD", "position": 17, "person_name": "Chris Hegel", "source_name": "Hegel, Chris", "district_number": 26, "district_name": "Aalen", "candidacy_role": "direct", "residence": "Aalen", "birth_year": 2000, "source_row": 236},
{"party": "AfD", "position": 18, "person_name": "Stephan Schwarz", "source_name": "Schwarz, Stephan", "district_number": 16, "district_name": "Schorndorf", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1984, "source_row": 237},
{"party": "AfD", "position": 19, "person_name": "Christian Schäfer", "source_name": "Schäfer, Christian", "district_number": 39, "district_name": "Weinheim", "candidacy_role": "direct", "residence": "Ketsch", "birth_year": 1985, "source_row": 238},
{"party": "AfD", "position": 20, "person_name": "Emely Knorr", "source_name": "Knorr, Emely", "district_number": 18, "district_name": "Heilbronn", "candidacy_role": "substitute", "residence": "Ilsfeld", "birth_year": 1986, "source_row": 239},
{"party": "AfD", "position": 21, "person_name": "Stephan Köthe", "source_name": "Köthe, Stephan", "district_number": 7, "district_name": "Esslingen", "candidacy_role": "direct", "residence": "Esslingen am Neckar", "birth_year": 1966, "source_row": 240},
{"party": "AfD", "position": 22, "person_name": "Maximilian Gerner", "source_name": "Gerner, Maximilian", "district_number": 60, "district_name": "Reutlingen", "candidacy_role": "direct", "residence": "Reutlingen", "birth_year": 1998, "source_row": 241},
{"party": "AfD", "position": 23, "person_name": "Rüdiger Ernst", "source_name": "Ernst, Rüdiger", "district_number": 36, "district_name": "Mannheim II", "candidacy_role": "direct", "residence": "Mannheim", "birth_year": 1972, "source_row": 242},
{"party": "AfD", "position": 24, "person_name": "Hans-Peter Baur", "source_name": "Baur, Hans-Peter", "district_number": 69, "district_name": "Ravensburg", "candidacy_role": "direct", "residence": "Aulendorf", "birth_year": 1959, "source_row": 243},
{"party": "AfD", "position": 25, "person_name": "Christine Schäfer", "source_name": "Schäfer, Christine", "district_number": 5, "district_name": "Böblingen", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1964, "source_row": 244},
{"party": "AfD", "position": 26, "person_name": "Sebastian van Ryt", "source_name": "van Ryt, Sebastian", "district_number": 54, "district_name": "Villingen-Schwenningen", "candidacy_role": "substitute", "residence": "Villingen-Schwenningen", "birth_year": 1986, "source_row": 245},
{"party": "AfD", "position": 27, "person_name": "Daniel Rottmann", "source_name": "Rottmann, Daniel", "district_number": 64, "district_name": "Ulm", "candidacy_role": "direct", "residence": "Ulm", "birth_year": 1969, "source_row": 246},
{"party": "AfD", "position": 28, "person_name": "Carola Wolle", "source_name": "Wolle, Carola", "district_number": 20, "district_name": "Neckarsulm", "candidacy_role": "direct", "residence": "Beilstein", "birth_year": 1963, "source_row": 247},
{"party": "AfD", "position": 29, "person_name": "Andreas Grammel", "source_name": "Grammel, Andreas", "district_number": 45, "district_name": "Freudenstadt", "candidacy_role": "direct", "residence": "Seewald", "birth_year": 1961, "source_row": 248},
{"party": "AfD", "position": 30, "person_name": "Christoforos Tsoulopoulos", "source_name": "Tsoulopoulos, Christoforos", "district_number": 12, "district_name": "Ludwigsburg", "candidacy_role": "direct", "residence": "Kornwestheim", "birth_year": 1958, "source_row": 249},
{"party": "AfD", "position": 31, "person_name": "Udo Stein", "source_name": "Stein, Udo", "district_number": 22, "district_name": "Schwäbisch Hall", "candidacy_role": "direct", "residence": "Bühlertann", "birth_year": 1983, "source_row": 250},
{"party": "AfD", "position": 32, "person_name": "Kay Rittweg", "source_name": "Rittweg, Kay", "district_number": 55, "district_name": "Tuttlingen-Donaueschingen", "candidacy_role": "direct", "residence": "Oberndorf am Neckar", "birth_year": 1979, "source_row": 251},
{"party": "AfD", "position": 33, "person_name": "Kurt Hermann", "source_name": "Hermann, Kurt", "district_number": 33, "district_name": "Baden-Baden", "candidacy_role": "direct", "residence": "Baden-Baden", "birth_year": 1963, "source_row": 252},
{"party": "AfD", "position": 34, "person_name": "Uwe Freiherr von Wangenheim", "source_name": "Freiherr von Wangenheim, Uwe", "district_number": 11, "district_name": "Geislingen", "candidacy_role": "direct", "residence": "Donzdorf", "birth_year": 1969, "source_row": 253},
{"party": "AfD", "position": 35, "person_name": "Alexander Steblau", "source_name": "Steblau, Alexander", "district_number": 44, "district_name": "Enz", "candidacy_role": "direct", "residence": "Knittlingen", "birth_year": 1985, "source_row": 254},
{"party": "AfD", "position": 36, "person_name": "Paula Gulde", "source_name": "Gulde, Paula", "district_number": 66, "district_name": "Biberach", "candidacy_role": "direct", "residence": "Riedlingen", "birth_year": 1960, "source_row": 255},
{"party": "AfD", "position": 37, "person_name": "Rouven Stolz", "source_name": "Stolz, Rouven", "district_number": 28, "district_name": "Karlsruhe II", "candidacy_role": "direct", "residence": "Karlsruhe", "birth_year": 1981, "source_row": 256},
{"party": "AfD", "position": 38, "person_name": "Tobias Dammert", "source_name": "Dammert, Tobias", "district_number": 29, "district_name": "Bruchsal", "candidacy_role": "direct", "residence": "Bruchsal", "birth_year": 1984, "source_row": 257},
{"party": "AfD", "position": 39, "person_name": "Sven Geschinski", "source_name": "Geschinski, Sven", "district_number": 34, "district_name": "Heidelberg", "candidacy_role": "direct", "residence": "Heidelberg", "birth_year": 1970, "source_row": 258},
{"party": "AfD", "position": 40, "person_name": "Andreas Mürter", "source_name": "Mürter, Andreas", "district_number": 3, "district_name": "Stuttgart III", "candidacy_role": "direct", "residence": "Wüstenrot", "birth_year": 1981, "source_row": 259},
{"party": "AfD", "position": 41, "person_name": "Tobias Eckert", "source_name": "Eckert, Tobias", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Stuttgart", "birth_year": 1986, "source_row": 260},
{"party": "AfD", "position": 42, "person_name": "Matthias Jehle", "source_name": "Jehle, Matthias", "district_number": 59, "district_name": "Waldshut", "candidacy_role": "direct", "residence": "Wehr", "birth_year": 1982, "source_row": 261},
{"party": "AfD", "position": 43, "person_name": "Günter Rentschar", "source_name": "Rentschar, Günter", "district_number": 25, "district_name": "Schwäbisch Gmünd", "candidacy_role": "direct", "residence": "Heubach", "birth_year": 1968, "source_row": 262},
{"party": "AfD", "position": 44, "person_name": "Andreas Laitenberger", "source_name": "Laitenberger, Andreas", "district_number": 30, "district_name": "Bretten", "candidacy_role": "direct", "residence": "Bretten", "birth_year": 1987, "source_row": 263},
{"party": "AfD", "position": 45, "person_name": "Oliver Schnell", "source_name": "Schnell, Oliver", "district_number": 27, "district_name": "Karlsruhe I", "candidacy_role": "direct", "residence": "Karlsruhe", "birth_year": 1963, "source_row": 264},
{"party": "AfD", "position": 46, "person_name": "Reno Geisler", "source_name": "Geisler, Reno", "district_number": 14, "district_name": "Bietigheim-Bissingen", "candidacy_role": "direct", "residence": "Markgröningen", "birth_year": 1972, "source_row": 265},
{"party": "AfD", "position": 47, "person_name": "Steffen Jahnke", "source_name": "Jahnke, Steffen", "district_number": 56, "district_name": "Konstanz", "candidacy_role": "direct", "residence": "Steißlingen", "birth_year": 1968, "source_row": 266},
{"party": "AfD", "position": 48, "person_name": "Maximilian Löbel", "source_name": "Löbel, Maximilian", "district_number": 17, "district_name": "Backnang", "candidacy_role": "substitute", "residence": "Welzheim", "birth_year": 1993, "source_row": 267},
{"party": "AfD", "position": 49, "person_name": "Michael Wittmann", "source_name": "Wittmann, Michael", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Zell unter Aichelberg", "birth_year": 1970, "source_row": 268},
{"party": "AfD", "position": 50, "person_name": "Maximilian Decker", "source_name": "Decker, Maximilian", "district_number": 18, "district_name": "Heilbronn", "candidacy_role": "direct", "residence": "Kirchardt", "birth_year": 1987, "source_row": 269},
{"party": "AfD", "position": 51, "person_name": "Thomas Nitz", "source_name": "Nitz, Thomas", "district_number": 37, "district_name": "Wiesloch", "candidacy_role": "direct", "residence": "Walldorf", "birth_year": 1972, "source_row": 270},
{"party": "AfD", "position": 52, "person_name": "Yasemin Çakir", "source_name": "Çakir, Yasemin", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Gosheim", "birth_year": 1991, "source_row": 271},
{"party": "AfD", "position": 53, "person_name": "Karl Schwarz", "source_name": "Schwarz, Karl", "district_number": 47, "district_name": "Freiburg II", "candidacy_role": "direct", "residence": "Freiburg im Breisgau", "birth_year": 1993, "source_row": 272},
{"party": "AfD", "position": 54, "person_name": "Sebastian Breitkopf", "source_name": "Breitkopf, Sebastian", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Wildberg", "birth_year": 1988, "source_row": 273},
{"party": "AfD", "position": 55, "person_name": "Harald Bühler", "source_name": "Bühler, Harald", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Herrenberg", "birth_year": 1958, "source_row": 274},
{"party": "AfD", "position": 56, "person_name": "Anna Schneider", "source_name": "Schneider, Anna", "district_number": 62, "district_name": "Tübingen", "candidacy_role": "direct", "residence": "Bodelshausen", "birth_year": 1977, "source_row": 275},
{"party": "AfD", "position": 57, "person_name": "Benjamin Götz", "source_name": "Götz, Benjamin", "district_number": 22, "district_name": "Schwäbisch Hall", "candidacy_role": "substitute", "residence": "Ilshofen", "birth_year": 1997, "source_row": 276},
{"party": "AfD", "position": 58, "person_name": "Timethy Bartesch", "source_name": "Bartesch, Timethy", "district_number": 34, "district_name": "Heidelberg", "candidacy_role": "substitute", "residence": "Heidelberg", "birth_year": 1983, "source_row": 277},
{"party": "AfD", "position": 59, "person_name": "Joachim Baumann", "source_name": "Baumann, Joachim", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Burladingen", "birth_year": 1962, "source_row": 278},
{"party": "AfD", "position": 60, "person_name": "Erik Wien", "source_name": "Wien, Erik", "district_number": null, "district_name": null, "candidacy_role": "list_only", "residence": "Baltmannsweiler", "birth_year": 1971, "source_row": 279},
{"party": "SPD", "position": 1, "person_name": "Andreas Stoch", "source_name": "Stoch, Andreas", "district_number": 24, "district_name": "Heidenheim", "candidacy_role": "direct", "residence": "Heidenheim an der Brenz", "birth_year": 1969, "source_row": 280},
{"party": "SPD", "position": 2, "person_name": "Dorothea Kliche-Behnke", "source_name": "Dr. Kliche-Behnke, Dorothea", "district_number": 62, "district_name": "Tübingen", "candidacy_role": "direct", "residence": "Tübingen", "birth_year": 1981, "source_row": 281},
{"party": "SPD", "position": 3, "person_name": "Sascha Binder", "source_name": "Binder, Sascha", "district_number": 11, "district_name": "Geislingen", "candidacy_role": "direct", "residence": "Geislingen an der Steige", "birth_year": 1983, "source_row": 282},
{"party": "SPD", "position": 4, "person_name": "Viviane Sigg", "source_name": "Sigg, Viviane", "district_number": 47, "district_name": "Freiburg II", "candidacy_role": "direct", "residence": "Freiburg im Breisgau", "birth_year": 1980, "source_row": 283},
{"party": "SPD", "position": 5, "person_name": "Stefan Fulst-Blei", "source_name": "Dr. Fulst-Blei, Stefan", "district_number": 35, "district_name": "Mannheim I", "candidacy_role": "direct", "residence": "Mannheim", "birth_year": 1968, "source_row": 284},
{"party": "SPD", "position": 6, "person_name": "Katrin Steinhülb-Joos", "source_name": "Steinhülb-Joos, Katrin", "district_number": 4, "district_name": "Stuttgart IV", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1966, "source_row": 285},
{"party": "SPD", "position": 7, "person_name": "Nicolas Fink", "source_name": "Fink, Nicolas", "district_number": 7, "district_name": "Esslingen", "candidacy_role": "direct", "residence": "Esslingen am Neckar", "birth_year": 1976, "source_row": 286},
{"party": "SPD", "position": 8, "person_name": "Simone Kirschbaum", "source_name": "Kirschbaum, Simone", "district_number": 17, "district_name": "Backnang", "candidacy_role": "direct", "residence": "Backnang", "birth_year": 1974, "source_row": 287},
{"party": "SPD", "position": 9, "person_name": "Boris Weirauch", "source_name": "Dr. Weirauch, Boris", "district_number": 36, "district_name": "Mannheim II", "candidacy_role": "direct", "residence": "Mannheim", "birth_year": 1977, "source_row": 288},
{"party": "SPD", "position": 10, "person_name": "Annkathrin Wulff", "source_name": "Wulff, Annkathrin", "district_number": 42, "district_name": "Pforzheim", "candidacy_role": "direct", "residence": "Pforzheim", "birth_year": 1986, "source_row": 289},
{"party": "SPD", "position": 11, "person_name": "Jonas Hoffmann", "source_name": "Hoffmann, Jonas", "district_number": 58, "district_name": "Lörrach", "candidacy_role": "direct", "residence": "Lörrach", "birth_year": 1985, "source_row": 290},
{"party": "SPD", "position": 12, "person_name": "Giuliana Ioannidis", "source_name": "Ioannidis, Giuliana", "district_number": 57, "district_name": "Singen", "candidacy_role": "direct", "residence": "Konstanz", "birth_year": 1998, "source_row": 291},
{"party": "SPD", "position": 13, "person_name": "Florian Wahl", "source_name": "Wahl, Florian", "district_number": 5, "district_name": "Böblingen", "candidacy_role": "direct", "residence": "Böblingen", "birth_year": 1984, "source_row": 292},
{"party": "SPD", "position": 14, "person_name": "Ronja Nothofer-Hahn", "source_name": "Nothofer-Hahn, Ronja", "district_number": 60, "district_name": "Reutlingen", "candidacy_role": "direct", "residence": "Reutlingen", "birth_year": 1992, "source_row": 293},
{"party": "SPD", "position": 15, "person_name": "Jonas Weber", "source_name": "Weber, Jonas", "district_number": 32, "district_name": "Rastatt", "candidacy_role": "direct", "residence": "Rastatt", "birth_year": 1982, "source_row": 294},
{"party": "SPD", "position": 16, "person_name": "Meri Uhlig", "source_name": "Uhlig, Meri", "district_number": 27, "district_name": "Karlsruhe I", "candidacy_role": "direct", "residence": "Karlsruhe", "birth_year": 1973, "source_row": 295},
{"party": "SPD", "position": 17, "person_name": "Jan-Peter Röderer", "source_name": "Röderer, Jan-Peter", "district_number": 41, "district_name": "Sinsheim", "candidacy_role": "direct", "residence": "Eberbach", "birth_year": 1986, "source_row": 296},
{"party": "SPD", "position": 18, "person_name": "Tanja Sagasser-Beil", "source_name": "Sagasser-Beil, Tanja", "district_number": 18, "district_name": "Heilbronn", "candidacy_role": "direct", "residence": "Heilbronn", "birth_year": 1976, "source_row": 297},
{"party": "SPD", "position": 19, "person_name": "Steffen Reik", "source_name": "Dr. Reik, Steffen", "district_number": 64, "district_name": "Ulm", "candidacy_role": "direct", "residence": "Ulm", "birth_year": 1983, "source_row": 298},
{"party": "SPD", "position": 20, "person_name": "Anneke Graner", "source_name": "Graner, Anneke", "district_number": 31, "district_name": "Ettlingen", "candidacy_role": "direct", "residence": "Ettlingen", "birth_year": 1979, "source_row": 299},
{"party": "SPD", "position": 21, "person_name": "Sébastian Cuny", "source_name": "Cuny, Sébastian", "district_number": 39, "district_name": "Weinheim", "candidacy_role": "direct", "residence": "Schriesheim", "birth_year": 1978, "source_row": 300},
{"party": "SPD", "position": 22, "person_name": "Sabrina Hartmann", "source_name": "Hartmann, Sabrina", "district_number": 10, "district_name": "Göppingen", "candidacy_role": "direct", "residence": "Salach", "birth_year": 1992, "source_row": 301},
{"party": "SPD", "position": 23, "person_name": "Klaus Ranger", "source_name": "Ranger, Klaus", "district_number": 20, "district_name": "Neckarsulm", "candidacy_role": "direct", "residence": "Neckarsulm", "birth_year": 1961, "source_row": 302},
{"party": "SPD", "position": 24, "person_name": "Martina Fuhrmann", "source_name": "Fuhrmann, Martina", "district_number": 49, "district_name": "Emmendingen", "candidacy_role": "direct", "residence": "Endingen am Kaiserstuhl", "birth_year": 1974, "source_row": 303},
{"party": "SPD", "position": 25, "person_name": "Simon Özkeleş", "source_name": "Özkeleş, Simon", "district_number": 66, "district_name": "Biberach", "candidacy_role": "direct", "residence": "Ummendorf", "birth_year": 1994, "source_row": 304},
{"party": "SPD", "position": 26, "person_name": "Joana Stöhrer da Costa", "source_name": "Stöhrer da Costa, Joana", "district_number": 59, "district_name": "Waldshut", "candidacy_role": "direct", "residence": "Müllheim im Markgräflerland", "birth_year": 2003, "source_row": 305},
{"party": "SPD", "position": 27, "person_name": "Nicola Schurr", "source_name": "Schurr, Nicola", "district_number": 54, "district_name": "Villingen-Schwenningen", "candidacy_role": "direct", "residence": "Villingen-Schwenningen", "birth_year": 1984, "source_row": 306},
{"party": "SPD", "position": 28, "person_name": "Daniela Steinrode", "source_name": "Steinrode, Daniela", "district_number": 43, "district_name": "Calw", "candidacy_role": "direct", "residence": "Nagold", "birth_year": 1976, "source_row": 307},
{"party": "SPD", "position": 29, "person_name": "Can Kurter", "source_name": "Kurter, Can", "district_number": 23, "district_name": "Main-Tauber", "candidacy_role": "direct", "residence": "Wertheim", "birth_year": 1994, "source_row": 308},
{"party": "SPD", "position": 30, "person_name": "Xenia Rösch", "source_name": "Rösch, Xenia", "district_number": 37, "district_name": "Wiesloch", "candidacy_role": "direct", "residence": "Sandhausen", "birth_year": 1995, "source_row": 309},
{"party": "SPD", "position": 31, "person_name": "Richard Groß", "source_name": "Groß, Richard", "district_number": 51, "district_name": "Offenburg", "candidacy_role": "direct", "residence": "Offenburg", "birth_year": 1976, "source_row": 310},
{"party": "SPD", "position": 32, "person_name": "Hanna Binder", "source_name": "Binder, Hanna", "district_number": 1, "district_name": "Stuttgart I", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1975, "source_row": 311},
{"party": "SPD", "position": 33, "person_name": "Patrick Haag", "source_name": "Haag, Patrick", "district_number": 38, "district_name": "Neckar-Odenwald", "candidacy_role": "direct", "residence": "Schwarzach", "birth_year": 1986, "source_row": 312},
{"party": "SPD", "position": 34, "person_name": "Lisa-Marie Späth", "source_name": "Späth, Lisa-Marie", "district_number": 65, "district_name": "Ehingen", "candidacy_role": "direct", "residence": "Beimerstetten", "birth_year": 1981, "source_row": 313},
{"party": "SPD", "position": 35, "person_name": "Paul Frank", "source_name": "Frank, Paul", "district_number": 69, "district_name": "Ravensburg", "candidacy_role": "direct", "residence": "Ravensburg", "birth_year": 1996, "source_row": 314},
{"party": "SPD", "position": 36, "person_name": "Ines Palm", "source_name": "Palm, Ines", "district_number": 34, "district_name": "Heidelberg", "candidacy_role": "direct", "residence": "Heidelberg", "birth_year": 1989, "source_row": 315},
{"party": "SPD", "position": 37, "person_name": "Tim Reeth", "source_name": "Reeth, Tim", "district_number": 9, "district_name": "Nürtingen", "candidacy_role": "direct", "residence": "Neuffen", "birth_year": 1999, "source_row": 316},
{"party": "SPD", "position": 38, "person_name": "Ulrike Freifrau von Streit", "source_name": "Freifrau von Streit, Ulrike", "district_number": 25, "district_name": "Schwäbisch Gmünd", "candidacy_role": "direct", "residence": "Schwäbisch Gmünd", "birth_year": 1991, "source_row": 317},
{"party": "SPD", "position": 39, "person_name": "Emile Yadjo-Scheuerer", "source_name": "Yadjo-Scheuerer, Emile", "district_number": 33, "district_name": "Baden-Baden", "candidacy_role": "direct", "residence": "Ottersweier", "birth_year": 1988, "source_row": 318},
{"party": "SPD", "position": 40, "person_name": "Christine Treublut", "source_name": "Treublut, Christine", "district_number": 55, "district_name": "Tuttlingen-Donaueschingen", "candidacy_role": "direct", "residence": "Tuttlingen", "birth_year": 1967, "source_row": 319},
{"party": "SPD", "position": 41, "person_name": "Jonas Aberle", "source_name": "Aberle, Jonas", "district_number": 21, "district_name": "Hohenlohe", "candidacy_role": "direct", "residence": "Öhringen", "birth_year": 1997, "source_row": 320},
{"party": "SPD", "position": 42, "person_name": "Ramona Fuchs", "source_name": "Fuchs, Ramona", "district_number": 70, "district_name": "Sigmaringen", "candidacy_role": "direct", "residence": "Balingen", "birth_year": 1998, "source_row": 321},
{"party": "SPD", "position": 43, "person_name": "Yannik Hummel", "source_name": "Hummel, Yannik", "district_number": 61, "district_name": "Hechingen-Münsingen", "candidacy_role": "direct", "residence": "Römerstein", "birth_year": 1997, "source_row": 322},
{"party": "SPD", "position": 44, "person_name": "Farina Semler", "source_name": "Semler, Farina", "district_number": 6, "district_name": "Leonberg", "candidacy_role": "direct", "residence": "Herrenberg", "birth_year": 1976, "source_row": 323},
{"party": "SPD", "position": 45, "person_name": "Ali Zarabi", "source_name": "Zarabi, Ali", "district_number": 53, "district_name": "Rottweil", "candidacy_role": "direct", "residence": "Schramberg", "birth_year": 2002, "source_row": 324},
{"party": "SPD", "position": 46, "person_name": "Rosalind Hübner", "source_name": "Hübner, Rosalind", "district_number": 68, "district_name": "Wangen", "candidacy_role": "direct", "residence": "Isny im Allgäu", "birth_year": 1991, "source_row": 325},
{"party": "SPD", "position": 47, "person_name": "Danny Multani", "source_name": "Multani, Danny", "district_number": 22, "district_name": "Schwäbisch Hall", "candidacy_role": "direct", "residence": "Schwäbisch Hall", "birth_year": 1982, "source_row": 326},
{"party": "SPD", "position": 48, "person_name": "Bettina Ahrens-Diez", "source_name": "Dr. Ahrens-Diez, Bettina", "district_number": 45, "district_name": "Freudenstadt", "candidacy_role": "direct", "residence": "Rottenburg am Neckar", "birth_year": 1985, "source_row": 327},
{"party": "SPD", "position": 49, "person_name": "Christian Holzer", "source_name": "Holzer, Christian", "district_number": 29, "district_name": "Bruchsal", "candidacy_role": "direct", "residence": "Forst", "birth_year": 1991, "source_row": 328},
{"party": "SPD", "position": 50, "person_name": "Tonja Brinks", "source_name": "Brinks, Tonja", "district_number": 8, "district_name": "Kirchheim", "candidacy_role": "direct", "residence": "Weilheim an der Teck", "birth_year": 1968, "source_row": 329},
{"party": "SPD", "position": 51, "person_name": "Frank Ortolf", "source_name": "Ortolf, Frank", "district_number": 56, "district_name": "Konstanz", "candidacy_role": "direct", "residence": "Konstanz", "birth_year": 1980, "source_row": 330},
{"party": "SPD", "position": 52, "person_name": "Ariane Bergerhoff", "source_name": "Bergerhoff, Ariane", "district_number": 26, "district_name": "Aalen", "candidacy_role": "direct", "residence": "Ellwangen (Jagst)", "birth_year": 1981, "source_row": 331},
{"party": "SPD", "position": 53, "person_name": "Daniel Haas", "source_name": "Haas, Daniel", "district_number": 14, "district_name": "Bietigheim-Bissingen", "candidacy_role": "direct", "residence": "Freiberg am Neckar", "birth_year": 1988, "source_row": 332},
{"party": "SPD", "position": 54, "person_name": "Sara Dahme", "source_name": "Dahme, Sara", "district_number": 2, "district_name": "Stuttgart II", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1983, "source_row": 333},
{"party": "SPD", "position": 55, "person_name": "Walter Krögner", "source_name": "Krögner, Walter", "district_number": 46, "district_name": "Freiburg I", "candidacy_role": "direct", "residence": "Freiburg im Breisgau", "birth_year": 1963, "source_row": 334},
{"party": "SPD", "position": 56, "person_name": "Bettina Süßmilch", "source_name": "Süßmilch, Bettina", "district_number": 15, "district_name": "Waiblingen", "candidacy_role": "direct", "residence": "Waiblingen", "birth_year": 1970, "source_row": 335},
{"party": "SPD", "position": 57, "person_name": "Michael Hofsäß", "source_name": "Hofsäß, Michael", "district_number": 44, "district_name": "Enz", "candidacy_role": "direct", "residence": "Mühlacker", "birth_year": 1996, "source_row": 336},
{"party": "SPD", "position": 58, "person_name": "Nathalie Ziwey", "source_name": "Ziwey, Nathalie", "district_number": 12, "district_name": "Ludwigsburg", "candidacy_role": "direct", "residence": "Ludwigsburg", "birth_year": 1996, "source_row": 337},
{"party": "SPD", "position": 59, "person_name": "Kai Schröder-Klings", "source_name": "Schröder-Klings, Kai", "district_number": 50, "district_name": "Lahr", "candidacy_role": "direct", "residence": "Lahr/Schwarzwald", "birth_year": 1983, "source_row": 338},
{"party": "SPD", "position": 60, "person_name": "Bettina Fischer", "source_name": "Fischer, Bettina", "district_number": 19, "district_name": "Eppingen", "candidacy_role": "direct", "residence": "Schwaigern", "birth_year": 1982, "source_row": 339},
{"party": "SPD", "position": 61, "person_name": "Philip Wolf", "source_name": "Wolf, Philip", "district_number": 48, "district_name": "Breisgau", "candidacy_role": "direct", "residence": "Breisach am Rhein", "birth_year": 2002, "source_row": 340},
{"party": "SPD", "position": 62, "person_name": "Laura Streitbürger", "source_name": "Streitbürger, Laura", "district_number": 3, "district_name": "Stuttgart III", "candidacy_role": "direct", "residence": "Stuttgart", "birth_year": 1980, "source_row": 341},
{"party": "SPD", "position": 63, "person_name": "Peter Hutzel", "source_name": "Hutzel, Peter", "district_number": 16, "district_name": "Schorndorf", "candidacy_role": "direct", "residence": "Schorndorf", "birth_year": 1975, "source_row": 342},
{"party": "SPD", "position": 64, "person_name": "Beate Essafi", "source_name": "Essafi, Beate", "district_number": 30, "district_name": "Bretten", "candidacy_role": "direct", "residence": "Bretten", "birth_year": 1964, "source_row": 343},
{"party": "SPD", "position": 65, "person_name": "Torsten Liebig", "source_name": "Liebig, Torsten", "district_number": 13, "district_name": "Vaihingen", "candidacy_role": "direct", "residence": "Sachsenheim", "birth_year": 1988, "source_row": 344},
{"party": "SPD", "position": 66, "person_name": "Rainer Röver", "source_name": "Dr. Röver, Rainer", "district_number": 67, "district_name": "Bodensee", "candidacy_role": "direct", "residence": "Überlingen", "birth_year": 1978, "source_row": 345},
{"party": "SPD", "position": 67, "person_name": "Raphael Kupferer", "source_name": "Kupferer, Raphael", "district_number": 52, "district_name": "Kehl", "candidacy_role": "direct", "residence": "Oberkirch", "birth_year": 1992, "source_row": 346},
{"party": "SPD", "position": 68, "person_name": "Adrian Keller", "source_name": "Keller, Adrian", "district_number": 28, "district_name": "Karlsruhe II", "candidacy_role": "direct", "residence": "Karlsruhe", "birth_year": 2000, "source_row": 347}
]$rows$::jsonb)
 AS x(party text,position integer,person_name text,source_name text,district_number integer,district_name text,candidacy_role text,residence text,birth_year integer,source_row integer)
 LOOP
  SELECT id INTO selected_list FROM public.election_history_state_lists WHERE period_id=selected_period AND party=public.resolve_history_faction(r.party);
  IF selected_list IS NULL THEN
   INSERT INTO public.election_history_state_lists(period_id,party,source_url,notes)
   VALUES(selected_period,public.resolve_history_faction(r.party),'https://im.baden-wuerttemberg.de/fileadmin/redaktion/m-im/intern/dateien/pdf/20260123_Bekanntmachung_der_Landeswahlleiterin_ueber_die_zugelassenen_Landeslisten.pdf','Import aus Landeslisten_BW_2026_mit_Wahlkreisen.xlsx; zugelassene Landeslisten, keine Aussage über Mandatsgewinn.') RETURNING id INTO selected_list;
  ELSE
   UPDATE public.election_history_state_lists SET source_url='https://im.baden-wuerttemberg.de/fileadmin/redaktion/m-im/intern/dateien/pdf/20260123_Bekanntmachung_der_Landeswahlleiterin_ueber_die_zugelassenen_Landeslisten.pdf' WHERE id=selected_list AND source_url IS NULL;
  END IF;
  SELECT * INTO old_entry FROM public.election_history_state_list_entries WHERE list_id=selected_list AND position=r.position;
  IF FOUND THEN
   -- Conflicting manual placements abort atomically rather than being overwritten.
   IF public.history_list_person_key(old_entry.person_name)<>public.history_list_person_key(r.person_name)
    OR (old_entry.birth_year IS NOT NULL AND old_entry.birth_year<>r.birth_year) THEN
    RAISE EXCEPTION 'Konflikt in Landesliste %, Platz %: vorhandener Datensatz %',r.party,r.position,old_entry.person_name;
   END IF;
   UPDATE public.election_history_state_list_entries SET
    link_mode=CASE WHEN link_mode='manual' THEN 'manual' ELSE 'auto' END,
    birth_year=coalesce(birth_year,r.birth_year), district_number=coalesce(district_number,r.district_number),
    district_name=coalesce(district_name,r.district_name),candidacy_role=coalesce(candidacy_role,r.candidacy_role),
    residence=coalesce(residence,r.residence),source_name=coalesce(source_name,r.source_name),
    source_snapshot=coalesce(source_snapshot,jsonb_build_object('file','Landeslisten_BW_2026_mit_Wahlkreisen.xlsx','sha256','eb4dcdaad3fe660bebd3a86ca2a8159b1723444cb0dd107ecbba92e7d8c0156d','sheet','Kandidierende','row',r.source_row,'entry',to_jsonb(r),'district_source_url','https://im.baden-wuerttemberg.de/fileadmin/redaktion/m-im/intern/dateien/pdf/20260123_Kreiswahlvorschlaege_nach_70_Wahlkreisen_geordnet.pdf'))
   WHERE id=old_entry.id;
  ELSE
   INSERT INTO public.election_history_state_list_entries(list_id,position,person_name,link_mode,birth_year,district_number,district_name,candidacy_role,residence,source_name,source_snapshot)
   VALUES(selected_list,r.position,r.person_name,'auto',r.birth_year,r.district_number,r.district_name,r.candidacy_role,r.residence,r.source_name,
    jsonb_build_object('file','Landeslisten_BW_2026_mit_Wahlkreisen.xlsx','sha256','eb4dcdaad3fe660bebd3a86ca2a8159b1723444cb0dd107ecbba92e7d8c0156d','sheet','Kandidierende','row',r.source_row,'entry',to_jsonb(r),'district_source_url','https://im.baden-wuerttemberg.de/fileadmin/redaktion/m-im/intern/dateien/pdf/20260123_Kreiswahlvorschlaege_nach_70_Wahlkreisen_geordnet.pdf'));
  END IF;
 END LOOP;
END;
$import$;
-- Birth corrections re-evaluate automatic links without changing explicit picks.
CREATE FUNCTION public.refresh_state_lists_after_birth_change() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE changed_mandate uuid;
BEGIN
 changed_mandate:=CASE WHEN TG_OP='DELETE' THEN OLD.mandate_id ELSE NEW.mandate_id END;
 UPDATE public.election_history_state_list_entries e SET link_mode='auto'
 WHERE e.link_mode<>'manual' AND EXISTS(SELECT 1 FROM public.election_history_mandates m LEFT JOIN public.election_history_people p ON p.id=m.person_id
  WHERE m.id=changed_mandate AND (m.connection_id=e.connection_id OR public.history_list_person_key(e.person_name) IN(public.history_list_person_key(m.person_name),public.history_list_person_key(p.name))));
 RETURN NULL;
END $$;
CREATE TRIGGER refresh_state_list_birth_match AFTER INSERT OR UPDATE OR DELETE ON public.election_history_mandate_birthdays
 FOR EACH ROW EXECUTE FUNCTION public.refresh_state_lists_after_birth_change();

-- Selected-person reader: published periods only, even in a superadmin session.
CREATE FUNCTION public.get_deputy_state_list_places(connection uuid, selected_period uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.period_number,x.party,x.position),'[]'::jsonb) FROM (
  SELECT e.id,e.position,e.person_name,e.birth_year,e.district_number,e.district_name,e.candidacy_role,e.residence,
   l.party,l.source_url,p.id period_id,p.number period_number,p.name period_name,p.election_year
  FROM public.election_history_state_list_entries e
  JOIN public.election_history_state_lists l ON l.id=e.list_id
  JOIN public.election_history_periods p ON p.id=l.period_id AND p.is_published
  WHERE e.connection_id=$1 AND ($2 IS NULL OR p.id=$2)
   AND EXISTS(SELECT 1 FROM public.election_history_mandates m JOIN public.election_history_periods mp ON mp.id=m.period_id AND mp.is_published WHERE m.connection_id=$1)
  ORDER BY p.number,l.party,e.position LIMIT 100
 ) x;
$$;
REVOKE ALL ON FUNCTION public.get_deputy_state_list_places(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_deputy_state_list_places(uuid,uuid),public.history_list_person_key(text) TO authenticated;
COMMIT;
