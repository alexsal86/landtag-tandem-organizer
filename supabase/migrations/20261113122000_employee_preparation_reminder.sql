-- Phase 4. Berlin calendar dates, not 168 elapsed hours (DST-safe).
ALTER TABLE public.employee_meetings ADD COLUMN IF NOT EXISTS preparation_notified_at timestamptz;
CREATE OR REPLACE FUNCTION public.guard_employee_preparation_window()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF NEW.employee_preparation IS DISTINCT FROM OLD.employee_preparation AND NEW.employee_id=auth.uid()
    AND (now() AT TIME ZONE 'Europe/Berlin')::date < (NEW.meeting_date AT TIME ZONE 'Europe/Berlin')::date-7 THEN
    RAISE EXCEPTION 'Die Vorbereitung wird 7 Tage vor dem Termin freigeschaltet' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_employee_preparation_window ON public.employee_meetings;
CREATE TRIGGER guard_employee_preparation_window BEFORE UPDATE ON public.employee_meetings FOR EACH ROW EXECUTE FUNCTION public.guard_employee_preparation_window();
REVOKE ALL ON FUNCTION public.guard_employee_preparation_window() FROM PUBLIC,anon,authenticated;
INSERT INTO public.notification_types(name,label,description,is_active) VALUES
  ('employee_preparation_ready','Gespräch vorbereiten','Vorbereitungsbogen ist freigeschaltet',true) ON CONFLICT(name) DO NOTHING;
CREATE OR REPLACE FUNCTION public.dispatch_employee_preparation_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m record; total integer:=0;
BEGIN
  FOR m IN SELECT * FROM public.employee_meetings WHERE status='scheduled' AND preparation_notified_at IS NULL
    AND (meeting_date AT TIME ZONE 'Europe/Berlin')::date BETWEEN (now() AT TIME ZONE 'Europe/Berlin')::date AND (now() AT TIME ZONE 'Europe/Berlin')::date+7
    FOR UPDATE SKIP LOCKED LOOP
    PERFORM public.create_notification(m.employee_id,'employee_preparation_ready','Gespräch vorbereiten',
      'Ihr Vorbereitungsbogen ist jetzt freigeschaltet. Was lief gut, wo brauchen Sie Unterstützung und was möchten Sie vertiefen?',jsonb_build_object('meeting_id',m.id),'medium');
    UPDATE public.employee_meetings SET preparation_notified_at=now() WHERE id=m.id;
    total:=total+1;
  END LOOP;
  RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_employee_preparation_reminders() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_employee_preparation_reminders() TO service_role;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='employee-preparation-reminders') THEN PERFORM cron.unschedule('employee-preparation-reminders'); END IF;
    PERFORM cron.schedule('employee-preparation-reminders','*/15 * * * *','SELECT public.dispatch_employee_preparation_reminders();');
  END IF;
END $$;
