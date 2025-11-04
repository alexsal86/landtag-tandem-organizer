-- Function to automatically create appointment feedback entries
CREATE OR REPLACE FUNCTION public.create_appointment_feedback_entry()
RETURNS TRIGGER AS $$
DECLARE
  user_settings RECORD;
  calculated_priority INTEGER := 0;
BEGIN
  -- Only for completed appointments
  IF NEW.end_time > now() THEN
    RETURN NEW;
  END IF;
  
  -- Check if feedback already exists
  IF EXISTS (
    SELECT 1 FROM appointment_feedback 
    WHERE appointment_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;
  
  -- Get user settings
  SELECT * INTO user_settings 
  FROM appointment_feedback_settings 
  WHERE user_id = NEW.user_id 
  LIMIT 1;
  
  -- Auto-skip internal appointments if enabled
  IF user_settings.auto_skip_internal = true
     AND NEW.category = 'intern' THEN
    -- Create feedback entry with skipped status
    INSERT INTO appointment_feedback (
      appointment_id,
      user_id,
      tenant_id,
      feedback_status,
      priority_score
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.tenant_id,
      'skipped',
      0
    )
    ON CONFLICT (appointment_id) DO NOTHING;
    
    RETURN NEW;
  END IF;
  
  -- Calculate priority score
  IF user_settings.priority_categories IS NOT NULL 
     AND NEW.category = ANY(user_settings.priority_categories) THEN
    calculated_priority := 2;
  END IF;
  
  IF NEW.category = 'extern' THEN
    calculated_priority := 3;
  END IF;
  
  -- Create feedback entry with pending status
  INSERT INTO appointment_feedback (
    appointment_id,
    user_id,
    tenant_id,
    feedback_status,
    priority_score
  ) VALUES (
    NEW.id,
    NEW.user_id,
    NEW.tenant_id,
    'pending',
    calculated_priority
  )
  ON CONFLICT (appointment_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic feedback creation
DROP TRIGGER IF EXISTS trigger_create_appointment_feedback ON appointments;
CREATE TRIGGER trigger_create_appointment_feedback
AFTER INSERT OR UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION create_appointment_feedback_entry();