-- Function: Reset vacation days
CREATE OR REPLACE FUNCTION execute_reset_vacation_days(p_tenant_id UUID)
RETURNS JSONB AS $$
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
    COALESCE((SELECT COUNT(*) FROM leave_requests lr 
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
  
  -- Calculate remaining vacation and carry over to new year
  UPDATE employee_settings es
  SET carry_over_days = GREATEST(0, 
    es.annual_vacation_days - COALESCE((
      SELECT COUNT(*) FROM leave_requests lr 
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Archive sick days
CREATE OR REPLACE FUNCTION execute_archive_sick_days(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_affected_count INTEGER := 0;
  v_prev_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER - 1;
BEGIN
  -- Update employee_yearly_stats with sick days
  UPDATE employee_yearly_stats eys
  SET sick_days_count = COALESCE((
    SELECT COUNT(*) FROM sick_days sd 
    WHERE sd.user_id = eys.user_id 
    AND EXTRACT(YEAR FROM sd.sick_date) = v_prev_year
  ), 0)::INTEGER,
  updated_at = now()
  WHERE year = v_prev_year
  AND user_id IN (
    SELECT es.user_id FROM employee_settings es
    WHERE es.admin_id IN (
      SELECT user_id FROM user_tenant_memberships 
      WHERE tenant_id = p_tenant_id
    )
  );
  
  GET DIAGNOSTICS v_affected_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'affected_employees', v_affected_count,
    'archived_year', v_prev_year,
    'message', 'Krankentage wurden archiviert'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Expire carry over days
CREATE OR REPLACE FUNCTION execute_expire_carry_over(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_affected_count INTEGER := 0;
BEGIN
  UPDATE employee_settings es
  SET carry_over_days = 0,
      updated_at = now()
  WHERE carry_over_days > 0
  AND es.admin_id IN (
    SELECT user_id FROM user_tenant_memberships 
    WHERE tenant_id = p_tenant_id
  );
  
  GET DIAGNOSTICS v_affected_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'affected_employees', v_affected_count,
    'message', 'Resturlaub ist verfallen'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;