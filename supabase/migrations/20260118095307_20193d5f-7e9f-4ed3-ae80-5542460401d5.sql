-- Update the handle_meeting_insert trigger to read from template_items JSON in meeting_templates table
CREATE OR REPLACE FUNCTION public.handle_meeting_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  template_data JSONB;
  item JSONB;
  child_item JSONB;
  parent_agenda_id UUID;
  item_index INT;
  child_index INT;
BEGIN
  -- Only proceed if template_id is provided
  IF NEW.template_id IS NOT NULL THEN
    -- Get template_items JSON from meeting_templates
    SELECT template_items::jsonb INTO template_data
    FROM meeting_templates
    WHERE id = NEW.template_id;
    
    IF template_data IS NOT NULL AND jsonb_array_length(template_data) > 0 THEN
      item_index := 0;
      
      -- Loop through template items
      FOR item IN SELECT * FROM jsonb_array_elements(template_data)
      LOOP
        -- Insert main item
        INSERT INTO meeting_agenda_items (
          meeting_id, 
          title, 
          description, 
          order_index, 
          system_type,
          created_at, 
          updated_at
        ) VALUES (
          NEW.id,
          item->>'title',
          item->>'description',
          item_index,
          item->>'system_type',
          NOW(),
          NOW()
        )
        RETURNING id INTO parent_agenda_id;
        
        -- Check for children array
        IF item->'children' IS NOT NULL AND jsonb_array_length(item->'children') > 0 THEN
          child_index := 0;
          
          FOR child_item IN SELECT * FROM jsonb_array_elements(item->'children')
          LOOP
            INSERT INTO meeting_agenda_items (
              meeting_id, 
              title, 
              description, 
              order_index, 
              parent_id,
              system_type,
              created_at, 
              updated_at
            ) VALUES (
              NEW.id,
              child_item->>'title',
              child_item->>'description',
              child_index,
              parent_agenda_id,
              child_item->>'system_type',
              NOW(),
              NOW()
            );
            
            child_index := child_index + 1;
          END LOOP;
        END IF;
        
        item_index := item_index + 1;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;