-- Tagesbriefings: Mitarbeiter schreiben optional ein Briefing für einen Folgetag
CREATE TABLE public.daily_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  author_id UUID NOT NULL,
  briefing_date DATE NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_briefings_tenant_date ON public.daily_briefings(tenant_id, briefing_date);
CREATE INDEX idx_daily_briefings_author ON public.daily_briefings(author_id);

ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;

-- Validierungs-Trigger: briefing_date muss strikt nach dem Erstellungstag liegen
CREATE OR REPLACE FUNCTION public.validate_daily_briefing_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.briefing_date <= (NEW.created_at AT TIME ZONE 'Europe/Berlin')::date THEN
      RAISE EXCEPTION 'Tagesbriefing muss mindestens einen Tag im Voraus erstellt werden (briefing_date muss nach dem Erstellungstag liegen).';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    -- Verhindere Bearbeitung nach dem Zieltag
    IF OLD.briefing_date < (now() AT TIME ZONE 'Europe/Berlin')::date THEN
      RAISE EXCEPTION 'Briefings für vergangene Tage können nicht mehr bearbeitet werden.';
    END IF;
    -- Wenn Datum geändert wird, muss neues Datum auch in der Zukunft liegen
    IF NEW.briefing_date <> OLD.briefing_date
       AND NEW.briefing_date <= (now() AT TIME ZONE 'Europe/Berlin')::date THEN
      RAISE EXCEPTION 'Neues Briefing-Datum muss in der Zukunft liegen.';
    END IF;
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_daily_briefing_date
BEFORE INSERT OR UPDATE ON public.daily_briefings
FOR EACH ROW EXECUTE FUNCTION public.validate_daily_briefing_date();

-- RLS Policies (Tenant-Isolation via user_tenant_memberships, analog zu anderen Tabellen)
CREATE POLICY "Tenant members can view briefings"
ON public.daily_briefings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_tenant_memberships utm
    WHERE utm.user_id = auth.uid()
      AND utm.tenant_id = daily_briefings.tenant_id
      AND utm.is_active = true
  )
);

CREATE POLICY "Tenant members can create their own briefings"
ON public.daily_briefings FOR INSERT
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.user_tenant_memberships utm
    WHERE utm.user_id = auth.uid()
      AND utm.tenant_id = daily_briefings.tenant_id
      AND utm.is_active = true
  )
);

CREATE POLICY "Authors can update their own briefings"
ON public.daily_briefings FOR UPDATE
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors can delete their own briefings"
ON public.daily_briefings FOR DELETE
USING (author_id = auth.uid());

-- Lesebestätigungen
CREATE TABLE public.daily_briefing_reads (
  briefing_id UUID NOT NULL REFERENCES public.daily_briefings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (briefing_id, user_id)
);

ALTER TABLE public.daily_briefing_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see only their own reads"
ON public.daily_briefing_reads FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users mark briefings as read for themselves"
ON public.daily_briefing_reads FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own read marks"
ON public.daily_briefing_reads FOR DELETE
USING (user_id = auth.uid());