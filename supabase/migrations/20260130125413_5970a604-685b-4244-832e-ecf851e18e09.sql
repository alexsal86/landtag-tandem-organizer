-- Fix: user_can_access_task_decision function to include visible_to_all check
-- This allows users in the same tenant to view public decisions

CREATE OR REPLACE FUNCTION public.user_can_access_task_decision(_decision_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user created the decision
  IF EXISTS (
    SELECT 1 FROM public.task_decisions 
    WHERE id = _decision_id AND created_by = _user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is a participant
  IF EXISTS (
    SELECT 1 FROM public.task_decision_participants 
    WHERE decision_id = _decision_id AND user_id = _user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user owns the task
  IF EXISTS (
    SELECT 1 FROM public.task_decisions td
    JOIN public.tasks t ON t.id = td.task_id
    WHERE td.id = _decision_id AND t.user_id = _user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- NEW: Check if decision is visible_to_all and user is in same tenant
  IF EXISTS (
    SELECT 1 FROM public.task_decisions td
    JOIN public.user_tenant_memberships utm ON utm.tenant_id = td.tenant_id
    WHERE td.id = _decision_id 
      AND td.visible_to_all = true
      AND utm.user_id = _user_id
      AND utm.is_active = true
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$function$;