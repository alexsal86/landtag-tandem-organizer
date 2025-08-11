-- Add fields for meeting results and carryover functionality
ALTER TABLE public.meeting_agenda_items 
ADD COLUMN result_text text,
ADD COLUMN carry_over_to_next boolean DEFAULT false;

-- Add index for better performance when querying carryover items
CREATE INDEX idx_meeting_agenda_items_carry_over ON public.meeting_agenda_items (carry_over_to_next, is_completed);

-- Update the handle_meeting_insert function to include carryover items from the same template
CREATE OR REPLACE FUNCTION public.handle_meeting_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  default_template_id uuid;
  template_data jsonb;
  item jsonb;
  carryover_item record;
BEGIN
  -- Create appointment entry
  INSERT INTO public.appointments (
    user_id, start_time, end_time, title, description, category, status, priority, meeting_id
  ) VALUES (
    NEW.user_id,
    public._meeting_default_start(NEW.meeting_date),
    public._meeting_default_end(NEW.meeting_date),
    NEW.title,
    NEW.description,
    'meeting',
    NEW.status,
    'medium',
    NEW.id
  )
  ON CONFLICT (meeting_id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    status = EXCLUDED.status,
    category = EXCLUDED.category,
    updated_at = now();

  -- Get default template if no template_id specified
  IF NEW.template_id IS NULL THEN
    SELECT id INTO default_template_id 
    FROM public.meeting_templates 
    WHERE name = 'Standard Meeting Template' 
    LIMIT 1;
  ELSE
    default_template_id := NEW.template_id;
  END IF;

  -- If we have a template, use its items (only main items, no sub-items)
  IF default_template_id IS NOT NULL THEN
    SELECT template_items INTO template_data 
    FROM public.meeting_templates 
    WHERE id = default_template_id;
    
    -- Create agenda items from template (only main items)
    IF template_data IS NOT NULL THEN
      FOR item IN SELECT * FROM jsonb_array_elements(template_data)
      LOOP
        -- Insert only main items, skip children
        INSERT INTO public.meeting_agenda_items (
          meeting_id, title, description, is_completed, is_recurring, order_index
        ) VALUES (
          NEW.id, 
          item->>'title', 
          item->>'description', 
          false, 
          false, 
          (item->>'order_index')::int
        );
      END LOOP;
    END IF;

    -- Add carryover items from previous meetings with the same template
    FOR carryover_item IN 
      SELECT mai.title, mai.description, mai.assigned_to, mai.notes, mai.result_text
      FROM public.meeting_agenda_items mai
      INNER JOIN public.meetings m ON m.id = mai.meeting_id
      WHERE m.template_id = default_template_id 
        AND m.user_id = NEW.user_id
        AND mai.carry_over_to_next = true
        AND m.meeting_date < NEW.meeting_date
      ORDER BY m.meeting_date DESC, mai.order_index
    LOOP
      -- Try to find matching agenda item by title
      UPDATE public.meeting_agenda_items 
      SET 
        notes = COALESCE(notes, '') || CASE WHEN notes IS NOT NULL AND notes != '' THEN E'\n\n' ELSE '' END || 
                'Übertragen: ' || COALESCE(carryover_item.result_text, carryover_item.notes, ''),
        assigned_to = COALESCE(carryover_item.assigned_to, assigned_to)
      WHERE meeting_id = NEW.id 
        AND title = carryover_item.title;
      
      -- If no matching item found, add at the end
      IF NOT FOUND THEN
        INSERT INTO public.meeting_agenda_items (
          meeting_id, title, description, assigned_to, notes, is_completed, is_recurring, 
          order_index
        ) VALUES (
          NEW.id,
          carryover_item.title,
          carryover_item.description,
          carryover_item.assigned_to,
          'Übertragen: ' || COALESCE(carryover_item.result_text, carryover_item.notes, ''),
          false,
          false,
          (SELECT COALESCE(MAX(order_index), 0) + 1 FROM public.meeting_agenda_items WHERE meeting_id = NEW.id)
        );
      END IF;
    END LOOP;

  ELSE
    -- Fallback: create default agenda items if no template found
    INSERT INTO public.meeting_agenda_items (
      meeting_id, title, description, is_completed, is_recurring, order_index
    ) VALUES
      (NEW.id, 'Begrüßung', NULL, false, false, 0),
      (NEW.id, 'Aktuelles aus dem Landtag', NULL, false, false, 1),
      (NEW.id, 'Politische Schwerpunktthemen & Projekte', NULL, false, false, 2),
      (NEW.id, 'Wahlkreisarbeit', NULL, false, false, 3),
      (NEW.id, 'Kommunikation & Öffentlichkeitsarbeit', NULL, false, false, 4),
      (NEW.id, 'Organisation & Bürointerna', NULL, false, false, 5),
      (NEW.id, 'Verschiedenes', NULL, false, false, 6);
  END IF;

  RETURN NEW;
END;
$function$;