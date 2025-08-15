-- Update create_default_checklist_items function to support type field
CREATE OR REPLACE FUNCTION public.create_default_checklist_items(planning_id uuid, template_id_param uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  template_data jsonb;
  item jsonb;
BEGIN
  -- If template_id is provided, use template items
  IF template_id_param IS NOT NULL THEN
    SELECT template_items INTO template_data 
    FROM public.planning_templates 
    WHERE id = template_id_param;
    
    IF template_data IS NOT NULL THEN
      FOR item IN SELECT * FROM jsonb_array_elements(template_data)
      LOOP
        INSERT INTO public.event_planning_checklist_items (
          event_planning_id, title, order_index, sub_items, type
        ) VALUES (
          planning_id, 
          item->>'title', 
          (item->>'order_index')::int,
          COALESCE(item->'sub_items', '[]'::jsonb),
          COALESCE(item->>'type', 'item')
        );
      END LOOP;
    END IF;
  ELSE
    -- Fallback to default items if no template
    INSERT INTO public.event_planning_checklist_items (event_planning_id, title, order_index, type) VALUES
      (planning_id, 'Social Media geplant', 0, 'item'),
      (planning_id, 'Begleitung erwünscht', 1, 'item'),
      (planning_id, 'Information an Kreisverband', 2, 'item'),
      (planning_id, 'Information an Gemeinderatsfraktion', 3, 'item'),
      (planning_id, 'Information an Abgeordnete', 4, 'item'),
      (planning_id, 'Pressemitteilung vorbereitet', 5, 'item'),
      (planning_id, 'Technik überprüft', 6, 'item'),
      (planning_id, 'Catering organisiert', 7, 'item'),
      (planning_id, 'Einladungen verschickt', 8, 'item'),
      (planning_id, 'Nachbereitung geplant', 9, 'item');
  END IF;
END;
$function$;