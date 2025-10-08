-- Add reply_to and scheduled_at columns to email_logs
ALTER TABLE email_logs 
ADD COLUMN IF NOT EXISTS reply_to TEXT,
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Create scheduled_emails table for better control over scheduled sending
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  reply_to TEXT,
  sender_id UUID REFERENCES sender_information(id),
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  cc JSONB,
  bcc JSONB,
  contact_ids JSONB,
  distribution_list_ids JSONB,
  document_ids JSONB,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage scheduled emails in their tenant
CREATE POLICY "Users can manage scheduled emails in their tenant"
ON scheduled_emails
FOR ALL
USING (tenant_id IN (SELECT tenant_id FROM user_tenant_memberships WHERE user_id = auth.uid()))
WITH CHECK (tenant_id IN (SELECT tenant_id FROM user_tenant_memberships WHERE user_id = auth.uid()));

-- Index for scheduled emails lookup
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status_time 
ON scheduled_emails(status, scheduled_for) 
WHERE status = 'scheduled';