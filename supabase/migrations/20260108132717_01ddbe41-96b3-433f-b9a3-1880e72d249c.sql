-- Fix vacation day calculation: use SUM of days instead of COUNT
CREATE OR REPLACE FUNCTION execute_reset_vacation_days(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected_count INTEGER := 0;
  v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_prev_year INTEGER := v_year - 1;
BEGIN
  -- Archive current stats to employee_yearly_stats
  INSERT INTO employee_yearly_stats (user_id, year, annual_vacation_days, used_vacation_days, carry_over_days, sick_days_count)
  SELECT 
    es.user_id,
    v_prev_year,
    es.annual_vacation_days,
    COALESCE((SELECT SUM((lr.end_date - lr.start_date + 1)::INTEGER) FROM leave_requests lr 
              WHERE lr.user_id = es.user_id 
              AND lr.type = 'vacation' 
              AND lr.status = 'approved' 
              AND EXTRACT(YEAR FROM lr.start_date) = v_prev_year), 0)::INTEGER,
    es.carry_over_days,
    COALESCE((SELECT COUNT(*) FROM sick_days sd 
              WHERE sd.user_id = es.user_id 
              AND EXTRACT(YEAR FROM sd.sick_date) = v_prev_year), 0)::INTEGER
  FROM employee_settings es
  WHERE es.admin_id IN (
    SELECT user_id FROM user_tenant_memberships 
    WHERE tenant_id = p_tenant_id AND is_active = true
  )
  ON CONFLICT (user_id, year) DO UPDATE SET
    used_vacation_days = EXCLUDED.used_vacation_days,
    sick_days_count = EXCLUDED.sick_days_count,
    updated_at = now();
    
  GET DIAGNOSTICS v_affected_count = ROW_COUNT;
  
  -- Calculate remaining vacation and carry over to new year (using correct day count)
  UPDATE employee_settings es
  SET carry_over_days = GREATEST(0, 
    es.annual_vacation_days - COALESCE((
      SELECT SUM((lr.end_date - lr.start_date + 1)::INTEGER) FROM leave_requests lr 
      WHERE lr.user_id = es.user_id 
      AND lr.type = 'vacation' 
      AND lr.status = 'approved' 
      AND EXTRACT(YEAR FROM lr.start_date) = v_prev_year
    ), 0)::INTEGER
  ),
  updated_at = now()
  WHERE es.admin_id IN (
    SELECT user_id FROM user_tenant_memberships 
    WHERE tenant_id = p_tenant_id
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'affected_employees', v_affected_count,
    'archived_year', v_prev_year,
    'new_year', v_year,
    'message', 'Urlaubstage wurden zurückgesetzt und archiviert'
  );
END;
$$;

-- Also create a function to generate current year stats
CREATE OR REPLACE FUNCTION generate_current_year_stats(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected_count INTEGER := 0;
  v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
BEGIN
  -- Create stats for current year if they don't exist
  INSERT INTO employee_yearly_stats (user_id, year, annual_vacation_days, used_vacation_days, carry_over_days, sick_days_count)
  SELECT 
    es.user_id,
    v_year,
    es.annual_vacation_days,
    COALESCE((SELECT SUM((lr.end_date - lr.start_date + 1)::INTEGER) FROM leave_requests lr 
              WHERE lr.user_id = es.user_id 
              AND lr.type = 'vacation' 
              AND lr.status = 'approved' 
              AND EXTRACT(YEAR FROM lr.start_date) = v_year), 0)::INTEGER,
    es.carry_over_days,
    COALESCE((SELECT COUNT(*) FROM sick_days sd 
              WHERE sd.user_id = es.user_id 
              AND EXTRACT(YEAR FROM sd.sick_date) = v_year), 0)::INTEGER
  FROM employee_settings es
  WHERE es.admin_id IN (
    SELECT user_id FROM user_tenant_memberships 
    WHERE tenant_id = p_tenant_id AND is_active = true
  )
  ON CONFLICT (user_id, year) DO UPDATE SET
    annual_vacation_days = EXCLUDED.annual_vacation_days,
    used_vacation_days = EXCLUDED.used_vacation_days,
    carry_over_days = EXCLUDED.carry_over_days,
    sick_days_count = EXCLUDED.sick_days_count,
    updated_at = now();
    
  GET DIAGNOSTICS v_affected_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'affected_employees', v_affected_count,
    'year', v_year,
    'message', 'Jahresstatistik wurde erstellt'
  );
END;
$$;