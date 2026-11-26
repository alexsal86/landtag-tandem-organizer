CREATE TABLE public.parlis_proceedings (
  legislature smallint NOT NULL CHECK (legislature > 0),
  vorgangs_id text NOT NULL,
  dokumentnummer_intern text NOT NULL,
  drucksache text NOT NULL,
  vorgangstyp text NOT NULL,
  datum date NOT NULL,
  urheber text NOT NULL,
  ressort text NOT NULL,
  titel text NOT NULL,
  deskriptoren text NOT NULL,
  pdf_url text NOT NULL,
  dokument_url text NOT NULL,
  vorgang_text text NOT NULL,
  id text NOT NULL,
  PRIMARY KEY (legislature, vorgangs_id)
);

ALTER TABLE public.parlis_proceedings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.parlis_proceedings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.parlis_proceedings TO authenticated;
CREATE POLICY parlis_authenticated_read ON public.parlis_proceedings
  FOR SELECT TO authenticated USING (true);

CREATE INDEX parlis_proceedings_date_idx
  ON public.parlis_proceedings (legislature, datum DESC, vorgangs_id);
