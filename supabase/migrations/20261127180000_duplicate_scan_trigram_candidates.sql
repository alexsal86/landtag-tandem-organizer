-- Dubletten-Scan: Namenskandidaten über den Trigramm-Index statt über eine
-- Blockade auf den ersten beiden Namenszeichen.
--
-- 20261127170000 begrenzte die Namenskandidaten auf gleiche Namensanfänge
-- (left(name,2)). Das hält den Scan schnell, verengt ihn aber fachlich:
-- „M. Müller“ und „Max Müller“ teilen nur ein Zeichen und fielen aus der Liste.
--
-- Hier entstehen die Namenskandidaten wieder aus dem Trigramm-Treffer freier
-- Namensähnlichkeit. Damit der GIN-Index idx_contacts_name_trgm dabei wirklich
-- greift, steht die Suche als LATERAL gegen public.contacts: die äußere Zeile
-- liefert den Suchbegriff, die innere darf den Index parameterisiert lesen.
-- Vorher lag die Suche über einer materialisierten CTE, weshalb jeder Aufruf
-- alle Paare selbst vergleichen musste (daher 57014).
--
-- E-Mail und Telefon bleiben eigene, mengenbasierte Kandidatenzweige; sie sind
-- billig, weil sie auf Gleichheit normalisierter Werte filtern. Nicht lesbare
-- Felder (Feldmaskierung) liefern wie bisher keine Kandidaten und keine Ausgabe.
--
-- Die Treffer, Bewertungen und Begründungen sind unverändert; das Zeitlimit
-- bleibt nur als Sicherheitsnetz für sehr große Büros.

CREATE OR REPLACE FUNCTION public.find_contact_duplicates_trgm(
  _tenant_id uuid,
  _threshold numeric DEFAULT 0.55,
  _limit int DEFAULT 200
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
    -- Bewusst ohne id-Vergleich im Rumpf: sonst schiebt der Planer ihn in die
    -- innere Abfrage und liest dort den Primärschlüssel statt des Trigramms.
    SELECT c1.id AS id1, c2.id AS id2
    FROM public.contacts c1
    JOIN LATERAL (
      SELECT other.id
      FROM public.contacts other
      WHERE other.tenant_id = c1.tenant_id
        AND other.name % c1.name
    ) c2 ON true
    WHERE c1.tenant_id = _tenant_id
      AND c1.name IS NOT NULL
  ),
  field_pairs AS (
    SELECT a.id AS id1, b.id AS id2
    FROM public.contacts a
    JOIN public.contacts b ON b.tenant_id = a.tenant_id AND b.id > a.id
    WHERE a.tenant_id = _tenant_id
      AND v_email_readable
      AND coalesce(a.email, '') <> ''
      AND lower(btrim(a.email)) = lower(btrim(b.email))
    UNION
    SELECT a.id, b.id
    FROM public.contacts a
    JOIN public.contacts b ON b.tenant_id = a.tenant_id AND b.id > a.id
    WHERE a.tenant_id = _tenant_id
      AND v_phone_readable
      AND length(regexp_replace(coalesce(a.phone, ''), '[^0-9]', '', 'g')) >= 6
      AND regexp_replace(coalesce(a.phone, ''), '[^0-9]', '', 'g')
          = regexp_replace(coalesce(b.phone, ''), '[^0-9]', '', 'g')
  ),
  candidate_pairs AS (
    -- Jede Paarung genau einmal, unabhängig davon, welche Seite sie gefunden hat.
    SELECT DISTINCT least(id1, id2) AS id1, greatest(id1, id2) AS id2
    FROM (
      SELECT id1, id2 FROM name_pairs
      UNION ALL
      SELECT id1, id2 FROM field_pairs
    ) pairs
    WHERE id1 <> id2
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

REVOKE ALL ON FUNCTION public.find_contact_duplicates_trgm(uuid, numeric, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_contact_duplicates_trgm(uuid, numeric, int) TO authenticated;

NOTIFY pgrst, 'reload schema';
