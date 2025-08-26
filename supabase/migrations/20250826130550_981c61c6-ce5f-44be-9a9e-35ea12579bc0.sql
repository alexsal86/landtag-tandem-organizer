-- Fix the trigger to include tenant_id when creating appointments from meetings
CREATE OR REPLACE FUNCTION public.handle_meeting_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public 
AS $$
DECLARE
  default_template_id uuid;
  template_data jsonb;
  item jsonb;
  carryover_item record;
BEGIN
  -- Create appointment entry with tenant_id
  INSERT INTO public.appointments (
    user_id, tenant_id, start_time, end_time, title, description, category, status, priority, meeting_id
  ) VALUES (
    NEW.user_id,
    NEW.tenant_id,  -- Include tenant_id from the meeting
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
    tenant_id = EXCLUDED.tenant_id,  -- Also update tenant_id on conflict
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

  -- Process carryover items first (if template matches)
  IF default_template_id IS NOT NULL THEN
    FOR carryover_item IN 
      SELECT * FROM public.carryover_items 
      WHERE user_id = NEW.user_id 
        AND template_id = default_template_id
      ORDER BY order_index
    LOOP
      -- Insert carryover item
      INSERT INTO public.meeting_agenda_items (
        meeting_id, title, description, notes, result_text, assigned_to, 
        is_completed, is_recurring, order_index, sub_items,
        source_meeting_id, carried_over_from, original_meeting_date, original_meeting_title,
        carryover_notes
      ) VALUES (
        NEW.id,
        carryover_item.title,
        carryover_item.description,
        carryover_item.notes,
        carryover_item.result_text,
        carryover_item.assigned_to,
        false,
        false,
        carryover_item.order_index,
        carryover_item.sub_items,
        carryover_item.original_meeting_id,
        carryover_item.id,
        carryover_item.original_meeting_date,
        carryover_item.original_meeting_title,
        'Übertragen von: ' || carryover_item.original_meeting_title || ' (' || carryover_item.original_meeting_date || ')'
      );
      
      -- Delete processed carryover item
      DELETE FROM public.carryover_items WHERE id = carryover_item.id;
    END LOOP;
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
          (SELECT COALESCE(MAX(order_index), 0) + 1 FROM public.meeting_agenda_items WHERE meeting_id = NEW.id)
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
$$;

-- Also fix the update trigger to include tenant_id
CREATE OR REPLACE FUNCTION public.handle_meeting_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public 
AS $$
BEGIN
  INSERT INTO public.appointments (
    user_id, tenant_id, start_time, end_time, title, description, category, status, priority, meeting_id
  ) VALUES (
    NEW.user_id,
    NEW.tenant_id,  -- Include tenant_id from the meeting
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
    tenant_id = EXCLUDED.tenant_id,  -- Also update tenant_id on conflict
    updated_at = now();

  RETURN NEW;
END;
$$;