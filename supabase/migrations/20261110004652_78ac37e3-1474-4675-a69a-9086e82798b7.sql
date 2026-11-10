-- 1) Checklist defaults: only people who may edit the planning can seed it.
CREATE OR REPLACE FUNCTION public.create_default_checklist_items(planning_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.event_plannings ep
    JOIN public.user_tenant_memberships utm
      ON utm.tenant_id = ep.tenant_id AND utm.user_id = auth.uid() AND utm.is_active = true
    WHERE ep.id = planning_id
      AND (
        ep.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.event_planning_collaborators epc
          WHERE epc.event_planning_id = ep.id AND epc.user_id = auth.uid() AND epc.can_edit = true
        )
      )
  ) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diese Planung' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.event_planning_checklist_items (event_planning_id, title, order_index) VALUES
    (planning_id, 'Social Media geplant', 0),
    (planning_id, 'Begleitung erwünscht', 1),
    (planning_id, 'Information an Kreisverband', 2),
    (planning_id, 'Information an Gemeinderatsfraktion', 3),
    (planning_id, 'Information an Abgeordnete', 4),
    (planning_id, 'Pressemitteilung vorbereitet', 5),
    (planning_id, 'Technik überprüft', 6),
    (planning_id, 'Catering organisiert', 7),
    (planning_id, 'Einladungen verschickt', 8),
    (planning_id, 'Nachbereitung geplant', 9);
END;
$function$;

-- 2) Employees may not change their own entitlement fields; only office leaders can.
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
       OR (NEW.admin_id IS NOT NULL AND NEW.admin_id <> NEW.user_id) THEN
      RAISE EXCEPTION 'Urlaubsanspruch kann nur von der Büroleitung festgelegt werden' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.annual_vacation_days IS DISTINCT FROM OLD.annual_vacation_days
     OR NEW.carry_over_days IS DISTINCT FROM OLD.carry_over_days
     OR NEW.carry_over_expires_at IS DISTINCT FROM OLD.carry_over_expires_at
     OR NEW.hours_per_week IS DISTINCT FROM OLD.hours_per_week
     OR NEW.days_per_week IS DISTINCT FROM OLD.days_per_week
     OR NEW.admin_id IS DISTINCT FROM OLD.admin_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Urlaubsanspruch und Arbeitszeit können nur von der Büroleitung geändert werden' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_employee_settings_entitlements() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_employee_settings_guard_entitlements ON public.employee_settings;
CREATE TRIGGER trg_employee_settings_guard_entitlements
BEFORE INSERT OR UPDATE ON public.employee_settings
FOR EACH ROW EXECUTE FUNCTION public.guard_employee_settings_entitlements();