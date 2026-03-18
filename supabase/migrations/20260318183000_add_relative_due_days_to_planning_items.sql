ALTER TABLE public.event_planning_checklist_items
ADD COLUMN relative_due_days integer;

CREATE OR REPLACE FUNCTION public.create_default_checklist_items(planning_id uuid, template_id_param uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  template_data jsonb;
  item jsonb;
BEGIN
  IF template_id_param IS NOT NULL THEN
    SELECT template_items INTO template_data
    FROM public.planning_templates
    WHERE id = template_id_param;

    IF template_data IS NOT NULL THEN
      FOR item IN SELECT * FROM jsonb_array_elements(template_data)
      LOOP
        INSERT INTO public.event_planning_checklist_items (
          event_planning_id, title, order_index, sub_items, type, relative_due_days
        ) VALUES (
          planning_id,
          item->>'title',
          (item->>'order_index')::int,
          COALESCE(item->'sub_items', '[]'::jsonb),
          COALESCE(item->>'type', 'item'),
          CASE
            WHEN item ? 'relative_due_days' AND NULLIF(item->>'relative_due_days', '') IS NOT NULL
              THEN (item->>'relative_due_days')::int
            ELSE NULL
          END
        );
      END LOOP;
    END IF;
  ELSE
    INSERT INTO public.event_planning_checklist_items (event_planning_id, title, order_index, type, relative_due_days) VALUES
      (planning_id, 'Social Media geplant', 0, 'item', NULL),
      (planning_id, 'Begleitung erwünscht', 1, 'item', NULL),
      (planning_id, 'Information an Kreisverband', 2, 'item', NULL),
      (planning_id, 'Information an Gemeinderatsfraktion', 3, 'item', NULL),
      (planning_id, 'Information an Abgeordnete', 4, 'item', NULL),
      (planning_id, 'Pressemitteilung vorbereitet', 5, 'item', NULL),
      (planning_id, 'Technik überprüft', 6, 'item', NULL),
      (planning_id, 'Catering organisiert', 7, 'item', NULL),
      (planning_id, 'Einladungen verschickt', 8, 'item', NULL),
      (planning_id, 'Nachbereitung geplant', 9, 'item', NULL);
  END IF;
END;
$function$;
