BEGIN;
-- Unknown dates/numbers stay unknown; names are not automatically merged into identities.
ALTER TABLE public.election_history_periods
 ADD COLUMN election_year integer CHECK (election_year BETWEEN 1900 AND 2200),
 ALTER COLUMN election_date DROP NOT NULL, ALTER COLUMN starts_on DROP NOT NULL;
ALTER TABLE public.election_history_districts
 ALTER COLUMN district_number DROP NOT NULL,
 ADD COLUMN number_label text,
 ADD COLUMN boundaries jsonb,
 ADD CONSTRAINT boundaries_polygon CHECK (boundaries IS NULL OR coalesce(jsonb_typeof(boundaries)='object' AND boundaries->>'type' IN ('Polygon','MultiPolygon') AND jsonb_typeof(boundaries->'coordinates')='array', false));
ALTER TABLE public.election_history_mandates
 ALTER COLUMN starts_on DROP NOT NULL, ALTER COLUMN person_id DROP NOT NULL,
 ADD COLUMN person_name text,
 ADD COLUMN original_mandate text,
 ADD COLUMN party_label text,
 ADD COLUMN left_early boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT mandate_person_known CHECK (person_id IS NOT NULL OR nullif(btrim(person_name),'') IS NOT NULL),
 ADD CONSTRAINT candidate_needs_person CHECK (candidacy_id IS NULL OR person_id IS NOT NULL);
CREATE UNIQUE INDEX election_history_one_unknown_start ON public.election_history_mandates(period_id,person_id) WHERE person_id IS NOT NULL AND starts_on IS NULL;
CREATE INDEX election_history_district_period ON public.election_history_districts(period_id);
CREATE INDEX election_history_mandate_period ON public.election_history_mandates(period_id);
CREATE INDEX election_history_candidate_period ON public.election_history_candidacies(period_id);
CREATE INDEX election_history_person_search ON public.election_history_people(lower(name) text_pattern_ops);
CREATE OR REPLACE FUNCTION public.guard_election_history_dates() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p public.election_history_periods;
BEGIN
 SELECT * INTO p FROM public.election_history_periods WHERE id=NEW.period_id FOR UPDATE;
 IF NEW.starts_on < p.starts_on OR (p.ends_on IS NOT NULL AND (NEW.starts_on>p.ends_on OR NEW.ends_on>p.ends_on)) THEN
   RAISE EXCEPTION 'Mandatszeitraum liegt außerhalb der Legislaturperiode';
 END IF;
 -- Unknown starts are not invented, and therefore cannot be used to prove overlap.
 IF NEW.starts_on IS NOT NULL AND EXISTS (SELECT 1 FROM public.election_history_mandates m
   WHERE m.period_id=NEW.period_id AND m.id<>NEW.id AND m.starts_on IS NOT NULL
     AND ((NEW.person_id IS NOT NULL AND m.person_id=NEW.person_id) OR (NEW.mandate_type='direct' AND m.mandate_type='direct' AND m.district_id=NEW.district_id))
     AND daterange(m.starts_on,coalesce(m.ends_on,p.ends_on)+1,'[)') && daterange(NEW.starts_on,coalesce(NEW.ends_on,p.ends_on)+1,'[)')) THEN
   RAISE EXCEPTION 'Person oder Direktmandat hat bereits einen überlappenden Mandatsabschnitt';
 END IF;
 IF NEW.candidacy_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.election_history_candidacies c WHERE c.id=NEW.candidacy_id
   AND ((NEW.entry_type='election' AND c.outcome<>NEW.mandate_type) OR c.district_id IS DISTINCT FROM NEW.district_id)) THEN
   RAISE EXCEPTION 'Mandat und Kandidatur passen nicht zusammen';
 END IF;
 RETURN NEW;
END $$;

-- One request returns one legislature and only people referenced by it.
-- SECURITY INVOKER keeps draft visibility and tenant read permissions under RLS.
CREATE FUNCTION public.get_election_history_period(period uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT jsonb_build_object(
  'periods', coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.election_history_periods p WHERE p.id=period),'[]'::jsonb),
  'districts',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.district_number NULLS LAST,d.name) FROM public.election_history_districts d WHERE d.period_id=period),'[]'::jsonb),
  'mandates',coalesce((SELECT jsonb_agg(to_jsonb(m)) FROM public.election_history_mandates m WHERE m.period_id=period),'[]'::jsonb),
  'candidacies',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM public.election_history_candidacies c WHERE c.period_id=period),'[]'::jsonb),
  'people',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.name) FROM public.election_history_people p WHERE
     EXISTS(SELECT 1 FROM public.election_history_mandates m WHERE m.period_id=period AND m.person_id=p.id)
     OR EXISTS(SELECT 1 FROM public.election_history_candidacies c WHERE c.period_id=period AND c.person_id=p.id)),'[]'::jsonb)
 );
$$;
REVOKE ALL ON FUNCTION public.get_election_history_period(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_election_history_period(uuid) TO authenticated;
CREATE FUNCTION public.get_election_person_summary(person uuid, through_period uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT jsonb_build_object('complete', p.history_complete,
   'elections', (SELECT count(DISTINCT m.period_id) FROM public.election_history_mandates m
      JOIN public.election_history_periods lp ON lp.id=m.period_id
      WHERE m.person_id=person AND m.entry_type='election' AND lp.is_published AND lp.number<=through.number),
   'direct_wins', (SELECT count(DISTINCT m.period_id) FROM public.election_history_mandates m
      JOIN public.election_history_periods lp ON lp.id=m.period_id
      WHERE m.person_id=person AND m.entry_type='election' AND m.mandate_type='direct' AND lp.is_published AND lp.number<=through.number))
 FROM public.election_history_people p CROSS JOIN public.election_history_periods through
 WHERE p.id=person AND through.id=through_period AND through.is_published;
$$;
REVOKE ALL ON FUNCTION public.get_election_person_summary(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_election_person_summary(uuid,uuid) TO authenticated;
COMMIT;
