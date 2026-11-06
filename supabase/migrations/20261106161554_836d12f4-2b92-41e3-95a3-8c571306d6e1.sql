CREATE OR REPLACE FUNCTION public.appointment_requests_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.channel NOT IN ('email','post','phone','in_person','case','other') THEN RAISE EXCEPTION 'invalid channel'; END IF;
  IF NEW.recommendation IS NOT NULL AND NEW.recommendation NOT IN ('accept','decline','delegate','question') THEN RAISE EXCEPTION 'invalid recommendation'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.decided_by IS DISTINCT FROM OLD.decided_by
       OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      IF current_setting('app.request_decision', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'Entscheidungen nur über decide_appointment_request';
      END IF;
    END IF;
    IF NEW.recommendation IS DISTINCT FROM OLD.recommendation THEN NEW.recommended_by := auth.uid(); END IF;
  END IF;
  RETURN NEW;
END $$;