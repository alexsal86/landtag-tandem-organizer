-- Central, tenant-independent election register. Existing representatives and
-- tenant notes remain untouched; no guessed historical data is imported.
BEGIN;
CREATE TABLE public.election_history_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL UNIQUE CHECK (number > 0),
  name text NOT NULL CHECK (btrim(name) <> ''),
  election_date date NOT NULL, starts_on date NOT NULL, ends_on date,
  is_current boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  source_url text, notes text,
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CHECK (election_date <= starts_on),
  CHECK (NOT is_current OR is_published)
);
CREATE UNIQUE INDEX election_history_one_current ON public.election_history_periods (is_current) WHERE is_current;
CREATE TABLE public.election_history_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  biography text, source_url text,
  history_complete boolean NOT NULL DEFAULT false
);
CREATE TABLE public.election_history_districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.election_history_periods(id) ON DELETE RESTRICT,
  district_number integer NOT NULL CHECK (district_number > 0),
  name text NOT NULL CHECK (btrim(name) <> ''), boundary_note text, source_url text,
  UNIQUE (period_id, district_number), UNIQUE (id, period_id)
);
CREATE TABLE public.election_history_candidacies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.election_history_periods(id) ON DELETE RESTRICT,
  person_id uuid NOT NULL REFERENCES public.election_history_people(id) ON DELETE RESTRICT,
  district_id uuid,
  party text NOT NULL CHECK (btrim(party) <> ''),
  votes bigint CHECK (votes >= 0), vote_share numeric(6,3) CHECK (vote_share BETWEEN 0 AND 100),
  district_rank integer CHECK (district_rank > 0), list_position integer CHECK (list_position > 0),
  ballot_type text NOT NULL DEFAULT 'candidate' CHECK (ballot_type IN ('candidate','first_vote')),
  outcome text NOT NULL DEFAULT 'unknown' CHECK (outcome IN ('direct','list','not_elected','unknown')),
  source_url text, notes text,
  FOREIGN KEY (district_id, period_id) REFERENCES public.election_history_districts(id, period_id) ON DELETE RESTRICT,
  UNIQUE (period_id, person_id), UNIQUE (id, person_id, period_id),
  CHECK (district_id IS NOT NULL OR (votes IS NULL AND vote_share IS NULL AND district_rank IS NULL)),
  CHECK (outcome <> 'direct' OR district_id IS NOT NULL)
);
CREATE UNIQUE INDEX election_history_one_direct_winner ON public.election_history_candidacies(period_id,district_id) WHERE outcome='direct';
CREATE TABLE public.election_history_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.election_history_periods(id) ON DELETE RESTRICT,
  person_id uuid NOT NULL REFERENCES public.election_history_people(id) ON DELETE RESTRICT,
  district_id uuid, candidacy_id uuid,
  party text NOT NULL CHECK (btrim(party) <> ''),
  mandate_type text NOT NULL CHECK (mandate_type IN ('direct','list')),
  entry_type text NOT NULL DEFAULT 'election' CHECK (entry_type IN ('election','succession')),
  starts_on date NOT NULL, ends_on date, source_url text, notes text,
  FOREIGN KEY (district_id, period_id) REFERENCES public.election_history_districts(id, period_id) ON DELETE RESTRICT,
  FOREIGN KEY (candidacy_id, person_id, period_id) REFERENCES public.election_history_candidacies(id, person_id, period_id) ON DELETE RESTRICT,
  UNIQUE (period_id, person_id, starts_on),
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CHECK (mandate_type <> 'direct' OR district_id IS NOT NULL)
);
CREATE INDEX ON public.election_history_candidacies(person_id);
CREATE INDEX ON public.election_history_mandates(person_id,period_id);
CREATE INDEX ON public.election_history_mandates(district_id);
CREATE TABLE public.election_history_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), table_name text NOT NULL,
  record_id uuid NOT NULL, action text NOT NULL, actor_id uuid, occurred_at timestamptz NOT NULL DEFAULT now(),
  old_data jsonb, new_data jsonb
);

-- All writes are checked in PostgreSQL, independently of the administration UI.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['election_history_periods','election_history_people','election_history_districts','election_history_candidacies','election_history_mandates'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY superadmin_write ON public.%I FOR ALL TO authenticated USING (public.is_superadmin(auth.uid())) WITH CHECK (public.is_superadmin(auth.uid()))', t);
  END LOOP;
END $$;
CREATE POLICY published_periods ON public.election_history_periods FOR SELECT TO authenticated USING (is_published);
CREATE POLICY read_people ON public.election_history_people FOR SELECT TO authenticated USING (true);
CREATE POLICY published_districts ON public.election_history_districts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.election_history_periods p WHERE p.id=period_id AND p.is_published));
CREATE POLICY published_candidacies ON public.election_history_candidacies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.election_history_periods p WHERE p.id=period_id AND p.is_published));
CREATE POLICY published_mandates ON public.election_history_mandates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.election_history_periods p WHERE p.id=period_id AND p.is_published));
ALTER TABLE public.election_history_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.election_history_audit FROM anon, authenticated;
GRANT SELECT ON public.election_history_audit TO authenticated;
CREATE POLICY superadmin_audit_read ON public.election_history_audit FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));

CREATE FUNCTION public.guard_election_history_dates() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE p public.election_history_periods;
BEGIN
  -- A period-row lock serializes date edits with mandate creation/edits.
  SELECT * INTO p FROM public.election_history_periods WHERE id=NEW.period_id FOR UPDATE;
  IF NEW.starts_on < p.starts_on OR (p.ends_on IS NOT NULL AND
     (NEW.starts_on > p.ends_on OR NEW.ends_on > p.ends_on)) THEN
    RAISE EXCEPTION 'Mandatszeitraum liegt außerhalb der Legislaturperiode';
  END IF;
  IF EXISTS (SELECT 1 FROM public.election_history_mandates m
    WHERE m.period_id=NEW.period_id AND m.id<>NEW.id
      AND (m.person_id=NEW.person_id OR (NEW.mandate_type='direct' AND m.mandate_type='direct' AND m.district_id=NEW.district_id))
      AND daterange(m.starts_on, coalesce(m.ends_on, p.ends_on) + 1, '[)') && daterange(NEW.starts_on, coalesce(NEW.ends_on, p.ends_on) + 1, '[)')) THEN
    RAISE EXCEPTION 'Person oder Direktmandat hat bereits einen überlappenden Mandatsabschnitt in dieser Periode';
  END IF;
  IF NEW.candidacy_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.election_history_candidacies c WHERE c.id=NEW.candidacy_id AND
      ((NEW.entry_type='election' AND c.outcome<>NEW.mandate_type)
       OR c.district_id IS DISTINCT FROM NEW.district_id)
  ) THEN
    RAISE EXCEPTION 'Mandat und Kandidatur passen bei Wahlkreis oder Wahlausgang nicht zusammen';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER election_history_mandate_dates BEFORE INSERT OR UPDATE ON public.election_history_mandates
 FOR EACH ROW EXECUTE FUNCTION public.guard_election_history_dates();
CREATE FUNCTION public.guard_election_history_period_dates() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.election_history_mandates m WHERE m.period_id=NEW.id AND
    (m.starts_on < NEW.starts_on OR (NEW.ends_on IS NOT NULL AND (m.starts_on > NEW.ends_on OR m.ends_on > NEW.ends_on)))) THEN
    RAISE EXCEPTION 'Legislaturzeitraum schließt bestehende Mandate aus';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER election_history_period_dates BEFORE UPDATE ON public.election_history_periods
 FOR EACH ROW EXECUTE FUNCTION public.guard_election_history_period_dates();

CREATE FUNCTION public.audit_election_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.election_history_audit(table_name,record_id,action,actor_id,old_data,new_data)
  VALUES (TG_TABLE_NAME, CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END, TG_OP, auth.uid(),
    CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END, CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END);
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION public.audit_election_history() FROM PUBLIC;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['election_history_periods','election_history_people','election_history_districts','election_history_candidacies','election_history_mandates'] LOOP
    EXECUTE format('CREATE TRIGGER election_history_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_election_history()',t);
  END LOOP;
END $$;
-- Changing a linked candidacy must not invalidate an existing mandate.
CREATE FUNCTION public.guard_election_history_candidacy() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM public.election_history_periods WHERE id=NEW.period_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.election_history_mandates m WHERE m.candidacy_id=NEW.id AND
    ((m.entry_type='election' AND NEW.outcome<>m.mandate_type) OR m.district_id IS DISTINCT FROM NEW.district_id)) THEN
    RAISE EXCEPTION 'Kandidatur passt nicht mehr zu einem verknüpften Mandat';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER election_history_candidacy_guard BEFORE INSERT OR UPDATE ON public.election_history_candidacies
 FOR EACH ROW EXECUTE FUNCTION public.guard_election_history_candidacy();

CREATE FUNCTION public.set_current_election_history_period(period uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins dürfen die aktuelle Periode ändern' USING ERRCODE='42501'; END IF;
  LOCK TABLE public.election_history_periods IN EXCLUSIVE MODE;
  IF NOT EXISTS (SELECT 1 FROM public.election_history_periods WHERE id=period AND is_published) THEN
    RAISE EXCEPTION 'Bitte zuerst eine vorhandene Legislaturperiode freigeben';
  END IF;
  UPDATE public.election_history_periods SET is_current=false WHERE is_current;
  UPDATE public.election_history_periods SET is_current=true WHERE id=period;
END $$;
REVOKE ALL ON FUNCTION public.set_current_election_history_period(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_current_election_history_period(uuid) TO authenticated;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['election_history_periods','election_history_people','election_history_districts','election_history_candidacies','election_history_mandates'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT source_url_http CHECK (source_url IS NULL OR source_url ~* ''^https?://[^[:space:]]+$'')',t);
  END LOOP;
END $$;
COMMIT;
