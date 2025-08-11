-- Update handle_meeting_insert to only create main items, not sub-items
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