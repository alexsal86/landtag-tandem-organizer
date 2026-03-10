-- Ensure foreign keys referencing employee_meetings.id use safe delete behavior
ALTER TABLE public.employee_meeting_action_items
  DROP CONSTRAINT IF EXISTS employee_meeting_action_items_meeting_id_fkey,
  ADD CONSTRAINT employee_meeting_action_items_meeting_id_fkey
    FOREIGN KEY (meeting_id)
    REFERENCES public.employee_meetings(id)
    ON DELETE CASCADE;

ALTER TABLE public.employee_meeting_requests
  DROP CONSTRAINT IF EXISTS employee_meeting_requests_scheduled_meeting_id_fkey,
  ADD CONSTRAINT employee_meeting_requests_scheduled_meeting_id_fkey
    FOREIGN KEY (scheduled_meeting_id)
    REFERENCES public.employee_meetings(id)
    ON DELETE SET NULL;

-- Transactional delete flow for employee meetings.
-- Deletes the meeting row in one statement/transaction.
-- Related rows are handled by FK actions:
--   * employee_meeting_action_items.meeting_id -> ON DELETE CASCADE
--   * employee_meeting_requests.scheduled_meeting_id -> ON DELETE SET NULL
CREATE OR REPLACE FUNCTION public.delete_employee_meeting(p_meeting_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id
  INTO v_tenant_id
  FROM public.employee_meetings
  WHERE id = p_meeting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee meeting % does not exist', p_meeting_id
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT (v_tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'Not authorized to delete employee meeting %', p_meeting_id
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.employee_meetings
  WHERE id = p_meeting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee meeting % could not be deleted', p_meeting_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_employee_meeting(uuid) TO authenticated;
