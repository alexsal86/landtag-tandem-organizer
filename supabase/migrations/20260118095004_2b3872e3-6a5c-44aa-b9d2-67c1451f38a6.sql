-- Add system_type column to meeting_agenda_items
ALTER TABLE public.meeting_agenda_items 
  ADD COLUMN IF NOT EXISTS system_type TEXT;

COMMENT ON COLUMN public.meeting_agenda_items.system_type 
  IS 'Type of system content: upcoming_appointments, quick_notes, or null for regular items';

-- Update the handle_meeting_insert trigger function to include system_type and children
CREATE OR REPLACE FUNCTION public.handle_meeting_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  template_item RECORD;
  child_item RECORD;
  parent_agenda_id UUID;
BEGIN
  -- Only proceed if template_id is provided
  IF NEW.template_id IS NOT NULL THEN
    -- First, insert main items (items without parent)
    FOR template_item IN 
      SELECT * FROM meeting_template_items 
      WHERE template_id = NEW.template_id 
      AND parent_id IS NULL
      ORDER BY order_index
    LOOP
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
        template_item.title,
        template_item.description,
        template_item.order_index,
        template_item.system_type,
        NOW(),
        NOW()
      )
      RETURNING id INTO parent_agenda_id;
      
      -- Now insert children of this item
      FOR child_item IN 
        SELECT * FROM meeting_template_items 
        WHERE parent_id = template_item.id
        ORDER BY order_index
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
          child_item.title,
          child_item.description,
          child_item.order_index,
          parent_agenda_id,
          child_item.system_type,
          NOW(),
          NOW()
        );
      END LOOP;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;