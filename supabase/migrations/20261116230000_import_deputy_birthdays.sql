-- Im Supabase SQL Editor vollständig ausführen; ersetzt den fehlgeschlagenen Import.
-- Wiederholbar. ROLLBACK beendet gegebenenfalls die fehlgeschlagene Transaktion.
-- Bei fehlenden/mehrdeutigen Mandaten oder widersprüchlichen Daten wird alles zurückgerollt.
BEGIN;
-- User-supplied birthday list, 2026-11-16. Birth years without a date stay partial.
-- Zuordnung direkt zum vorhandenen Mandat der 18. Wahlperiode.
-- Keine connection_id erforderlich; Mandatshistorien werden nicht verändert.
CREATE TABLE IF NOT EXISTS public.election_history_mandate_birthdays (
  mandate_id uuid PRIMARY KEY REFERENCES public.election_history_mandates(id) ON DELETE CASCADE,
  birthday date,
  birth_year integer NOT NULL CHECK (birth_year BETWEEN 1900 AND 2200),
  source_name text NOT NULL,
  source_faction text NOT NULL,
  source_note text NOT NULL DEFAULT 'Geburtstagsliste des Nutzers vom 16.11.2026',
  CHECK (birthday IS NULL OR extract(year FROM birthday) = birth_year)
);
ALTER TABLE public.election_history_mandate_birthdays ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.election_history_mandate_birthdays TO authenticated;
DROP POLICY IF EXISTS deputy_birthdays_read ON public.election_history_mandate_birthdays;
CREATE POLICY deputy_birthdays_read ON public.election_history_mandate_birthdays
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.election_history_mandates m
    JOIN public.election_history_periods p ON p.id=m.period_id
    WHERE m.id=election_history_mandate_birthdays.mandate_id AND p.is_published
  ) OR public.is_superadmin(auth.uid()));
DROP POLICY IF EXISTS deputy_birthdays_admin ON public.election_history_mandate_birthdays;
CREATE POLICY deputy_birthdays_admin ON public.election_history_mandate_birthdays
  FOR ALL TO authenticated USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

DO $$
DECLARE supplied record; target uuid; matches integer;
BEGIN
 FOR supplied IN SELECT * FROM (VALUES
  ('Albrecht Schütte', 'CDU', '1970-12-20'::date, 1970),
  ('Albrecht Stickel', 'CDU', NULL::date, 1973),
  ('Alexander Becker', 'CDU', '1972-05-10'::date, 1972),
  ('Alexander Bruns', 'CDU', NULL::date, 1966),
  ('Alexsei Zimmer', 'AfD', NULL::date, 1988),
  ('Andre Baumann', 'GRÜNE', '1973-06-10'::date, 1973),
  ('Andrea Lindlohr', 'GRÜNE', '1975-02-19'::date, 1975),
  ('Andreas Auer', 'AfD', NULL::date, 1962),
  ('Andreas Braun', 'CDU', NULL::date, 1982),
  ('Andreas Deuschle', 'CDU', '1978-11-18'::date, 1978),
  ('Andreas Grammel', 'AfD', '1961-06-26'::date, 1961),
  ('Andreas Renner', 'CDU', '1976-07-03'::date, 1976),
  ('Andreas Schwarz', 'GRÜNE', '1979-08-30'::date, 1979),
  ('Andreas Stoch', 'SPD', '1969-10-10'::date, 1969),
  ('Andreas Sturm', 'CDU', '1986-09-18'::date, 1986),
  ('Anna Deparnay-Grunenberg', 'GRÜNE', '1976-06-05'::date, 1976),
  ('Anna Wiech', 'GRÜNE', NULL::date, 1977),
  ('Annkathrin Wulff', 'SPD', NULL::date, 1986),
  ('Ansgar Mayr', 'CDU', '1972-06-08'::date, 1972),
  ('Antje Rommelspacher', 'CDU', NULL::date, 1974),
  ('Anton Baron', 'AfD', '1987-11-03'::date, 1987),
  ('Artur Eichin', 'GRÜNE', '1982-03-15'::date, 1982),
  ('Bastian Schneider', 'CDU', NULL::date, 1990),
  ('Benjamin Bauer', 'GRÜNE', NULL::date, 1989),
  ('Berat Gürbüz', 'GRÜNE', NULL::date, 2002),
  ('Bernd Mettenleiter', 'GRÜNE', '1971-08-16'::date, 1971),
  ('Bernhard Eisenhut', 'AfD', NULL::date, 1958),
  ('Bernhard Pepperl', 'AfD', '1954-11-05'::date, 1954),
  ('Boris Weirauch', 'SPD', '1977-02-03'::date, 1977),
  ('Carl Christian Hirsch', 'CDU', '1985-09-05'::date, 1985),
  ('Carmen Haug', 'AfD', NULL::date, 1976),
  ('Carola Wolle', 'AfD', '1963-11-18'::date, 1963),
  ('Cem Özdemir', 'GRÜNE', '1965-12-21'::date, 1965),
  ('Chris Hegel', 'AfD', NULL::date, 2000),
  ('Christian Gehring', 'CDU', '1979-01-01'::date, 1979),
  ('Christian Köhler', 'AfD', NULL::date, 1968),
  ('Christian Schäfer', 'AfD', NULL::date, 1985),
  ('Christiane Staab', 'CDU', '1968-10-11'::date, 1968),
  ('Christine Schäfer', 'AfD', '1964-05-04'::date, 1964),
  ('Christoforos Tsoulopoulos', 'AfD', NULL::date, 1958),
  ('Christoph Stetter', 'CDU', '1981-04-05'::date, 1981),
  ('Cindy Holmberg', 'GRÜNE', '1975-09-21'::date, 1975),
  ('Clara Resch', 'GRÜNE', '1995-01-19'::date, 1995),
  ('Clara Schweizer', 'GRÜNE', '2002-08-14'::date, 2002),
  ('Cornelia von Loga', 'CDU', '1979-04-08'::date, 1979),
  ('Daniel Belling', 'GRÜNE', NULL::date, 1986),
  ('Daniel Lede Abal', 'GRÜNE', '1976-06-01'::date, 1976),
  ('Daniel Lindenschmid', 'AfD', '1992-05-05'::date, 1992),
  ('Daniel Rottmann', 'AfD', '1969-10-21'::date, 1969),
  ('Daniela Evers', 'GRÜNE', '1971-04-24'::date, 1971),
  ('Dennis Klecker', 'AfD', '1990-09-02'::date, 1990),
  ('Dorothea Kliche-Behnke', 'SPD', '1981-05-08'::date, 1981),
  ('Elke Zimmer', 'GRÜNE', '1966-05-24'::date, 1966),
  ('Emely Knorr', 'AfD', '1986-12-01'::date, 1986),
  ('Emil Sänze', 'AfD', '1950-09-27'::date, 1950),
  ('Erwin Köhler', 'GRÜNE', '1995-06-06'::date, 1995),
  ('Fadime Tuncer', 'GRÜNE', '1969-08-08'::date, 1969),
  ('Florian Haßler', 'GRÜNE', '1977-09-01'::date, 1977),
  ('Florian Kollmann', 'GRÜNE', NULL::date, 1980),
  ('Gerd Bayer', 'GRÜNE', NULL::date, 1981),
  ('Gudula Achterberg', 'GRÜNE', '1965-12-19'::date, 1965),
  ('Guido Wolf', 'CDU', '1961-09-28'::date, 1961),
  ('Hans-Peter Baur', 'AfD', NULL::date, 1959),
  ('Hans-Peter Hörner', 'AfD', '1951-08-07'::date, 1951),
  ('Hermann Katzenstein', 'GRÜNE', '1969-01-03'::date, 1969),
  ('Ilona Boos', 'CDU', NULL::date, 1973),
  ('Isabell Huber', 'CDU', '1987-08-27'::date, 1987),
  ('Isabell Rathgeb', 'CDU', NULL::date, 1980),
  ('Jens Metzger', 'GRÜNE', NULL::date, 1990),
  ('Jens Steinat', 'CDU', '1977-02-05'::date, 1977),
  ('Joachim Kuhs', 'AfD', '1956-06-25'::date, 1956),
  ('Kai Keune', 'GRÜNE', '1983-02-01'::date, 1983),
  ('Karlheinz Kolb', 'AfD', NULL::date, 1954),
  ('Katrin Merkel', 'CDU', NULL::date, 1981),
  ('Katrin Schindele', 'CDU', '1987-11-16'::date, 1987),
  ('Katrin Steinhülb-Joos', 'SPD', '1966-02-20'::date, 1966),
  ('Kay Rittweg', 'AfD', NULL::date, 1979),
  ('Konrad Epple', 'CDU', '1963-08-04'::date, 1963),
  ('Kurt Hermann', 'AfD', NULL::date, 1963),
  ('Lea Geldner', 'GRÜNE', NULL::date, 1991),
  ('Lorenzo Saladino', 'CDU', '1981-11-21'::date, 1981),
  ('Lukas Tietze', 'CDU', NULL::date, 1998),
  ('Manuel Hagel', 'CDU', '1988-05-01'::date, 1988),
  ('Manuel Hailfinger', 'CDU', '1982-05-07'::date, 1982),
  ('Maren Seifert', 'GRÜNE', '1977-01-12'::date, 1977),
  ('Maren Steege', 'CDU', NULL::date, 1982),
  ('Mario Schneider', 'CDU', NULL::date, 1980),
  ('Marion Gentges', 'CDU', '1971-08-23'::date, 1971),
  ('Mariska Ott', 'GRÜNE', '1982-08-17'::date, 1982),
  ('Martin Hahn', 'GRÜNE', '1963-10-13'::date, 1963),
  ('Martin Rothweiler', 'AfD', '1978-04-15'::date, 1978),
  ('Martina Braun', 'GRÜNE', '1960-04-03'::date, 1960),
  ('Maximilian Gerner', 'AfD', '1998-05-14'::date, 1998),
  ('Maximilian Menton', 'CDU', NULL::date, 1995),
  ('Meike Günter', 'GRÜNE', NULL::date, 1974),
  ('Michael Joukov', 'GRÜNE', '1981-11-10'::date, 1981),
  ('Michael Kolb', 'CDU', NULL::date, 1974),
  ('Michael Preusch', 'CDU', '1975-12-13'::date, 1975),
  ('Miguel Klauß', 'AfD', '1986-07-07'::date, 1986),
  ('Muhterem Aras', 'GRÜNE', '1966-01-02'::date, 1966),
  ('Nadyne Saint-Cast', 'GRÜNE', '1979-01-19'::date, 1979),
  ('Natalie Pfau-Weller', 'CDU', '1987-10-09'::date, 1987),
  ('Nese Erikli', 'GRÜNE', '1981-07-19'::date, 1981),
  ('Nico Gunzelmann', 'CDU', '2002-12-26'::date, 2002),
  ('Nicolas Fink', 'SPD', '1976-09-08'::date, 1976),
  ('Nicole Hoffmeister-Kraut', 'CDU', '1972-10-09'::date, 1972),
  ('Nicole Razavi', 'CDU', '1965-05-20'::date, 1965),
  ('Niklas Nüssle', 'GRÜNE', '1994-07-12'::date, 1994),
  ('Nikolaos Boutakoglou', 'AfD', NULL::date, 1983),
  ('Oliver Hildenbrand', 'GRÜNE', '1988-02-10'::date, 1988),
  ('Pascal Haggenmüller', 'GRÜNE', '1988-10-05'::date, 1988),
  ('Patrick Rapp', 'CDU', '1969-01-28'::date, 1969),
  ('Peter Hauk', 'CDU', '1960-12-24'::date, 1960),
  ('Peter Seimer', 'GRÜNE', '1993-09-19'::date, 1993),
  ('Petra Krebs', 'GRÜNE', '1969-03-12'::date, 1969),
  ('Petra Olschowski', 'GRÜNE', '1965-06-29'::date, 1965),
  ('Raimund Haser', 'CDU', '1975-07-15'::date, 1975),
  ('Ralf Nentwich', 'GRÜNE', '1982-01-30'::date, 1982),
  ('Regina Dvořák-Vučetić', 'CDU', NULL::date, 1974),
  ('Rüdiger Ernst', 'AfD', NULL::date, 1972),
  ('Rüdiger Tonojan', 'GRÜNE', NULL::date, 1972),
  ('Sandra Boser', 'GRÜNE', '1976-06-20'::date, 1976),
  ('Sandro Scheer', 'AfD', '1978-07-22'::date, 1978),
  ('Sarah Hagmann', 'GRÜNE', '1985-12-30'::date, 1985),
  ('Sarah Schweizer', 'CDU', '1983-10-17'::date, 1983),
  ('Sascha Binder', 'SPD', '1983-03-04'::date, 1983),
  ('Saskia Frank', 'GRÜNE', '1987-04-20'::date, 1987),
  ('Sebastian van Ryt', 'AfD', NULL::date, 1986),
  ('Siegfried Lorek', 'CDU', '1977-06-03'::date, 1977),
  ('Silke Gericke', 'GRÜNE', '1974-12-06'::date, 1974),
  ('Simon Herzog', 'CDU', '1999-04-20'::date, 1999),
  ('Simone Kirschbaum', 'SPD', '1974-04-08'::date, 1974),
  ('Stefan Fulst-Blei', 'SPD', '1968-06-07'::date, 1968),
  ('Stefan Teufel', 'CDU', '1972-05-20'::date, 1972),
  ('Stefanie Seemann', 'GRÜNE', '1959-05-14'::date, 1959),
  ('Stefanie Wernet', 'CDU', '1981-01-06'::date, 1981),
  ('Stephan Köthe', 'AfD', '1966-02-11'::date, 1966),
  ('Stephan Schwarz', 'AfD', '1984-09-08'::date, 1984),
  ('Swantje Sperling', 'GRÜNE', '1983-06-06'::date, 1983),
  ('Tayfun Tok', 'GRÜNE', '1986-05-16'::date, 1986),
  ('Thekla Walker', 'GRÜNE', '1969-03-28'::date, 1969),
  ('Thomas Dörflinger', 'CDU', '1969-09-12'::date, 1969),
  ('Thomas Hentschel', 'GRÜNE', '1964-10-13'::date, 1964),
  ('Thomas Poreski', 'GRÜNE', '1963-10-21'::date, 1963),
  ('Thomas Strobl', 'CDU', '1960-03-17'::date, 1960),
  ('Thorsten Schwarz', 'CDU', '1976-12-31'::date, 1976),
  ('Tim Breitkreuz', 'CDU', '1994-07-30'::date, 1994),
  ('Tim Bückner', 'CDU', '1983-10-20'::date, 1983),
  ('Tobias Vogt', 'CDU', '1985-06-11'::date, 1985),
  ('Udo Stein', 'AfD', '1983-02-22'::date, 1983),
  ('Ute Leidig', 'GRÜNE', '1963-02-19'::date, 1963),
  ('Uwe von Wangenheim', 'AfD', NULL::date, 1969),
  ('Viviane Sigg', 'SPD', '1980-06-12'::date, 1980),
  ('Volker Schebesta', 'CDU', '1971-06-13'::date, 1971),
  ('Winfried Mack', 'CDU', '1965-08-06'::date, 1965),
  ('Wolfgang Reinhart', 'CDU', '1956-05-03'::date, 1956),
  ('Yannick Veits', 'GRÜNE', NULL::date, 1994)
 ) AS source(name,faction,birthday,birth_year) LOOP
   -- Bound the name/faction lookup to the supplied current legislature.
   SELECT count(*), (array_agg(m.id ORDER BY m.id))[1]
   INTO matches,target
   FROM public.election_history_mandates m
   JOIN public.election_history_periods p ON p.id=m.period_id AND p.number=18
   LEFT JOIN public.election_history_people person ON person.id=m.person_id
   WHERE lower(btrim(coalesce(m.person_name,person.name)))=lower(supplied.name)
     AND lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party)))=lower(supplied.faction);
   IF matches <> 1 THEN
     RAISE EXCEPTION 'Geburtstagsimport: kein eindeutiges Mandat der 18. Wahlperiode für % (%)', supplied.name,supplied.faction;
   END IF;
   INSERT INTO public.election_history_mandate_birthdays
     (mandate_id,birthday,birth_year,source_name,source_faction)
   VALUES (target,supplied.birthday,supplied.birth_year,supplied.name,supplied.faction)
   ON CONFLICT (mandate_id) DO UPDATE SET
     birthday=coalesce(EXCLUDED.birthday,election_history_mandate_birthdays.birthday),
     birth_year=EXCLUDED.birth_year,
     source_name=EXCLUDED.source_name, source_faction=EXCLUDED.source_faction
   WHERE election_history_mandate_birthdays.birth_year=EXCLUDED.birth_year
     AND (election_history_mandate_birthdays.birthday IS NULL
       OR EXCLUDED.birthday IS NULL
       OR election_history_mandate_birthdays.birthday=EXCLUDED.birthday);
   IF NOT FOUND THEN
     RAISE EXCEPTION 'Abweichende vorhandene Geburtsdaten für %: Import abgebrochen',supplied.name;
   END IF;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_analysis_deputy(name_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.period_number,g.starts_on NULLS FIRST,g.id), '[]'::jsonb) FROM (
   SELECT b.birthday,b.birth_year,m.id,m.person_id,m.connection_id,coalesce(m.person_name,p.name) AS name,m.party,m.party_label,
     lp.name AS period_name,lp.number AS period_number,m.starts_on,m.ends_on,
     m.entry_type,m.mandate_type,m.original_mandate,m.left_early,m.notes,
     (m.end_from_period AND lp.ends_on_is_expected) AS end_is_expected,
     d.name AS district_name,coalesce(d.number_label,d.district_number::text) AS district_label,p.name AS linked_name
   FROM public.election_history_mandates m
   JOIN public.election_history_periods lp ON lp.id=m.period_id AND lp.is_published
   LEFT JOIN public.election_history_mandate_birthdays b ON b.mandate_id=m.id
   LEFT JOIN public.election_history_people p ON p.id=m.person_id
   LEFT JOIN public.election_history_districts d ON d.id=m.district_id
   WHERE coalesce(m.connection_id::text,'name:' || lower(btrim(coalesce(m.person_name,p.name))) || chr(31) || lower(btrim(coalesce(nullif(btrim(m.party_label),''),m.party))))=name_key
   ORDER BY lp.number,m.starts_on NULLS FIRST,m.id LIMIT 201
 ) g);
END $$;
-- Ergebnisübersicht nach erfolgreichem Import (157 / 115 / 42).
SELECT count(*) AS personen, count(birthday) AS vollstaendige_geburtsdaten,
       count(*) FILTER (WHERE birthday IS NULL) AS nur_geburtsjahr
FROM public.election_history_mandate_birthdays;
COMMIT;
