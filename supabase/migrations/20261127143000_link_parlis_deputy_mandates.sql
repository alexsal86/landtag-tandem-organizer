CREATE TABLE public.parlis_deputy_mandates (
  legislature smallint NOT NULL,
  vorgangs_id text NOT NULL,
  mandate_id uuid NOT NULL REFERENCES public.election_history_mandates(id) ON DELETE CASCADE,
  PRIMARY KEY (legislature, vorgangs_id, mandate_id),
  FOREIGN KEY (legislature, vorgangs_id)
    REFERENCES public.parlis_proceedings(legislature, vorgangs_id) ON DELETE CASCADE
);

CREATE INDEX parlis_deputy_mandates_mandate_idx ON public.parlis_deputy_mandates(mandate_id);
ALTER TABLE public.parlis_deputy_mandates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parlis_deputy_mandates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.parlis_deputy_mandates TO authenticated;
CREATE POLICY parlis_deputy_mandates_read ON public.parlis_deputy_mandates
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.election_history_mandates m
      JOIN public.election_history_periods p ON p.id = m.period_id AND p.is_published
      WHERE m.id = mandate_id AND p.number = legislature
    )
  );

-- Use only individually named authors. Require an unambiguous full name during
-- the relevant mandate before checking the faction. Organizations and "u. a."
-- do not imply any additional authors.
WITH authors AS (
  SELECT DISTINCT p.legislature, p.vorgangs_id, p.datum,
    public.history_list_person_key(match[1]) AS original_name_key,
    public.history_list_person_key(
      CASE
        WHEN p.legislature = 18 AND match[1] = 'Uwe Freiherr von Wangenheim' THEN 'Uwe von Wangenheim'
        WHEN p.legislature = 18 AND match[1] = 'Dr. med. Michael Preusch' THEN 'Michael Preusch'
        WHEN match[1] = 'n Hans-Peter Hörner' AND p.vorgangs_id IN ('V-248781', 'V-248785') THEN 'Hans-Peter Hörner'
        ELSE match[1]
      END
    ) AS name_key,
    public.history_result_party(match[2]) AS faction
  FROM public.parlis_proceedings p
  CROSS JOIN LATERAL regexp_matches(
    p.urheber, '(?:^|,)[[:space:]]*([^,()]+?)[[:space:]]+\(([^()]+)\)(?=[[:space:]]*(?:,|u\. a\.|$))', 'g'
  ) AS match
), candidates AS (
  SELECT a.legislature, a.vorgangs_id, a.name_key, a.faction, m.id AS mandate_id,
    public.history_result_party(coalesce(nullif(btrim(m.party_label), ''), m.party)) AS mandate_faction,
    count(*) OVER (PARTITION BY a.legislature, a.vorgangs_id, a.name_key, a.faction) AS matches
  FROM authors a
  JOIN public.election_history_periods p ON p.number = a.legislature
  JOIN public.election_history_mandates m ON m.period_id = p.id
  LEFT JOIN public.election_history_people person ON person.id = m.person_id
  WHERE a.datum BETWEEN coalesce(m.starts_on, p.starts_on) AND coalesce(m.ends_on, p.ends_on, 'infinity'::date)
    AND (a.name_key IN (public.history_list_person_key(m.person_name), public.history_list_person_key(person.name))
      OR a.original_name_key IN (public.history_list_person_key(m.person_name), public.history_list_person_key(person.name)))
)
INSERT INTO public.parlis_deputy_mandates (legislature, vorgangs_id, mandate_id)
SELECT DISTINCT legislature, vorgangs_id, mandate_id
FROM candidates WHERE matches = 1 AND faction = mandate_faction;

-- Resolve the profile from the current mandate identity, including after a
-- history merge. Apply the same key as the Abgeordnetenübersicht.
CREATE VIEW public.parlis_deputy_profiles WITH (security_invoker = true) AS
SELECT link.legislature, link.vorgangs_id, link.mandate_id,
  coalesce(m.person_name, person.name) AS deputy_name,
  coalesce(m.connection_id::text, 'name:' || lower(btrim(coalesce(m.person_name, person.name))) ||
    chr(31) || lower(btrim(coalesce(nullif(btrim(m.party_label), ''), m.party)))) AS profile_key
FROM public.parlis_deputy_mandates link
JOIN public.election_history_mandates m ON m.id = link.mandate_id
LEFT JOIN public.election_history_people person ON person.id = m.person_id;
REVOKE ALL ON public.parlis_deputy_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.parlis_deputy_profiles TO authenticated;
