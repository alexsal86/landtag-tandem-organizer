-- Create matrix_morning_settings table
CREATE TABLE IF NOT EXISTS public.matrix_morning_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  send_time time NOT NULL DEFAULT '07:00:00',
  include_greeting boolean NOT NULL DEFAULT true,
  include_weather boolean NOT NULL DEFAULT true,
  include_appointments boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on matrix_morning_settings
ALTER TABLE public.matrix_morning_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for matrix_morning_settings
CREATE POLICY "Users can view their own morning settings"
  ON public.matrix_morning_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own morning settings"
  ON public.matrix_morning_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own morning settings"
  ON public.matrix_morning_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own morning settings"
  ON public.matrix_morning_settings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add message_type column to matrix_bot_logs if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matrix_bot_logs' 
                 AND column_name = 'message_type') THEN
    ALTER TABLE public.matrix_bot_logs 
    ADD COLUMN message_type text DEFAULT 'notification';
  END IF;
END $$;

-- Add sent_date column to track daily sends
ALTER TABLE public.matrix_bot_logs 
ADD COLUMN IF NOT EXISTS sent_date date;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_matrix_bot_logs_sent_date 
  ON public.matrix_bot_logs(user_id, message_type, sent_date);

-- Create trigger for updated_at on matrix_morning_settings
CREATE OR REPLACE FUNCTION public.update_matrix_morning_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_matrix_morning_settings_updated_at
  BEFORE UPDATE ON public.matrix_morning_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_matrix_morning_settings_updated_at();

-- Create cron job for morning greetings (runs every hour)
SELECT cron.schedule(
  'matrix-morning-greetings',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://wawofclbehbkebjivdte.supabase.co/functions/v1/send-matrix-morning-greeting',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhd29mY2xiZWhia2Viaml2ZHRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTMxNTEsImV4cCI6MjA2ODY2OTE1MX0.Bc5Jf1Uyvl_i8ooX-IK2kYNJMxpdCT1mKCwfFPVTI50"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);