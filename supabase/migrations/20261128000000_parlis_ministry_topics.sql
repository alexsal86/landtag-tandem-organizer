BEGIN;

CREATE TABLE public.parlis_ministry_lines (
  id text PRIMARY KEY,
  label text NOT NULL
);
INSERT INTO public.parlis_ministry_lines (id, label) VALUES
  ('state','Staatsministerium'),
  ('interior','Inneres und Digitalisierung'),
  ('justice','Justiz und Migration'),
  ('finance','Finanzen'),
  ('education','Kultus und Schule'),
  ('science','Wissenschaft, Forschung und Kunst'),
  ('economy','Wirtschaft und Tourismus'),
  ('social','Soziales und Gesundheit'),
  ('transport','Verkehr'),
  ('environment','Umwelt, Klima und Energiewirtschaft'),
  ('rural','Ländlicher Raum und Landwirtschaft'),
  ('housing','Landesentwicklung und Wohnen');

CREATE TABLE public.parlis_ministry_suggestions (
  legislature smallint NOT NULL,
  ressort text NOT NULL,
  line_id text NOT NULL REFERENCES public.parlis_ministry_lines(id),
  PRIMARY KEY (legislature, ressort)
);

-- Equal names are paired explicitly; changed names describe broad ministry
-- continuity. The original ressort and the legislature remain separate.
INSERT INTO public.parlis_ministry_suggestions (legislature, ressort, line_id)
SELECT period, ressort, line_id
FROM (VALUES (17), (18)) AS periods(period)
CROSS JOIN (VALUES
  ('Staatsministerium','state'),
  ('Ministerium der Justiz und für Migration','justice'),
  ('Ministerium für Finanzen','finance'),
  ('Ministerium für Wissenschaft, Forschung und Kunst','science'),
  ('Ministerium für Verkehr','transport'),
  ('Ministerium für Umwelt, Klima und Energiewirtschaft','environment'),
  ('Ministerium für Landesentwicklung und Wohnen','housing')
) AS names(ressort,line_id);

INSERT INTO public.parlis_ministry_suggestions VALUES
  (17,'Ministerium des Inneren, für Digitalisierung und Kommunen','interior'),
  (18,'Ministerium des Inneren, für Digitalisierung und Europa','interior'),
  (17,'Ministerium für Kultus, Jugend und Sport','education'),
  (18,'Ministerium für Kultus','education'),
  (17,'Ministerium für Wirtschaft, Arbeit und Tourismus','economy'),
  (18,'Ministerium für Wirtschaft, Handwerk und Tourismus','economy'),
  (17,'Ministerium für Soziales, Gesundheit und Integration','social'),
  (18,'Ministerium für Soziales, Arbeit und Gesundheit','social'),
  (17,'Ministerium für Ernährung, Ländlichen Raum und Verbraucherschutz','rural'),
  (18,'Ministerium für Ländlichen Raum, Landwirtschaft und Heimat','rural');

CREATE TABLE public.parlis_ministry_assignments (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  legislature smallint NOT NULL CHECK (legislature > 0),
  ressort text NOT NULL CHECK (btrim(ressort) <> ''),
  line_id text REFERENCES public.parlis_ministry_lines(id),
  PRIMARY KEY (tenant_id, legislature, ressort)
);

CREATE TABLE public.parlis_ministry_topics (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  line_id text NOT NULL REFERENCES public.parlis_ministry_lines(id),
  topic_id uuid NOT NULL,
  PRIMARY KEY (tenant_id, line_id, topic_id),
  FOREIGN KEY (tenant_id, topic_id) REFERENCES public.topics(tenant_id, id) ON DELETE CASCADE
);

ALTER TABLE public.parlis_ministry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parlis_ministry_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parlis_ministry_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parlis_ministry_topics ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.parlis_ministry_lines, public.parlis_ministry_suggestions,
  public.parlis_ministry_assignments, public.parlis_ministry_topics FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.parlis_ministry_lines, public.parlis_ministry_suggestions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parlis_ministry_assignments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.parlis_ministry_topics TO authenticated;

CREATE POLICY parlis_ministry_lines_read ON public.parlis_ministry_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY parlis_ministry_suggestions_read ON public.parlis_ministry_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY parlis_ministry_assignments_read ON public.parlis_ministry_assignments
  FOR SELECT TO authenticated USING (public.user_belongs_to_tenant(tenant_id));
CREATE POLICY parlis_ministry_assignments_admin ON public.parlis_ministry_assignments
  FOR ALL TO authenticated USING (public.is_tenant_config_admin(tenant_id))
  WITH CHECK (public.is_tenant_config_admin(tenant_id));
CREATE POLICY parlis_ministry_topics_read ON public.parlis_ministry_topics
  FOR SELECT TO authenticated USING (public.user_belongs_to_tenant(tenant_id));
CREATE POLICY parlis_ministry_topics_admin ON public.parlis_ministry_topics
  FOR ALL TO authenticated USING (public.is_tenant_config_admin(tenant_id))
  WITH CHECK (public.is_tenant_config_admin(tenant_id));

-- Keep topic assignments when the central topic catalog merges two topics.
CREATE FUNCTION public.move_parlis_ministry_topics_after_merge()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.parlis_ministry_topics (tenant_id, line_id, topic_id)
  SELECT links.tenant_id, links.line_id, NEW.merged_into
  FROM public.parlis_ministry_topics links
  WHERE links.tenant_id = NEW.tenant_id AND links.topic_id = NEW.id
  ON CONFLICT DO NOTHING;
  DELETE FROM public.parlis_ministry_topics links
  WHERE links.tenant_id = NEW.tenant_id AND links.topic_id = NEW.id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.move_parlis_ministry_topics_after_merge() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER move_parlis_ministry_topics_after_merge
AFTER UPDATE OF merged_into ON public.topics FOR EACH ROW
WHEN (NEW.merged_into IS NOT NULL AND NEW.merged_into IS DISTINCT FROM OLD.merged_into)
EXECUTE FUNCTION public.move_parlis_ministry_topics_after_merge();

-- Return aggregated source labels rather than transferring individual requests.
CREATE FUNCTION public.get_parlis_ministry_sources()
RETURNS TABLE (legislature smallint, ressort text, requests integer, suggested_line text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT p.legislature, p.ressort,
    (count(*) FILTER (WHERE p.vorgangstyp IN ('Kleine Anfrage','Mündliche Anfrage','Große Anfrage')))::integer,
    s.line_id
  FROM public.parlis_proceedings p
  LEFT JOIN public.parlis_ministry_suggestions s USING (legislature, ressort)
  WHERE p.ressort LIKE 'Ministerium %' OR p.ressort = 'Staatsministerium'
  GROUP BY p.legislature, p.ressort, s.line_id
  ORDER BY p.legislature, p.ressort;
$$;
REVOKE ALL ON FUNCTION public.get_parlis_ministry_sources() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_parlis_ministry_sources() TO authenticated;

COMMIT;
