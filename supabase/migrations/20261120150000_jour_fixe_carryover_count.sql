ALTER TABLE public.meeting_agenda_items
  ADD COLUMN IF NOT EXISTS carryover_count integer NOT NULL DEFAULT 0 CHECK (carryover_count >= 0);

ALTER TABLE public.carryover_items
  ADD COLUMN IF NOT EXISTS carryover_count integer NOT NULL DEFAULT 1 CHECK (carryover_count >= 1);

-- Follow recorded agenda item links. A legacy transfer without a link contributes one known move.
WITH RECURSIVE history AS (
  SELECT id AS target_id, source_meeting_id, carried_over_from, 1 AS moves, ARRAY[id] AS visited
  FROM public.meeting_agenda_items
  WHERE source_meeting_id IS NOT NULL AND carryover_count = 0
  UNION ALL
  SELECT h.target_id, previous.source_meeting_id, previous.carried_over_from,
         h.moves + 1, h.visited || previous.id
  FROM history h
  JOIN public.meeting_agenda_items previous
    ON previous.id = h.carried_over_from AND previous.meeting_id = h.source_meeting_id
  WHERE previous.source_meeting_id IS NOT NULL AND NOT (previous.id = ANY(h.visited))
), counts AS (
  SELECT target_id, max(moves) AS moves FROM history GROUP BY target_id
)
UPDATE public.meeting_agenda_items item
SET carryover_count = counts.moves
FROM counts
WHERE item.id = counts.target_id;

-- Old buffer rows identify their source by meeting and title.
WITH unique_sources AS (
  SELECT buffer.id, max(source.carryover_count) + 1 AS moves
  FROM public.carryover_items buffer
  JOIN public.meeting_agenda_items source
    ON source.meeting_id = buffer.original_meeting_id AND source.title = buffer.title
  WHERE source.carry_over_to_next AND buffer.carryover_count = 1
  GROUP BY buffer.id
  HAVING count(*) = 1
)
UPDATE public.carryover_items buffer
SET carryover_count = unique_sources.moves
FROM unique_sources
WHERE buffer.id = unique_sources.id AND unique_sources.moves > 1;

-- Keep both transfer paths in the existing locked archive operation.
DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.archive_meeting_with_stafette(uuid)'::regprocedure);
  updated_definition text;
BEGIN
  updated_definition := replace(definition,
    'order_index,source_meeting_id,carried_over_from',
    'order_index,carryover_count,source_meeting_id,carried_over_from');
  updated_definition := replace(updated_definition,
    'order_index,original_meeting_id,original_meeting_date',
    'order_index,carryover_count,original_meeting_id,original_meeting_date');
  updated_definition := replace(updated_definition,
    'a.order_index,m.id,', 'a.order_index,a.carryover_count+1,m.id,');

  IF position('order_index,carryover_count,source_meeting_id,carried_over_from' IN updated_definition) = 0
    OR position('order_index,carryover_count,original_meeting_id,original_meeting_date' IN updated_definition) = 0
    OR position('a.order_index,a.carryover_count+1,m.id,a.id,' IN updated_definition) = 0
    OR position('a.order_index,a.carryover_count+1,m.id,m.meeting_date' IN updated_definition) = 0 THEN
    RAISE EXCEPTION 'Jour-fixe carryover logic was not found in the expected form';
  END IF;

  IF updated_definition IS DISTINCT FROM definition THEN
    EXECUTE updated_definition;
  END IF;
END $migration$;
