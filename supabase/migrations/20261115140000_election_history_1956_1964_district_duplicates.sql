-- Repair the four numberless workbook entries, retaining the existing 1–70
-- registry and all member records. Source errata and evidence are documented in
-- docs/election-analysis/sources/1956-1964-import-corrections.md.
BEGIN;

DO $$
DECLARE
  correction record;
  duplicate public.election_history_districts;
  target_id uuid;
BEGIN
  FOR correction IN SELECT * FROM (VALUES
    ('8f75620f-73ff-5da6-b1ce-6a7e8d83758c'::uuid, 2, 1956, 'Stuttgart IV', '05', 4),
    ('a0640415-7943-558b-8ece-4694bfe9490b'::uuid, 2, 1956, 'Stuttgart V', '05', 5),
    ('fc8ff3d6-c842-5c15-84a4-c2f28d0b0934'::uuid, 4, 1964, 'Waiblingen', '23', 23),
    ('4bf4b624-2f8d-5d69-beb6-e490af371c1c'::uuid, 4, 1964, 'Waiblingen I', '23', 23)
  ) AS corrections(id, period_number, election_year, imported_name, number_label, target_number)
  LOOP
    -- Match only the known imported artifacts. Unexpected manual changes abort
    -- the transaction instead of guessing how to reconcile new historical data.
    SELECT d.* INTO duplicate FROM public.election_history_districts d
      WHERE d.id = correction.id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    PERFORM 1 FROM public.election_history_periods p
      WHERE p.id = duplicate.period_id AND p.number = correction.period_number
        AND p.election_year = correction.election_year FOR UPDATE;
    IF NOT FOUND OR duplicate.district_number IS NOT NULL
      OR duplicate.name IS DISTINCT FROM correction.imported_name
      OR duplicate.number_label IS DISTINCT FROM correction.number_label
      OR duplicate.boundaries IS NOT NULL THEN
      RAISE EXCEPTION 'Unexpected historical district state for %; manual review required', correction.id;
    END IF;

    SELECT d.id INTO target_id FROM public.election_history_districts d
      WHERE d.period_id = duplicate.period_id
        AND d.district_number = correction.target_number
        AND d.name = public.election_history_source_district_name(correction.election_year, correction.target_number)
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Missing canonical district % for legislature %', correction.target_number, correction.period_number;
    END IF;

    -- The workbook supplied mandates only. Do not silently reinterpret any
    -- independently added candidate results or verified analysis identities.
    IF EXISTS (SELECT 1 FROM public.election_history_candidacies WHERE district_id = duplicate.id)
      OR EXISTS (SELECT 1 FROM public.election_history_mandates WHERE district_id = duplicate.id AND candidacy_id IS NOT NULL)
      OR EXISTS (SELECT 1 FROM public.election_analysis_versions WHERE historical_district_id = duplicate.id) THEN
      RAISE EXCEPTION 'Additional historical references for %; manual review required', duplicate.id;
    END IF;

    UPDATE public.election_history_mandates SET district_id = target_id
      WHERE period_id = duplicate.period_id AND district_id = duplicate.id;
    DELETE FROM public.election_history_districts WHERE id = duplicate.id;
    -- Existing audit and geometry-invalidation triggers remain active. Changed
    -- historical assignments require fresh boundary confirmation by an admin.
  END LOOP;
END;
$$;

COMMIT;
