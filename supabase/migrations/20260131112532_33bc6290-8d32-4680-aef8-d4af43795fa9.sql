-- 1. Uhrzeit-Spalte für Meetings
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS meeting_time TIME;

-- 2. Stern-Markierungen für Termine
CREATE TABLE IF NOT EXISTS starred_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  external_event_id UUID REFERENCES external_events(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(appointment_id, meeting_id, user_id),
  UNIQUE(external_event_id, meeting_id, user_id)
);

ALTER TABLE starred_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their starred appointments"
ON starred_appointments FOR ALL
USING (
  auth.uid() = user_id 
  AND tenant_id = ANY(get_user_tenant_ids(auth.uid()))
)
WITH CHECK (
  auth.uid() = user_id 
  AND tenant_id = ANY(get_user_tenant_ids(auth.uid()))
);

-- Index für Performance
CREATE INDEX IF NOT EXISTS idx_starred_appointments_meeting ON starred_appointments(meeting_id);
CREATE INDEX IF NOT EXISTS idx_starred_appointments_user ON starred_appointments(user_id);