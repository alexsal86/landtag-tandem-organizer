
-- 1. Add processing_statuses array column to case_files
ALTER TABLE public.case_files ADD COLUMN IF NOT EXISTS processing_statuses text[] DEFAULT '{}';

-- Migrate existing single status to array
UPDATE public.case_files 
SET processing_statuses = ARRAY[processing_status] 
WHERE processing_status IS NOT NULL AND processing_status != '' 
AND (processing_statuses IS NULL OR processing_statuses = '{}');

-- 2. Create user_sessions table
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_info text,
  ip_address text,
  last_active_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  is_current boolean DEFAULT false
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
ON public.user_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
ON public.user_sessions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
ON public.user_sessions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
ON public.user_sessions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
