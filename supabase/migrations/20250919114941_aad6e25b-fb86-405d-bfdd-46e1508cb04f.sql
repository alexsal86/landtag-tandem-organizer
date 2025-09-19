-- Function to sync tags from contacts to the tags table
CREATE OR REPLACE FUNCTION sync_contact_tags_to_tags_table()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tag_name text;
  next_order_index integer;
  tag_colors text[] := ARRAY['#dc2626', '#ea580c', '#2563eb', '#16a34a', '#7c3aed', '#0891b2', '#f59e0b', '#be185d', '#0d9488', '#7c2d12'];
  color_index integer;
BEGIN
  -- Only proceed if we have tags
  IF NEW.tags IS NOT NULL AND array_length(NEW.tags, 1) > 0 THEN
    
    -- Loop through each tag in the contact's tags array
    FOREACH tag_name IN ARRAY NEW.tags
    LOOP
      -- Skip empty or null tags
      IF tag_name IS NOT NULL AND trim(tag_name) != '' THEN
        
        -- Check if tag already exists (case insensitive)
        IF NOT EXISTS (
          SELECT 1 FROM public.tags 
          WHERE LOWER(name) = LOWER(trim(tag_name))
        ) THEN
          
          -- Get the next order index
          SELECT COALESCE(MAX(order_index), -1) + 1 INTO next_order_index FROM public.tags;
          
          -- Select a color based on the hash of the tag name
          color_index := (abs(hashtext(LOWER(trim(tag_name)))) % array_length(tag_colors, 1)) + 1;
          
          -- Insert the new tag
          INSERT INTO public.tags (
            name, 
            label, 
            color, 
            is_active, 
            order_index
          ) VALUES (
            LOWER(trim(tag_name)), 
            trim(tag_name), 
            tag_colors[color_index], 
            true, 
            next_order_index
          )
          ON CONFLICT (name) DO NOTHING; -- In case of race conditions
          
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically sync tags when contacts are inserted or updated
CREATE OR REPLACE TRIGGER sync_contact_tags_trigger
  AFTER INSERT OR UPDATE OF tags ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION sync_contact_tags_to_tags_table();

-- Also create a function to manually sync existing tags from contacts
CREATE OR REPLACE FUNCTION sync_existing_contact_tags()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  contact_record RECORD;
  tag_name text;
  next_order_index integer;
  tag_colors text[] := ARRAY['#dc2626', '#ea580c', '#2563eb', '#16a34a', '#7c3aed', '#0891b2', '#f59e0b', '#be185d', '#0d9488', '#7c2d12'];
  color_index integer;
BEGIN
  -- Loop through all contacts with tags
  FOR contact_record IN 
    SELECT DISTINCT unnest(tags) as tag FROM public.contacts WHERE tags IS NOT NULL
  LOOP
    tag_name := contact_record.tag;
    
    -- Skip empty or null tags
    IF tag_name IS NOT NULL AND trim(tag_name) != '' THEN
      
      -- Check if tag already exists (case insensitive)
      IF NOT EXISTS (
        SELECT 1 FROM public.tags 
        WHERE LOWER(name) = LOWER(trim(tag_name))
      ) THEN
        
        -- Get the next order index
        SELECT COALESCE(MAX(order_index), -1) + 1 INTO next_order_index FROM public.tags;
        
        -- Select a color based on the hash of the tag name
        color_index := (abs(hashtext(LOWER(trim(tag_name)))) % array_length(tag_colors, 1)) + 1;
        
        -- Insert the new tag
        INSERT INTO public.tags (
          name, 
          label, 
          color, 
          is_active, 
          order_index
        ) VALUES (
          LOWER(trim(tag_name)), 
          trim(tag_name), 
          tag_colors[color_index], 
          true, 
          next_order_index
        )
        ON CONFLICT (name) DO NOTHING;
        
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Run the sync function once to catch existing tags
SELECT sync_existing_contact_tags();