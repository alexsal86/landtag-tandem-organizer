BEGIN;
-- Connection-only updates must not inherit or validate mandate dates.
-- Restrict trigger events rather than relying on a particular deployed version
-- of the trigger functions. INSERT and all date/identity/candidacy edits retain
-- inheritance followed by full validation; audit and RLS remain active.
DROP TRIGGER IF EXISTS a_election_history_inherit_dates ON public.election_history_mandates;
CREATE TRIGGER a_election_history_inherit_dates
BEFORE INSERT OR UPDATE OF period_id,person_id,district_id,candidacy_id,
  mandate_type,entry_type,starts_on,ends_on,start_from_period,end_from_period,left_early,notes
ON public.election_history_mandates
FOR EACH ROW EXECUTE FUNCTION public.inherit_election_mandate_dates();

DROP TRIGGER IF EXISTS election_history_mandate_dates ON public.election_history_mandates;
CREATE TRIGGER election_history_mandate_dates
BEFORE INSERT OR UPDATE OF period_id,person_id,district_id,candidacy_id,
  mandate_type,entry_type,starts_on,ends_on,start_from_period,end_from_period,left_early,notes
ON public.election_history_mandates
FOR EACH ROW EXECUTE FUNCTION public.guard_election_history_dates();
COMMIT;
