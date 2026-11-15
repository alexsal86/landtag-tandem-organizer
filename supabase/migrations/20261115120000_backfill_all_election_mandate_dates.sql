BEGIN;
-- Reuse the existing inheritance trigger and the administrator-entered period
-- dates. Preserve individual dates and exclude early exits and replacements.
-- Check the proposed interval before updating: the validation trigger checks
-- overlaps even if only a missing end date is being filled. Unknown dates on
-- another matching mandate cannot establish a safe gap, so leave these cases
-- untouched as well. This also excludes conflicts between two backfill rows
-- without choosing a winner based on UPDATE execution order.
UPDATE public.election_history_mandates m
SET starts_on = m.starts_on, ends_on = m.ends_on
FROM public.election_history_periods p
WHERE p.id = m.period_id
  AND m.entry_type = 'election'
  AND NOT m.left_early
  AND coalesce(m.notes, '') !~* '(ausgeschieden|niedergelegt|verstorben|gestorben|Mandatsverzicht)'
  AND NOT EXISTS (
    SELECT 1 FROM public.election_history_mandates successor
    WHERE successor.period_id = m.period_id
      AND successor.id <> m.id
      AND successor.district_id = m.district_id
      AND successor.mandate_type = 'direct'
      AND m.mandate_type = 'direct'
      AND successor.entry_type = 'succession'
  )
  AND coalesce(m.starts_on, p.starts_on) IS NOT NULL
  AND (coalesce(m.ends_on, p.ends_on) IS NULL
    OR coalesce(m.starts_on, p.starts_on) <= coalesce(m.ends_on, p.ends_on))
  AND NOT EXISTS (
    SELECT 1 FROM public.election_history_mandates other
    WHERE other.period_id = m.period_id
      AND other.id <> m.id
      AND ((m.person_id IS NOT NULL AND other.person_id = m.person_id)
        OR (m.mandate_type = 'direct' AND other.mandate_type = 'direct'
          AND other.district_id = m.district_id))
      -- Date ranges are inclusive, just like guard_election_history_dates.
      AND (other.starts_on IS NULL
        OR other.starts_on <= coalesce(m.ends_on, p.ends_on, 'infinity'::date))
      AND (other.ends_on IS NULL
        OR other.ends_on >= coalesce(m.starts_on, p.starts_on))
  )
  AND ((m.starts_on IS NULL AND p.starts_on IS NOT NULL)
    OR (m.ends_on IS NULL AND p.ends_on IS NOT NULL));
COMMIT;
