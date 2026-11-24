-- 3) Der individuelle Arbeitsplan (Mo–So) bestimmt das Wochen-Soll und ist
--    damit wie Arbeitszeit und Urlaubsanspruch nur von der Büroleitung änderbar.
CREATE OR REPLACE FUNCTION public.guard_employee_settings_entitlements()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Server-side jobs (no end-user session) and office leaders are allowed.
  IF auth.uid() IS NULL OR public.is_same_tenant_leader(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.annual_vacation_days IS DISTINCT FROM 30
       OR COALESCE(NEW.carry_over_days, 0) <> 0
       OR NEW.carry_over_expires_at IS NOT NULL
       OR NEW.workdays IS DISTINCT FROM ARRAY[true,true,true,true,true,false,false]::boolean[]
       OR (NEW.admin_id IS NOT NULL AND NEW.admin_id <> NEW.user_id) THEN
      RAISE EXCEPTION 'Urlaubsanspruch und Arbeitsplan können nur von der Büroleitung festgelegt werden' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.annual_vacation_days IS DISTINCT FROM OLD.annual_vacation_days
     OR NEW.carry_over_days IS DISTINCT FROM OLD.carry_over_days
     OR NEW.carry_over_expires_at IS DISTINCT FROM OLD.carry_over_expires_at
     OR NEW.hours_per_week IS DISTINCT FROM OLD.hours_per_week
     OR NEW.days_per_week IS DISTINCT FROM OLD.days_per_week
     OR NEW.workdays IS DISTINCT FROM OLD.workdays
     OR NEW.admin_id IS DISTINCT FROM OLD.admin_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Urlaubsanspruch und Arbeitsplan können nur von der Büroleitung geändert werden' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_employee_settings_entitlements() FROM PUBLIC, anon, authenticated;
