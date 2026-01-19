-- Update the handle_meeting_insert trigger to filter out is_available sub-items
CREATE OR REPLACE FUNCTION public.handle_meeting_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  template_record RECORD;
  template_item JSONB;
  child_item JSONB;
  main_item_id UUID;
  child_order INTEGER;
BEGIN
  -- Get template if template_id is set
  IF NEW.template_id IS NOT NULL THEN
    SELECT * INTO template_record FROM public.meeting_templates WHERE id = NEW.template_id;
    
    IF template_record.template_items IS NOT NULL AND jsonb_typeof(template_record.template_items) = 'array' THEN
      FOR template_item IN SELECT * FROM jsonb_array_elements(template_record.template_items)
      LOOP
        -- Insert main item with system_type extracted correctly
        INSERT INTO public.meeting_agenda_items (
          meeting_id, 
          title, 
          description, 
          order_index,
          system_type,
          is_optional,
          is_visible
        ) VALUES (
          NEW.id,
          COALESCE(template_item->>'title', 'Unbenannt'),
          template_item->>'description',
          COALESCE((template_item->>'order_index')::INTEGER, 0),
          template_item->>'system_type',
          COALESCE((template_item->>'is_optional')::BOOLEAN, false),
          true
        ) RETURNING id INTO main_item_id;
        
        -- Process children if they exist
        IF template_item->'children' IS NOT NULL AND jsonb_typeof(template_item->'children') = 'array' AND jsonb_array_length(template_item->'children') > 0 THEN
          child_order := 0;
          FOR child_item IN SELECT * FROM jsonb_array_elements(template_item->'children')
          LOOP
            -- WICHTIG: Nur aktive Unterpunkte einfügen (is_available = false oder nicht gesetzt)
            IF COALESCE((child_item->>'is_available')::BOOLEAN, false) = false THEN
              INSERT INTO public.meeting_agenda_items (
                meeting_id, 
                title, 
                description, 
                order_index,
                parent_id,
                system_type,
                is_optional,
                is_visible
              ) VALUES (
                NEW.id,
                COALESCE(child_item->>'title', 'Unbenannt'),
                child_item->>'description',
                child_order,
                main_item_id,
                child_item->>'system_type',
                COALESCE((child_item->>'is_optional')::BOOLEAN, false),
                -- Optional items start as not visible
                NOT COALESCE((child_item->>'is_optional')::BOOLEAN, false)
              );
              child_order := child_order + 1;
            END IF;
          END LOOP;
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;