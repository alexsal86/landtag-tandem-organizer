BEGIN;
ALTER TABLE public.election_history_mandates
 ADD COLUMN start_from_period boolean NOT NULL DEFAULT false,
 ADD COLUMN end_from_period boolean NOT NULL DEFAULT false;

-- Actual individual dates remain distinct from inherited legislature dates.
CREATE FUNCTION public.inherit_election_mandate_dates() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE p public.election_history_periods; eligible_end boolean;
BEGIN
 SELECT * INTO p FROM public.election_history_periods WHERE id=NEW.period_id FOR UPDATE;
 eligible_end := NOT NEW.left_early AND coalesce(NEW.notes,'') !~* '(ausgeschieden|niedergelegt|verstorben|gestorben|Mandatsverzicht)';
 IF TG_OP='UPDATE' THEN
   -- A changed individual date overrides inheritance. Period propagation writes
   -- the new period value with its inheritance flag intact.
   IF NEW.starts_on IS DISTINCT FROM OLD.starts_on AND NEW.starts_on IS DISTINCT FROM p.starts_on THEN
     NEW.start_from_period := false;
   END IF;
   IF NEW.ends_on IS DISTINCT FROM OLD.ends_on AND NEW.ends_on IS DISTINCT FROM p.ends_on THEN
     NEW.end_from_period := false;
   END IF;
 END IF;
 IF NEW.entry_type='election' THEN
   IF NEW.start_from_period OR (NEW.starts_on IS NULL AND p.starts_on IS NOT NULL) THEN
     NEW.starts_on := p.starts_on;
     NEW.start_from_period := true;
   END IF;
 ELSIF NEW.start_from_period THEN
   NEW.starts_on := NULL;
   NEW.start_from_period := false;
 END IF;
 IF eligible_end THEN
   IF NEW.end_from_period OR (NEW.ends_on IS NULL AND p.ends_on IS NOT NULL) THEN
     NEW.ends_on := p.ends_on;
     NEW.end_from_period := true;
   END IF;
 ELSIF NEW.end_from_period THEN
   NEW.ends_on := NULL;
   NEW.end_from_period := false;
 END IF;
 RETURN NEW;
END $$;
-- Alphabetic trigger order ensures inheritance precedes date/overlap validation.
CREATE TRIGGER a_election_history_inherit_dates BEFORE INSERT OR UPDATE ON public.election_history_mandates
 FOR EACH ROW EXECUTE FUNCTION public.inherit_election_mandate_dates();

CREATE OR REPLACE FUNCTION public.guard_election_history_period_dates() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.election_history_mandates m WHERE m.period_id=NEW.id AND (
   (NOT m.start_from_period AND (m.starts_on<NEW.starts_on OR m.starts_on>NEW.ends_on))
   OR (NOT m.end_from_period AND m.ends_on>NEW.ends_on)
   OR (CASE WHEN m.start_from_period THEN NEW.starts_on ELSE m.starts_on END)
        > (CASE WHEN m.end_from_period THEN NEW.ends_on ELSE m.ends_on END)
 )) THEN
   RAISE EXCEPTION 'Legislaturzeitraum schließt individuelle Mandatsdaten aus. Bitte die betroffenen Mandate prüfen.';
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.sync_election_period_mandates() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 UPDATE public.election_history_mandates m
 SET starts_on=CASE WHEN m.start_from_period THEN NEW.starts_on ELSE m.starts_on END,
     ends_on=CASE WHEN m.end_from_period THEN NEW.ends_on ELSE m.ends_on END
 WHERE m.period_id=NEW.id AND (m.start_from_period OR m.end_from_period
    OR (m.starts_on IS NULL AND m.entry_type='election' AND NEW.starts_on IS NOT NULL)
    OR (m.ends_on IS NULL AND NOT m.left_early AND NEW.ends_on IS NOT NULL
        AND coalesce(m.notes,'') !~* '(ausgeschieden|niedergelegt|verstorben|gestorben|Mandatsverzicht)'));
 RETURN NEW;
END $$;
CREATE TRIGGER election_history_sync_period_dates AFTER UPDATE OF starts_on,ends_on ON public.election_history_periods
 FOR EACH ROW WHEN (OLD.starts_on IS DISTINCT FROM NEW.starts_on OR OLD.ends_on IS DISTINCT FROM NEW.ends_on)
 EXECUTE FUNCTION public.sync_election_period_mandates();

-- Only the requested example is backfilled. Use the dates already entered by
-- the administrator; do not assume or hardcode election/legislature dates.
UPDATE public.election_history_mandates m SET starts_on=m.starts_on, ends_on=m.ends_on
FROM public.election_history_periods p
WHERE p.id=m.period_id AND p.number=18 AND
 ((m.starts_on IS NULL AND m.entry_type='election' AND p.starts_on IS NOT NULL)
  OR (m.ends_on IS NULL AND NOT m.left_early AND p.ends_on IS NOT NULL
      AND coalesce(m.notes,'') !~* '(ausgeschieden|niedergelegt|verstorben|gestorben|Mandatsverzicht)'));
COMMIT;
