-- DSGVO-Anträge im Audit-Trail: Anlegen und Zurückziehen.
--
-- Freigabe und Ausführung protokollieren bereits approve_gdpr_delete und
-- gdpr-process. Anlegen und Zurückziehen (DELETE des eigenen ausstehenden
-- Antrags) hatten bisher kein Ereignis – der Filter „DSGVO“ hätte sie deshalb
-- nie zeigen können, obwohl seine Bezeichnung sie verspricht.
--
-- Der Eintrag enthält bewusst keine Personendaten des Antrags (keine E-Mail,
-- kein Name, kein Kontaktbezug): Für die Nachvollziehbarkeit genügen Antrags-ID,
-- Art, Status und Beteiligte.
--
-- tenant_id wird über eine Unterabfrage aufgelöst. Existiert das Büro nicht mehr,
-- bleibt der Eintrag mandantenfrei, statt am Fremdschlüssel von
-- audit_log_entries zu scheitern und das Löschen des Antrags zu blockieren.
CREATE OR REPLACE FUNCTION public.audit_gdpr_request_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.gdpr_requests;
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_row := NEW;
    v_action := 'security.gdpr.request_created';
  ELSIF TG_OP = 'DELETE' THEN
    v_row := OLD;
    v_action := 'security.gdpr.request_withdrawn';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_log_entries (tenant_id, user_id, action, payload)
  VALUES (
    (SELECT t.id FROM public.tenants t WHERE t.id = v_row.tenant_id),
    coalesce(auth.uid(), v_row.requested_by),
    v_action,
    jsonb_build_object(
      'action', v_action,
      'request_id', v_row.id,
      'request_type', v_row.request_type,
      'status', v_row.status,
      'requested_by', v_row.requested_by,
      'approved_by', v_row.approved_by,
      'timestamp', now()
    )
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_gdpr_request_changes ON public.gdpr_requests;
CREATE TRIGGER trg_audit_gdpr_request_changes
  AFTER INSERT OR DELETE ON public.gdpr_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_gdpr_request_changes();
