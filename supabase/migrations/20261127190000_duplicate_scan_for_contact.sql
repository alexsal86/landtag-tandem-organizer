-- Dubletten-Scan: optional auf einen Kontakt eingegrenzt.
--
-- Der Selbsttest legt ein Dublettenpaar an und prüft, dass
-- find_contact_duplicates_trgm es samt Begründung zurückgibt. Das ging
-- verloren, sobald das Büro genügend gleichwertige Paare hatte: Die Ausgabe ist
-- auf _limit Zeilen begrenzt und nur nach Punktzahl sortiert. Bei Punktzahl 1
-- (gleiche E-Mail, gleiche Telefonnummer) entscheidet allein die
-- Zeilenreihenfolge, welche Paare in die 200 Treffer kommen. Rückstände aus
-- Läufen mit behaltenen Testdaten – dieselbe Adresse, dieselbe Nummer – haben
-- das eigene Paar verdrängt, obwohl es im Bestand und über dem Schwellwert lag.
--
-- _contact_id schränkt das Ergebnis auf Paare mit genau diesem Kontakt ein. Die
-- Kandidatenermittlung bleibt unverändert; der Filter greift vor der Bewertung,
-- sodass das Paar unabhängig von der Größe des Büros zurückkommt. Ohne
-- _contact_id ist das Verhalten unverändert (auch die Plan- und Indexnutzung
-- des bisherigen Scans).
--
-- CREATE OR REPLACE kann keine Parameter ergänzen. Die bisherige Signatur wird
-- deshalb ersetzt; Aufrufe mit drei Argumenten bleiben gültig, weil der neue
-- Parameter vorbelegt ist.

DROP FUNCTION IF EXISTS public.find_contact_duplicates_trgm(uuid, numeric, int);

CREATE FUNCTION public.find_contact_duplicates_trgm(
  _tenant_id uuid,
  _threshold numeric DEFAULT 0.55,
  _limit int DEFAULT 200,
  _contact_id uuid DEFAULT NULL
)
RETURNS TABLE (
  contact1_id uuid,
  contact2_id uuid,
  contact1_name text,
  contact2_name text,
  contact1_email text,
  contact2_email text,
  match_score numeric,
  match_reasons text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
SET statement_timeout = '30s'
AS $$
DECLARE
  v_threshold numeric := greatest(least(coalesce(_threshold, 0.55), 1), 0.1);
  v_limit integer := greatest(least(coalesce(_limit, 200), 2000), 1);
  v_email_readable boolean;
  v_phone_readable boolean;
BEGIN
  IF NOT public.is_tenant_member(_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Kein Zugriff auf Mandant';
  END IF;

  -- Feldmaskierung einmal je Aufruf statt je Kontakt und Spalte.
  v_email_readable := coalesce(public.field_read_rule(_tenant_id, 'contacts', 'email') = 'allow', true);
  v_phone_readable := coalesce(public.field_read_rule(_tenant_id, 'contacts', 'phone') = 'allow', true);

  RETURN QUERY
  WITH name_pairs AS (
    -- LATERAL hält die Suche am Index: c1.name ist der Suchbegriff, other.name
    -- die indizierte Spalte. Kein Vollvergleich aller Zeilenpaare.
    --
    -- Die Paarung entsteht genau einmal. Der Vergleich läuft über die
    -- Textdarstellung der id: Sie ist eine strenge Totalordnung (also genau
    -- eine Richtung je Paar), aber der Primärschlüssel-Index auf uuid kann sie
    -- nicht bedienen. Ein direkter uuid-Vergleich hier würde vom Planer in die
    -- innere Abfrage gezogen und dort als pk-Bereich gelesen — der
    -- Trigramm-Index bliebe ungenutzt.
    SELECT c1.id AS id1, c2.id AS id2
    FROM public.contacts c1
    JOIN LATERAL (
      SELECT other.id
      FROM public.contacts other
      WHERE other.tenant_id = c1.tenant_id
        AND other.id::text > c1.id::text
        AND other.name % c1.name
    ) c2 ON true
    WHERE c1.tenant_id = _tenant_id
      AND c1.name IS NOT NULL
  ),
  -- Auch hier dieselbe Textordnung, damit beide Zweige ein Paar gleich
  -- ausrichten und das abschließende UNION es nur noch zusammenführt.
  field_pairs AS (
    SELECT a.id AS id1, b.id AS id2
    FROM public.contacts a
    JOIN public.contacts b ON b.tenant_id = a.tenant_id
    WHERE a.tenant_id = _tenant_id
      AND a.id::text < b.id::text
      AND v_email_readable
      AND coalesce(a.email, '') <> ''
      AND lower(btrim(a.email)) = lower(btrim(b.email))
    UNION
    SELECT a.id, b.id
    FROM public.contacts a
    JOIN public.contacts b ON b.tenant_id = a.tenant_id
    WHERE a.tenant_id = _tenant_id
      AND a.id::text < b.id::text
      AND v_phone_readable
      AND length(regexp_replace(coalesce(a.phone, ''), '[^0-9]', '', 'g')) >= 6
      AND regexp_replace(coalesce(a.phone, ''), '[^0-9]', '', 'g')
          = regexp_replace(coalesce(b.phone, ''), '[^0-9]', '', 'g')
  ),
  candidate_pairs AS (
    -- Nur noch das Zusammenführen der Zweige; jedes Paar liegt schon einmal vor.
    SELECT id1, id2 FROM name_pairs
    UNION
    SELECT id1, id2 FROM field_pairs
  ),
  scored AS (
    SELECT
      a.id AS id1, b.id AS id2,
      a.name AS name1, b.name AS name2,
      CASE WHEN v_email_readable THEN a.email END AS email1,
      CASE WHEN v_email_readable THEN b.email END AS email2,
      similarity(coalesce(a.name, ''), coalesce(b.name, '')) AS name_sim,
      CASE WHEN v_email_readable AND coalesce(a.email, '') <> '' AND coalesce(b.email, '') <> ''
           THEN similarity(lower(btrim(a.email)), lower(btrim(b.email))) ELSE 0 END AS email_sim,
      CASE WHEN v_phone_readable AND coalesce(a.phone, '') <> '' AND coalesce(b.phone, '') <> ''
           THEN similarity(regexp_replace(a.phone, '[^0-9]', '', 'g'),
                           regexp_replace(b.phone, '[^0-9]', '', 'g')) ELSE 0 END AS phone_sim
    FROM candidate_pairs p
    JOIN public.contacts a ON a.id = p.id1
    JOIN public.contacts b ON b.id = p.id2
    -- Kontaktbezogene Abfrage: nur Paare mit diesem Kontakt werden bewertet.
    -- Ohne _contact_id bleibt der Scan unverändert.
    WHERE _contact_id IS NULL
       OR p.id1 = _contact_id
       OR p.id2 = _contact_id
  )
  SELECT
    s.id1, s.id2, s.name1, s.name2, s.email1, s.email2,
    GREATEST(s.name_sim, s.email_sim, s.phone_sim)::numeric,
    ARRAY(
      SELECT r FROM (
        VALUES
          (CASE WHEN s.name_sim >= v_threshold THEN 'Name ähnlich' END),
          (CASE WHEN s.email_sim >= v_threshold THEN 'E-Mail ähnlich' END),
          (CASE WHEN s.phone_sim >= 0.8 THEN 'Telefon ähnlich' END)
      ) AS t(r) WHERE r IS NOT NULL
    )
  FROM scored s
  WHERE GREATEST(s.name_sim, s.email_sim, s.phone_sim) >= v_threshold
  ORDER BY 7 DESC
  LIMIT v_limit;
END $$;

REVOKE ALL ON FUNCTION public.find_contact_duplicates_trgm(uuid, numeric, int, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_contact_duplicates_trgm(uuid, numeric, int, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
