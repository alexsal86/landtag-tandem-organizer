BEGIN;

-- Use the existing period dates and identity bindings. Keep the mandate guards
-- active and leave ambiguous or overlapping records for the quality workbench.
SELECT set_config('app.assembling_election_history','on',true);

DO $backfill$
DECLARE
  item record;
  skipped integer := 0;
BEGIN
  FOR item IN
    WITH note_dates AS (
      SELECT m.id, m.entry_type, m.starts_on, m.ends_on, m.start_from_period,
        m.end_from_period, m.left_early, p.starts_on AS period_start, p.ends_on AS period_end,
        departures.parts AS departure, arrivals.parts AS arrival
      FROM public.election_history_mandates m
      JOIN public.election_history_periods p ON p.id=m.period_id
      CROSS JOIN LATERAL (
        SELECT '([0-9]{1,2})\.[[:space:]]*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)[[:space:]]+([0-9]{4})' AS pattern
      ) date_pattern
      LEFT JOIN LATERAL (
        SELECT string_to_array(string_agg(captures[1]||'.'||captures[2]||'.'||captures[3], '|'), '|') AS parts
        FROM regexp_matches(m.notes,
          '(?:\m(?:eingetreten|nachgerückt)[[:space:]]+(?:am|zum)[[:space:]]+|^ab[[:space:]]+)'||date_pattern.pattern,'gi') AS matches(captures)
        WHERE m.entry_type='succession'
      ) arrivals ON true
      LEFT JOIN LATERAL (
        SELECT string_to_array(string_agg(coalesce(captures[1],captures[4])||'.'||coalesce(captures[2],captures[5])||'.'||coalesce(captures[3],captures[6]), '|'), '|') AS parts
        FROM regexp_matches(m.notes,
          '(?:(?:\m(?:ausgeschieden|verstorben|gestorben|Mandat niedergelegt)[[:space:]]+(?:am|zum)[[:space:]]+|†[[:space:]]*(?:am[[:space:]]+)?)'||date_pattern.pattern
          ||'|\mam[[:space:]]+'||date_pattern.pattern||'[[:space:]]+(?:ausgeschieden|verstorben|gestorben)\M)','gi') AS matches(captures)
      ) departures ON true
    ), individual_dates AS (
      SELECT n.*,
        CASE WHEN cardinality(arrival)=1 THEN to_date(
          split_part(arrival[1],'.',1)||'.'||array_position(months.names,lower(split_part(arrival[1],'.',2)))||'.'||split_part(arrival[1],'.',3),
          'DD.MM.YYYY') END AS individual_start,
        CASE WHEN cardinality(departure)=1 THEN to_date(
          split_part(departure[1],'.',1)||'.'||array_position(months.names,lower(split_part(departure[1],'.',2)))||'.'||split_part(departure[1],'.',3),
          'DD.MM.YYYY') END AS individual_end
      FROM note_dates n
      CROSS JOIN (VALUES (ARRAY['januar','februar','märz','april','mai','juni','juli','august','september','oktober','november','dezember'])) months(names)
    )
    SELECT d.id,
      CASE WHEN d.individual_start IS NOT NULL AND (d.starts_on IS NULL OR d.start_from_period)
           THEN d.individual_start END AS new_start,
      CASE WHEN d.individual_end IS NOT NULL AND (d.ends_on IS NULL OR d.end_from_period)
        AND NOT (d.entry_type='succession' AND d.individual_start IS NOT NULL AND d.individual_end<d.individual_start)
        THEN d.individual_end END AS new_end
    FROM individual_dates d
    WHERE (d.individual_start IS NOT NULL AND (d.starts_on IS NULL OR d.start_from_period))
       OR (d.individual_end IS NOT NULL AND (d.ends_on IS NULL OR d.end_from_period))
       OR (d.entry_type='election' AND d.starts_on IS NULL AND d.period_start IS NOT NULL)
       OR (d.ends_on IS NULL AND NOT d.left_early AND d.period_end IS NOT NULL)
    -- Close documented departures before processing arrivals in the same seat.
    ORDER BY (d.individual_end IS NOT NULL AND d.entry_type='election') DESC,
             coalesce(d.individual_start,d.starts_on,d.period_start),d.id
  LOOP
    BEGIN
      UPDATE public.election_history_mandates m SET
        starts_on=coalesce(item.new_start,m.starts_on),
        start_from_period=m.start_from_period AND item.new_start IS NULL,
        ends_on=coalesce(item.new_end,m.ends_on),
        end_from_period=m.end_from_period AND item.new_end IS NULL,
        left_early=m.left_early OR (item.new_end IS NOT NULL AND item.new_end IS DISTINCT FROM
          (SELECT p.ends_on FROM public.election_history_periods p WHERE p.id=m.period_id))
      WHERE m.id=item.id
        AND (item.new_start IS NOT NULL OR item.new_end IS NOT NULL
          OR m.entry_type='election' AND m.starts_on IS NULL
          OR m.ends_on IS NULL AND NOT m.left_early AND coalesce(m.notes,'') !~*
             '(ausgeschieden|niedergelegt|verstorben|gestorben|Mandatsverzicht|†)');
    EXCEPTION WHEN raise_exception OR integrity_constraint_violation THEN
      skipped := skipped+1;
      RAISE NOTICE 'Mandat % zur Prüfung: %',item.id,SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE '% Mandate wegen bestehender Validierung zur Prüfung zurückgestellt',skipped;
END $backfill$;

-- A confirmed person binding can restore the connection without matching names.
UPDATE public.election_history_mandates m
SET connection_id=binding.connection_id
FROM public.election_history_connection_people binding
WHERE m.connection_id IS NULL AND m.person_id=binding.person_id
  AND NOT EXISTS (
    SELECT 1 FROM public.election_history_mandates other
    WHERE other.connection_id=binding.connection_id AND other.person_id<>binding.person_id
  );

-- Reuse the roster matcher, including its ambiguity, party and birth-year checks.
UPDATE public.election_history_state_list_entries e
SET link_mode='auto'
WHERE e.connection_id IS NULL AND e.link_mode<>'manual' AND e.source_snapshot IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.election_history_mandates m
    LEFT JOIN public.election_history_people p ON p.id=m.person_id
    WHERE m.connection_id IS NOT NULL
      AND public.history_list_person_key(e.person_name) IN (
        public.history_list_person_key(m.person_name),public.history_list_person_key(p.name)
      )
  );

-- A confirmed direct candidacy already identifies the district of its mandate.
DO $direct$
DECLARE item record;
BEGIN
  FOR item IN SELECT m.id,c.district_id
    FROM public.election_history_mandates m
    JOIN public.election_history_candidacies c ON c.id=m.candidacy_id
      AND c.period_id=m.period_id AND c.person_id=m.person_id
    WHERE m.district_id IS NULL AND m.mandate_type='direct'
      AND c.outcome='direct' AND c.district_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.election_history_mandates other
        WHERE other.period_id=m.period_id AND other.district_id=c.district_id
          AND other.mandate_type='direct'
      )
  LOOP
    BEGIN
      UPDATE public.election_history_mandates SET district_id=item.district_id WHERE id=item.id;
    EXCEPTION WHEN raise_exception OR integrity_constraint_violation THEN
      RAISE NOTICE 'Direktmandat % zur Prüfung: %',item.id,SQLERRM;
    END;
  END LOOP;
END $direct$;

-- The source workbook identifies these six list-mandate rows with the
-- constituency of the existing direct winner. Preserve legacy district IDs
-- and all unrelated nominations and geometry links.
DO $districts$
DECLARE item record;
BEGIN
  FOR item IN SELECT m.id,m.candidacy_id,alias.direct_district_id
    FROM (VALUES
   ('7f5ea5dd-e53a-550b-84ed-9ac7792b2b4e'::uuid,'a160ef5d-529f-5e28-8c37-63698ea3f0d7'::uuid),
   ('759c1ee9-8439-50cd-ae65-b318760a2b6b','a7336b4b-f5d3-514d-a7bc-bd529782adcf'),
   ('116c34e3-dcd6-52f4-8c13-dad9cefa7150','9c16583d-15e7-504b-a639-30ee7864ffe2'),
   ('e256e95c-ed69-5c9d-8bfe-1aa3f7a7f024','ba4c6144-2c15-5517-b1a6-ebbfddcf39e1'),
   ('f6a98bce-f064-527d-8eb3-bf7bf4d511bc','a3d49487-723c-5420-bc41-8a71007b6563'),
   -- Workbook district row 2 for 1996 explicitly documents the correction.
   ('7adec399-2e74-5533-8234-a96463d4f9cf','9789b1a3-84d7-50ac-ae59-dd519a0c6d45')
    ) alias(alias_id,direct_district_id)
    JOIN public.election_history_mandates m ON m.district_id=alias.alias_id
    JOIN public.election_history_districts original ON original.id=alias.direct_district_id
      AND original.period_id=m.period_id
    WHERE m.mandate_type='list'
      AND m.id IN (
        'a22a8881-57ea-5f70-af7d-365c82d0dd20','e4f0d3e8-8602-5803-8b61-f8e5e09e73d7',
        'b46a60d2-c8d0-58fc-82c2-b66bff7bbdd7','24fd346a-2b91-5e71-bcd2-e62dd16f8bb5',
        '2271569c-cc1f-5c57-b583-1fc8d7574683','56d889d2-b698-5bb8-898b-a3cf40d3ac9b'
      )
      AND (m.candidacy_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.election_history_mandates other
        WHERE other.candidacy_id=m.candidacy_id AND other.id<>m.id
      ))
      AND EXISTS (
        SELECT 1 FROM public.election_history_mandates winner
        WHERE winner.district_id=original.id AND winner.period_id=m.period_id
          AND winner.mandate_type='direct' AND winner.entry_type='election'
      )
  LOOP
    BEGIN
      IF item.candidacy_id IS NOT NULL THEN
        -- A candidate may already have a separate record at the destination.
        -- The unique index rejects that move and rolls back this pair.
        UPDATE public.election_history_mandates
        SET candidacy_id=NULL
        WHERE id=item.id;
        UPDATE public.election_history_candidacies
        SET district_id=item.direct_district_id
        WHERE id=item.candidacy_id;
      END IF;
      UPDATE public.election_history_mandates
      SET district_id=item.direct_district_id,candidacy_id=item.candidacy_id
      WHERE id=item.id;
    EXCEPTION WHEN raise_exception OR integrity_constraint_violation THEN
      RAISE NOTICE 'Wahlkreiszuordnung für Mandat % zur Prüfung: %',item.id,SQLERRM;
    END;
  END LOOP;
END $districts$;

SELECT set_config('app.assembling_election_history','',true);

CREATE OR REPLACE FUNCTION public.election_history_issue_rows()
RETURNS TABLE(entity text,record_id uuid,period_id uuid,period_number integer,period_name text,label text,issue_code text,issue_label text,list_id uuid)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF NOT public.is_superadmin(auth.uid()) THEN RAISE EXCEPTION 'Nur Super-Admins dürfen Problemfälle öffnen' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 WITH district_aliases(alias_id,direct_district_id) AS (
  -- Exact records from the member import. The constituency number and the
  -- original direct winner agree with the same-year workbook district row.
  VALUES
   ('7f5ea5dd-e53a-550b-84ed-9ac7792b2b4e'::uuid,'a160ef5d-529f-5e28-8c37-63698ea3f0d7'::uuid),
   ('759c1ee9-8439-50cd-ae65-b318760a2b6b','a7336b4b-f5d3-514d-a7bc-bd529782adcf'),
   ('116c34e3-dcd6-52f4-8c13-dad9cefa7150','9c16583d-15e7-504b-a639-30ee7864ffe2'),
   ('e256e95c-ed69-5c9d-8bfe-1aa3f7a7f024','ba4c6144-2c15-5517-b1a6-ebbfddcf39e1'),
   ('f6a98bce-f064-527d-8eb3-bf7bf4d511bc','a3d49487-723c-5420-bc41-8a71007b6563'),
   -- Workbook district row 2 for 1996 explicitly documents the correction.
   ('7adec399-2e74-5533-8234-a96463d4f9cf','9789b1a3-84d7-50ac-ae59-dd519a0c6d45')
 ), period_issues AS (
  SELECT p.*,i.code,i.title FROM public.election_history_periods p CROSS JOIN LATERAL(VALUES
   ('source_missing','Quelle fehlt',nullif(btrim(p.source_url),'') IS NULL),
   ('election_date_missing','Wahltag fehlt',p.election_date IS NULL),
   ('start_missing','Beginn fehlt',p.starts_on IS NULL),
   ('end_missing','Ende fehlt',p.ends_on IS NULL AND NOT p.is_current AND p.expected_ends_on IS NULL)
  )i(code,title,active) WHERE i.active
 ), mandate_issues AS (
  SELECT m.*,i.code,i.title FROM public.election_history_mandates m JOIN public.election_history_periods p ON p.id=m.period_id
  CROSS JOIN LATERAL(VALUES
   ('source_missing','Quelle fehlt',nullif(btrim(m.source_url),'') IS NULL),
   ('identity_missing','Personenverbindung offen',m.person_id IS NULL AND m.connection_id IS NULL),
   ('district_missing','Direktmandat ohne Wahlkreis',m.mandate_type='direct' AND m.district_id IS NULL),
   ('succession_date_missing','Nachrücker ohne eigenes Eintrittsdatum',m.entry_type='succession' AND (m.starts_on IS NULL OR m.start_from_period)),
   ('start_missing','Beginn fehlt',m.starts_on IS NULL AND m.entry_type<>'succession'),
   ('end_missing','Ende fehlt',
    (m.ends_on IS NULL AND (m.left_early OR p.ends_on IS NOT NULL))
    OR ((m.ends_on IS NULL OR m.end_from_period) AND coalesce(m.notes,'') ~*
      '(ausgeschieden|niedergelegt|verstorben|gestorben|Mandatsverzicht|†)'))
  )i(code,title,active) WHERE i.active
 ), district_issues AS (
  SELECT d.*,i.code,i.title FROM public.election_history_districts d CROSS JOIN LATERAL(VALUES
   ('source_missing','Quelle fehlt',nullif(btrim(d.source_url),'') IS NULL),
   (CASE WHEN d.geometry_source_key IS NOT NULL THEN 'direct_1952_mapping' ELSE 'direct_missing' END,
    CASE WHEN d.geometry_source_key IS NOT NULL THEN 'Direktmandat für regionalen 1952-Wahlkreis abgleichen'
         ELSE 'Kein Direktmandat zugeordnet' END,
    NOT EXISTS (
      SELECT 1 FROM public.election_history_mandates m
      WHERE m.period_id=d.period_id AND m.mandate_type='direct'
        AND (m.district_id=d.id OR EXISTS (
          SELECT 1 FROM district_aliases alias
          JOIN public.election_history_districts original ON original.id=alias.direct_district_id
          WHERE alias.alias_id=d.id AND m.district_id=original.id
            AND original.period_id=d.period_id
            AND (original.number_label=d.number_label OR (
              d.id='7adec399-2e74-5533-8234-a96463d4f9cf' AND d.number_label='01'
              AND original.district_number=2 AND d.name=original.name
            ))
        ))
    ))
  )i(code,title,active) WHERE i.active
 ), candidate_issues AS (
  SELECT c.*,i.code,i.title FROM public.election_history_candidacies c CROSS JOIN LATERAL(VALUES
   ('source_missing','Quelle fehlt',nullif(btrim(c.source_url),'') IS NULL),
   ('result_missing','Ergebnis fehlt',c.votes IS NULL AND c.vote_share IS NULL),
   ('outcome_missing','Wahlausgang offen',c.outcome='unknown')
  )i(code,title,active) WHERE i.active
 )
 SELECT 'periods',p.id,p.id,p.number,p.name,p.name,p.code,p.title,NULL::uuid FROM period_issues p
 UNION ALL SELECT 'mandates',m.id,p.id,p.number,p.name,coalesce(m.person_name,person.name,'Name fehlt')||' · '||m.party,m.code,m.title,NULL::uuid FROM mandate_issues m JOIN public.election_history_periods p ON p.id=m.period_id LEFT JOIN public.election_history_people person ON person.id=m.person_id
 UNION ALL SELECT 'districts',d.id,p.id,p.number,p.name,coalesce(d.number_label,d.district_number::text,'–')||': '||d.name,d.code,d.title,NULL::uuid FROM district_issues d JOIN public.election_history_periods p ON p.id=d.period_id
 UNION ALL SELECT 'candidacies',c.id,p.id,p.number,p.name,person.name||' · '||c.party,c.code,c.title,NULL::uuid FROM candidate_issues c JOIN public.election_history_periods p ON p.id=c.period_id JOIN public.election_history_people person ON person.id=c.person_id
 UNION ALL SELECT 'districts',NULL::uuid,p.id,p.number,p.name,p.name,'records_missing','Keine Wahlkreise erfasst',NULL::uuid FROM public.election_history_periods p WHERE NOT EXISTS(SELECT 1 FROM public.election_history_districts d WHERE d.period_id=p.id)
 UNION ALL SELECT 'mandates',NULL::uuid,p.id,p.number,p.name,p.name,'records_missing','Keine Mandate erfasst',NULL::uuid FROM public.election_history_periods p WHERE NOT EXISTS(SELECT 1 FROM public.election_history_mandates m WHERE m.period_id=p.id)
 UNION ALL SELECT 'candidacies',NULL::uuid,p.id,p.number,p.name,p.name,'records_missing','Keine Kandidaturen erfasst',NULL::uuid FROM public.election_history_periods p WHERE NOT EXISTS(SELECT 1 FROM public.election_history_candidacies c WHERE c.period_id=p.id)
 UNION ALL SELECT 'state_lists',NULL::uuid,p.id,p.number,p.name,p.name,'records_missing','Keine Landeslisten erfasst',NULL::uuid FROM public.election_history_periods p WHERE p.number>=18 AND NOT EXISTS(SELECT 1 FROM public.election_history_state_lists l WHERE l.period_id=p.id)
 UNION ALL SELECT 'state_lists',l.id,p.id,p.number,p.name,l.party,'source_missing','Quelle fehlt',l.id FROM public.election_history_state_lists l JOIN public.election_history_periods p ON p.id=l.period_id WHERE nullif(btrim(l.source_url),'') IS NULL
 UNION ALL SELECT 'state_lists',l.id,p.id,p.number,p.name,l.party,'records_missing','Landesliste ohne Einträge',l.id FROM public.election_history_state_lists l JOIN public.election_history_periods p ON p.id=l.period_id WHERE NOT EXISTS(SELECT 1 FROM public.election_history_state_list_entries e WHERE e.list_id=l.id)
 UNION ALL SELECT 'state_lists',e.id,p.id,p.number,p.name,e.position::text||'. '||e.person_name||' · '||l.party,'identity_missing','Personenverbindung offen',l.id FROM public.election_history_state_list_entries e JOIN public.election_history_state_lists l ON l.id=e.list_id JOIN public.election_history_periods p ON p.id=l.period_id WHERE e.connection_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.election_history_mandates m WHERE m.connection_id=e.connection_id)
 UNION ALL SELECT 'candidacies',coalesce(a.candidacy_id,existing.id),p.id,p.number,p.name,
  concat_ws(' · ',a.source_data->>'name',a.source_data->>'party',a.source_data->>'district'),
  CASE WHEN a.status='existing_result_differs' THEN 'workbook_candidate_result' ELSE 'workbook_candidate_review' END,
  CASE WHEN a.status='existing_result_differs' THEN 'Persönliches Ergebnis weicht von der Arbeitsmappe ab'
       WHEN a.status='Bestehende Kandidatur gehört zu einer anderen Person' THEN
         'Arbeitsmappe und Datenbank nennen unterschiedliche Personen für denselben Wahlvorschlag'
         || CASE WHEN existing.person_name IS NOT NULL THEN ' · Datenbank: '||existing.person_name ELSE '' END
       ELSE 'Arbeitsmappe: '||a.status END,
  NULL::uuid
 FROM public.election_history_candidate_workbook_audit a
 JOIN public.election_history_periods p ON p.number=(a.source_data->>'period')::integer
  AND p.election_year=(a.source_data->>'year')::integer
 LEFT JOIN LATERAL (
  SELECT (array_agg(c.id))[1] AS id,min(person.name) AS person_name
  FROM public.election_history_candidacies c
  JOIN public.election_history_people person ON person.id=c.person_id
  JOIN public.election_history_districts d ON d.id=c.district_id
  WHERE a.status='Bestehende Kandidatur gehört zu einer anderen Person'
    AND c.period_id=p.id AND c.party=public.resolve_history_faction(a.source_data->>'party')
    AND c.ballot_type=CASE WHEN p.election_year>=2026 THEN 'first_vote' ELSE 'candidate' END
    AND CASE WHEN p.election_year=1952 THEN d.geometry_source_key=a.source_data->>'source_key'
         ELSE d.district_number=(a.source_data->>'number')::integer
           OR (d.district_number IS NULL AND d.number_label IN (
              a.source_data->>'number',lpad(a.source_data->>'number',2,'0')
            ) AND lower(btrim(d.name))=lower(btrim(a.source_data->>'district')))
        END
  HAVING count(*)=1
 ) existing ON true
 WHERE a.status NOT IN ('added','existing');
END $$;
COMMIT;
