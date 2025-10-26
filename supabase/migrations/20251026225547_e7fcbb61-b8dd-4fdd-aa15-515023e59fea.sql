-- Tabelle für Appointment Feedback
CREATE TABLE appointment_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Status
  feedback_status TEXT NOT NULL DEFAULT 'pending' CHECK (feedback_status IN ('pending', 'completed', 'skipped')),
  
  -- Feedback-Daten
  notes TEXT,
  has_documents BOOLEAN DEFAULT false,
  has_tasks BOOLEAN DEFAULT false,
  
  -- Priorität für die Anzeige (wird automatisch berechnet basierend auf Termin-Kategorie)
  priority_score INTEGER DEFAULT 0,
  
  -- Reminder-Status
  reminder_dismissed BOOLEAN DEFAULT false,
  reminder_dismissed_at TIMESTAMPTZ,
  
  -- Timestamps
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Eindeutigkeit: Pro Termin und User nur ein Feedback
  UNIQUE(appointment_id, user_id)
);

-- Indizes für Performance
CREATE INDEX idx_appointment_feedback_user_status ON appointment_feedback(user_id, feedback_status);
CREATE INDEX idx_appointment_feedback_appointment ON appointment_feedback(appointment_id);
CREATE INDEX idx_appointment_feedback_priority ON appointment_feedback(user_id, priority_score DESC, created_at DESC);

-- RLS aktivieren
ALTER TABLE appointment_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own feedback"
  ON appointment_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
  ON appointment_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
  ON appointment_feedback FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback"
  ON appointment_feedback FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger für updated_at
CREATE TRIGGER update_appointment_feedback_updated_at
  BEFORE UPDATE ON appointment_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Tabelle für Settings
CREATE TABLE appointment_feedback_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Wann soll das Reminder-Badge erscheinen?
  reminder_start_time TIME DEFAULT '17:00:00',
  
  -- Welche Kategorien haben höhere Priorität?
  priority_categories TEXT[] DEFAULT ARRAY['extern', 'wichtig'],
  
  -- Andere Einstellungen
  show_all_appointments BOOLEAN DEFAULT true,
  auto_skip_internal BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id)
);

-- RLS aktivieren
ALTER TABLE appointment_feedback_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own settings"
  ON appointment_feedback_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON appointment_feedback_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON appointment_feedback_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger für updated_at
CREATE TRIGGER update_appointment_feedback_settings_updated_at
  BEFORE UPDATE ON appointment_feedback_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Funktion die automatisch nach jedem vergangenen Termin ein Feedback-Entry erstellt
CREATE OR REPLACE FUNCTION create_appointment_feedback_on_past()
RETURNS TRIGGER AS $$
BEGIN
  -- Nur für vergangene Termine
  IF NEW.end_time < now() THEN
    INSERT INTO appointment_feedback (appointment_id, user_id, tenant_id, feedback_status, priority_score)
    VALUES (
      NEW.id, 
      NEW.user_id, 
      NEW.tenant_id, 
      'pending',
      -- Priorität basierend auf Kategorie berechnen
      CASE 
        WHEN NEW.category IN ('extern', 'wichtig') THEN 10
        WHEN NEW.category IN ('bürger', 'fraktion') THEN 5
        ELSE 0
      END
    )
    ON CONFLICT (appointment_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger auf appointments
CREATE TRIGGER appointment_feedback_auto_create
  AFTER INSERT OR UPDATE OF end_time ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION create_appointment_feedback_on_past();

-- Funktion für Team-Benachrichtigung
CREATE OR REPLACE FUNCTION notify_team_on_feedback()
RETURNS TRIGGER AS $$
DECLARE
  appointment_title TEXT;
BEGIN
  -- Sende Notification an Team-Mitglieder wenn Feedback completed wird
  IF NEW.feedback_status = 'completed' AND (OLD.feedback_status IS NULL OR OLD.feedback_status = 'pending') THEN
    -- Hole Appointment-Titel
    SELECT title INTO appointment_title FROM appointments WHERE id = NEW.appointment_id;
    
    -- Erstelle Notifications für alle Team-Mitglieder im gleichen Tenant
    INSERT INTO notifications (user_id, notification_type_id, title, message, data, priority)
    SELECT 
      utm.user_id,
      nt.id,
      'Neues Termin-Feedback',
      'Feedback zu Termin verfügbar: ' || appointment_title,
      jsonb_build_object(
        'appointment_id', NEW.appointment_id,
        'feedback_id', NEW.id,
        'appointment_title', appointment_title
      ),
      'medium'
    FROM user_tenant_memberships utm
    CROSS JOIN notification_types nt
    WHERE utm.tenant_id = NEW.tenant_id
      AND utm.user_id != NEW.user_id
      AND utm.is_active = true
      AND nt.name = 'appointment_reminder'
      AND nt.is_active = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger für Team-Benachrichtigung
CREATE TRIGGER appointment_feedback_notify_team
  AFTER UPDATE OF feedback_status ON appointment_feedback
  FOR EACH ROW
  EXECUTE FUNCTION notify_team_on_feedback();

-- Realtime für appointment_feedback aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE appointment_feedback;