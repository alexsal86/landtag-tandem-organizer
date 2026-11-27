-- Selbsttest „Freigabe nur über den Workflow“ (release-guard) erwartet beim
-- vorzeitigen Wiederöffnen 22023 und bei der direkten Statusänderung 42501.
--
-- Die Wiedereröffnung wies ein noch nicht abgeschlossenes Gespräch mit dem
-- Standardcode P0001 ab. Den passenden Code (22023) setzt erst
-- 20261126180000_protocol_error_code_and_matrix_timeline.sql – im selben Lauf,
-- in dem sie die Zuständigkeits-Matrix umbaut. Solange dieser Nachtrag nicht
-- eingespielt ist, bleibt es beim alten Code, und der Selbsttest sieht P0001
-- statt 22023. Diese Migration setzt ausschließlich den Fehlercode der
-- Wiedereröffnung und hängt an keiner anderen Änderung.
--
-- Zusätzlich wird die Schreibgrenze erneut zugesichert: die Tabelle bleibt für
-- Clients lesbar, UPDATE entzogen, und der Schutztrigger ist vorhanden. Ein
-- versehentlich wieder erteiltes UPDATE oder ein verlorener Trigger würde die
-- direkte Statusänderung stillschweigend durchlassen, statt sie mit 42501
-- abzuweisen.

-- DROP + CREATE statt CREATE OR REPLACE: eine abweichende Signatur auf der
-- Instanz (etwa andere Parameternamen) würde das Ersetzen sonst blockieren.
DROP FUNCTION IF EXISTS public.reopen_meeting_protocol(uuid,text);

CREATE FUNCTION public.reopen_meeting_protocol(p_meeting_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.employee_meetings;
BEGIN
  m:=public.require_employee_meeting_access(p_meeting_id,true);
  IF nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Bitte einen Grund angeben' USING ERRCODE='22023'; END IF;
  IF m.status NOT IN ('completed','pending_acknowledgement','acknowledged') THEN RAISE EXCEPTION 'Gespräch ist nicht abgeschlossen' USING ERRCODE='22023'; END IF;
  INSERT INTO public.employee_meeting_audit(meeting_id,actor,action,reason,protocol_hash) VALUES(m.id,auth.uid(),'reopened',btrim(p_reason),m.protocol_hash);
  UPDATE public.employee_meetings SET status='in_progress',acknowledged_at=NULL,acknowledged_by=NULL,protocol_hash=NULL,
    acknowledgement_requested_at=NULL,acknowledgement_comment=NULL WHERE id=m.id;
  PERFORM public.create_notification(m.employee_id,'employee_protocol_response','Protokoll wieder geöffnet',btrim(p_reason),jsonb_build_object('meeting_id',m.id),'medium');
END $$;

REVOKE ALL ON FUNCTION public.reopen_meeting_protocol(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reopen_meeting_protocol(uuid,text) TO authenticated;

-- Geschrieben wird ausschließlich über die Workflow-RPCs.
REVOKE UPDATE ON public.employee_meetings FROM authenticated,anon;

DO $$
BEGIN
  IF to_regprocedure('public.guard_employee_protocol()') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger
       WHERE tgrelid='public.employee_meetings'::regclass
         AND tgname='guard_employee_protocol'
         AND NOT tgisinternal
     ) THEN
    CREATE TRIGGER guard_employee_protocol BEFORE INSERT OR UPDATE OR DELETE ON public.employee_meetings
      FOR EACH ROW EXECUTE FUNCTION public.guard_employee_protocol();
  END IF;
END $$;
