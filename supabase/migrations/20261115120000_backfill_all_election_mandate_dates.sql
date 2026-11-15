BEGIN;
-- Reuse the existing inheritance trigger and the administrator-entered period
-- dates. Preserve individual dates and exclude early exits and replacements.
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
  AND ((m.starts_on IS NULL AND p.starts_on IS NOT NULL)
    OR (m.ends_on IS NULL AND p.ends_on IS NOT NULL));
COMMIT;
