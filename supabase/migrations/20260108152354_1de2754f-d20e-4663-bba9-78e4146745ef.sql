-- Function to generate yearly stats for a specific year (retroactive)
CREATE OR REPLACE FUNCTION public.generate_yearly_stats_for_year(
  p_tenant_id UUID,
  p_year INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected INTEGER := 0;
  v_start_date DATE;
  v_end_date DATE;
  v_employee RECORD;
  v_vacation_days INTEGER;
  v_sick_days INTEGER;
  v_carry_over INTEGER;
BEGIN
  v_start_date := make_date(p_year, 1, 1);
  v_end_date := make_date(p_year, 12, 31);
  
  -- Get all employees for this tenant
  FOR v_employee IN
    SELECT es.user_id, es.annual_vacation_days, es.carry_over_days,
           p.display_name
    FROM employee_settings es
    JOIN profiles p ON p.user_id = es.user_id
    WHERE es.admin_id IN (
      SELECT user_id FROM user_tenant_memberships
      WHERE tenant_id = p_tenant_id AND is_active = true
    )
  LOOP
    -- Calculate vacation days used (sum of actual days, not just count)
    SELECT COALESCE(SUM(
      CASE 
        WHEN lr.end_date IS NULL THEN 1
        ELSE (lr.end_date - lr.start_date + 1)::INTEGER
      END
    ), 0)
    INTO v_vacation_days
    FROM leave_requests lr
    WHERE lr.user_id = v_employee.user_id
      AND lr.type = 'vacation'
      AND lr.status = 'approved'
      AND lr.start_date >= v_start_date
      AND lr.start_date <= v_end_date;
    
    -- Calculate sick days
    SELECT COALESCE(COUNT(*), 0)
    INTO v_sick_days
    FROM sick_days sd
    WHERE sd.user_id = v_employee.user_id
      AND sd.sick_date >= v_start_date
      AND sd.sick_date <= v_end_date;
    
    -- Get carry over from settings or previous year stats
    v_carry_over := COALESCE(v_employee.carry_over_days, 0);
    
    -- Insert or update stats
    INSERT INTO employee_yearly_stats (
      user_id, year, annual_vacation_days, used_vacation_days, 
      carry_over_days, sick_days_count
    )
    VALUES (
      v_employee.user_id,
      p_year,
      v_employee.annual_vacation_days,
      v_vacation_days,
      v_carry_over,
      v_sick_days
    )
    ON CONFLICT (user_id, year) DO UPDATE SET
      annual_vacation_days = EXCLUDED.annual_vacation_days,
      used_vacation_days = EXCLUDED.used_vacation_days,
      carry_over_days = EXCLUDED.carry_over_days,
      sick_days_count = EXCLUDED.sick_days_count,
      updated_at = now();
    
    v_affected := v_affected + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'year', p_year,
    'affected_employees', v_affected
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.generate_yearly_stats_for_year(UUID, INTEGER) TO authenticated;