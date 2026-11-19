CREATE FUNCTION public.valid_bw_poll_shares(shares jsonb, other numeric)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN jsonb_typeof(shares) <> 'object' THEN false ELSE
    shares ?& ARRAY['GRÜNE', 'CDU', 'AfD', 'SPD', 'Die Linke', 'FDP']
    AND ARRAY[
      'GRÜNE', 'CDU', 'AfD', 'SPD', 'Die Linke', 'FDP', 'FREIE WÄHLER', 'Die PARTEI',
      'dieBasis', 'KlimalisteBW', 'ÖDP', 'Volt', 'Bündnis C', 'PdH', 'Verjüngungsforschung',
      'BSW', 'Die Gerechtigkeitspartei', 'PDR', 'PdF', 'Tierschutzpartei', 'WerteUnion'
    ] @> ARRAY(SELECT jsonb_object_keys(shares))
    AND (
      SELECT coalesce(bool_and(
        CASE WHEN jsonb_typeof(value) = 'number'
          THEN (value #>> '{}')::numeric BETWEEN 0 AND 100
          ELSE false END
      ), false)
      FROM jsonb_each(shares)
    )
    AND (
      SELECT coalesce(sum(CASE WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::numeric END), 0) + other = 100
      FROM jsonb_each(shares)
    )
  END
$$;

CREATE TABLE public.election_analysis_bw_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute text NOT NULL CHECK (length(btrim(institute)) BETWEEN 1 AND 160),
  commissioner text NOT NULL DEFAULT '' CHECK (length(commissioner) <= 200),
  published_on date NOT NULL,
  field_start date NOT NULL,
  field_end date NOT NULL,
  respondents int NOT NULL CHECK (respondents > 0),
  method text NOT NULL CHECK (method IN ('Telefon', 'Online', 'Persönlich', 'Telefon und Online', 'Gemischt', 'Nicht angegeben')),
  question_type text NOT NULL CHECK (question_type IN ('Sonntagsfrage', 'Projektion')),
  source_url text NOT NULL CHECK (length(source_url) <= 2000 AND source_url ~ '^https://[^[:space:]/]+'),
  shares jsonb NOT NULL,
  others numeric NOT NULL CHECK (others BETWEEN 0 AND 100),
  is_published boolean NOT NULL DEFAULT false,
  CHECK (field_start <= field_end AND field_end <= published_on),
  CHECK (public.valid_bw_poll_shares(shares, others))
);

ALTER TABLE public.election_analysis_bw_polls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.election_analysis_bw_polls FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.election_analysis_bw_polls TO authenticated;
CREATE POLICY bw_polls_read_published ON public.election_analysis_bw_polls FOR SELECT TO authenticated
  USING (is_published);
CREATE POLICY bw_polls_admin_read ON public.election_analysis_bw_polls FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));
CREATE POLICY bw_polls_admin_insert ON public.election_analysis_bw_polls FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin(auth.uid()));
CREATE POLICY bw_polls_admin_update ON public.election_analysis_bw_polls FOR UPDATE TO authenticated
  USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()));
