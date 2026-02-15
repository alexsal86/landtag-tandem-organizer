
-- Fix app_settings UNIQUE constraint to include tenant_id
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_setting_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_tenant_setting_key ON public.app_settings (tenant_id, setting_key);

-- Add RSVP tracking columns
ALTER TABLE public.event_rsvps 
  ADD COLUMN IF NOT EXISTS invitation_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes_sent jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_message text;

-- Update existing RSVPs that already have invited_at to mark as sent
UPDATE public.event_rsvps SET invitation_sent = true WHERE invited_at IS NOT NULL;
