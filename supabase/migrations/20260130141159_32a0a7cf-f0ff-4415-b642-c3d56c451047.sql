-- Create time_entry_corrections table for admin to adjust overtime/balances
CREATE TABLE IF NOT EXISTS public.time_entry_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  correction_date date NOT NULL DEFAULT CURRENT_DATE,
  correction_minutes integer NOT NULL, -- positive = add hours, negative = subtract hours
  reason text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE time_entry_corrections ENABLE ROW LEVEL SECURITY;

-- Admins can manage all corrections (using existing is_admin function)
CREATE POLICY "Admins can manage corrections" ON time_entry_corrections
  FOR ALL USING (public.is_admin(auth.uid()));

-- Users can view their own corrections
CREATE POLICY "Users can view own corrections" ON time_entry_corrections
  FOR SELECT USING (user_id = auth.uid());

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_time_entry_corrections_user_id ON time_entry_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entry_corrections_created_by ON time_entry_corrections(created_by);