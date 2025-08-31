-- Create letter archive settings table
CREATE TABLE IF NOT EXISTS letter_archive_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  auto_archive_days integer NOT NULL DEFAULT 30,
  show_sent_letters boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- Enable RLS
ALTER TABLE letter_archive_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own archive settings"
ON letter_archive_settings
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_letter_archive_settings_updated_at
  BEFORE UPDATE ON letter_archive_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();