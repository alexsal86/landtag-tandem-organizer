-- Add added_reason and added_at columns to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS added_reason TEXT,
ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ DEFAULT now();

-- Add comment explaining the possible values
COMMENT ON COLUMN contacts.added_reason IS 'Gründe: Veranstaltung, Empfehlung, Eigeninitiative, Anfrage, Presse, Netzwerk, Import, Sonstiges';

-- Update existing contacts to have added_at = created_at
UPDATE contacts SET added_at = created_at WHERE added_at IS NULL;

-- Create employee_yearly_stats table for vacation/sick day statistics
CREATE TABLE IF NOT EXISTS employee_yearly_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  annual_vacation_days INTEGER NOT NULL DEFAULT 0,
  used_vacation_days INTEGER NOT NULL DEFAULT 0,
  carry_over_days INTEGER NOT NULL DEFAULT 0,
  sick_days_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, year)
);

-- Enable RLS
ALTER TABLE employee_yearly_stats ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own stats
CREATE POLICY "Users can view their own yearly stats" 
ON employee_yearly_stats 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: Admins (abgeordneter, bueroleitung) can view all stats
CREATE POLICY "Leaders can view all yearly stats" 
ON employee_yearly_stats 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('abgeordneter', 'bueroleitung')
  )
);

-- Policy: Leaders can manage stats (for archiving)
CREATE POLICY "Leaders can manage yearly stats" 
ON employee_yearly_stats 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('abgeordneter', 'bueroleitung')
  )
);

-- Function to archive year stats for all employees
CREATE OR REPLACE FUNCTION archive_employee_year_stats(target_year INTEGER)
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER := 0;
  emp RECORD;
BEGIN
  FOR emp IN 
    SELECT 
      es.user_id,
      es.annual_vacation_days,
      es.carry_over_days,
      COALESCE(
        (SELECT SUM(
          CASE 
            WHEN lr.start_date = lr.end_date THEN 1
            ELSE (lr.end_date - lr.start_date) + 1
          END
        )
        FROM leave_requests lr 
        WHERE lr.user_id = es.user_id 
        AND lr.type = 'vacation' 
        AND lr.status = 'approved' 
        AND EXTRACT(YEAR FROM lr.start_date) = target_year
        ), 0
      ) as vacation_used,
      COALESCE(
        (SELECT COUNT(*) 
        FROM sick_days sd 
        WHERE sd.user_id = es.user_id 
        AND EXTRACT(YEAR FROM sd.sick_date) = target_year
        ), 0
      ) as sick_count
    FROM employee_settings es
  LOOP
    INSERT INTO employee_yearly_stats (
      user_id, 
      year, 
      annual_vacation_days, 
      used_vacation_days, 
      carry_over_days, 
      sick_days_count
    )
    VALUES (
      emp.user_id,
      target_year,
      emp.annual_vacation_days,
      emp.vacation_used,
      emp.carry_over_days,
      emp.sick_count
    )
    ON CONFLICT (user_id, year) DO UPDATE SET
      annual_vacation_days = EXCLUDED.annual_vacation_days,
      used_vacation_days = EXCLUDED.used_vacation_days,
      carry_over_days = EXCLUDED.carry_over_days,
      sick_days_count = EXCLUDED.sick_days_count,
      updated_at = now();
    
    archived_count := archived_count + 1;
  END LOOP;
  
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;