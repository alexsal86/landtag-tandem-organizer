-- Drop existing function if exists and recreate with carry_over calculation
DROP FUNCTION IF EXISTS generate_yearly_stats_for_year(UUID, INTEGER);

CREATE OR REPLACE FUNCTION generate_yearly_stats_for_year(
  p_tenant_id UUID,
  p_year INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_affected INTEGER := 0;
  v_start_date DATE;
  v_end_date DATE;
  v_carry_over_updated INTEGER := 0;
BEGIN
  v_start_date := make_date(p_year, 1, 1);
  v_end_date := make_date(p_year, 12, 31);
  
  -- Get all users from the tenant
  WITH tenant_users AS (
    SELECT utm.user_id
    FROM user_tenant_memberships utm
    WHERE utm.tenant_id = p_tenant_id 
      AND utm.is_active = true
  ),
  employee_data AS (
    SELECT 
      es.user_id,
      es.annual_vacation_days,
      -- Calculate used vacation days from leave_requests
      COALESCE((
        SELECT SUM(
          CASE 
            WHEN lr.end_date IS NULL THEN 1
            ELSE GREATEST(1, (lr.end_date::date - lr.start_date::date + 1))
          END
        )
        FROM leave_requests lr
        WHERE lr.user_id = es.user_id
          AND lr.type = 'vacation'
          AND lr.status = 'approved'
          AND lr.start_date::date >= v_start_date
          AND lr.start_date::date <= v_end_date
      ), 0)::INTEGER AS used_vacation,
      -- Count sick days
      COALESCE((
        SELECT COUNT(*)
        FROM sick_days sd
        WHERE sd.user_id = es.user_id
          AND sd.sick_date >= v_start_date
          AND sd.sick_date <= v_end_date
      ), 0)::INTEGER AS sick_count
    FROM employee_settings es
    WHERE es.user_id IN (SELECT user_id FROM tenant_users)
  )
  INSERT INTO employee_yearly_stats (
    user_id, 
    year, 
    annual_vacation_days, 
    used_vacation_days, 
    carry_over_days, 
    sick_days_count
  )
  SELECT 
    ed.user_id,
    p_year,
    ed.annual_vacation_days,
    ed.used_vacation,
    0, -- carry_over will be calculated separately for next year
    ed.sick_count
  FROM employee_data ed
  ON CONFLICT (user_id, year) DO UPDATE SET
    annual_vacation_days = EXCLUDED.annual_vacation_days,
    used_vacation_days = EXCLUDED.used_vacation_days,
    sick_days_count = EXCLUDED.sick_days_count,
    updated_at = now();
    
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  
  -- Now update carry_over_days in employee_settings for the NEXT year
  -- This is the remaining vacation from p_year that carries over
  UPDATE employee_settings es
  SET carry_over_days = GREATEST(0, eys.annual_vacation_days - eys.used_vacation_days)
  FROM employee_yearly_stats eys
  WHERE eys.user_id = es.user_id
    AND eys.year = p_year
    AND es.user_id IN (
      SELECT user_id FROM user_tenant_memberships 
      WHERE tenant_id = p_tenant_id AND is_active = true
    );
    
  GET DIAGNOSTICS v_carry_over_updated = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'year', p_year,
    'affected_employees', v_affected,
    'carry_over_updated', v_carry_over_updated
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;