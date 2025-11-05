-- Update trigger function to use real categories from settings
CREATE OR REPLACE FUNCTION public.create_appointment_feedback_entry()
RETURNS TRIGGER AS $$
DECLARE
  user_settings RECORD;
  calculated_priority INTEGER := 0;
BEGIN
  -- Nur für beendete Termine
  IF NEW.end_time > now() THEN
    RETURN NEW;
  END IF;
  
  -- Prüfe ob bereits Feedback existiert
  IF EXISTS (
    SELECT 1 FROM appointment_feedback 
    WHERE appointment_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;
  
  -- Hole User-Settings
  SELECT * INTO user_settings 
  FROM appointment_feedback_settings 
  WHERE user_id = NEW.user_id 
  LIMIT 1;
  
  -- Falls keine Settings vorhanden, erstelle Standard-Feedback
  IF user_settings IS NULL THEN
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
      1
    )
    ON CONFLICT (appointment_id) DO NOTHING;
    RETURN NEW;
  END IF;
  
  -- Auto-Skip für interne Termine wenn aktiviert
  IF user_settings.auto_skip_internal 
     AND NEW.category = 'intern' THEN
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
  
  -- Priorität berechnen basierend auf priority_categories
  IF NEW.category = ANY(user_settings.priority_categories) THEN
    calculated_priority := 3;
  ELSE
    calculated_priority := 1;
  END IF;
  
  -- Feedback-Eintrag erstellen
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