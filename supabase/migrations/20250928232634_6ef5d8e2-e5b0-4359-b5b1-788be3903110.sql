-- Matrix-Entscheidungsversand tracking
CREATE TABLE decision_matrix_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES task_decisions(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES task_decision_participants(id) ON DELETE CASCADE,
  matrix_room_id TEXT NOT NULL,
  matrix_event_id TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  responded_via_matrix BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE decision_matrix_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for decision_matrix_messages
CREATE POLICY "Users can view their own matrix decision messages"
ON decision_matrix_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM task_decisions td
    WHERE td.id = decision_matrix_messages.decision_id 
    AND td.created_by = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM task_decision_participants tdp
    WHERE tdp.id = decision_matrix_messages.participant_id 
    AND tdp.user_id = auth.uid()
  )
);

CREATE POLICY "System can manage decision matrix messages"
ON decision_matrix_messages FOR ALL
USING (
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
);

-- Matrix subscription categories erweitern (add decision_requests category)
-- Insert new subscription category if not exists
INSERT INTO app_settings (setting_key, setting_value)
VALUES ('matrix_subscription_categories', 'general,notifications,decision_requests')
ON CONFLICT (setting_key) DO UPDATE SET 
  setting_value = 'general,notifications,decision_requests';

-- Add matrix settings to existing users who don't have them
INSERT INTO app_settings (setting_key, setting_value)
VALUES ('matrix_decision_integration_enabled', 'true')
ON CONFLICT (setting_key) DO UPDATE SET 
  setting_value = 'true';