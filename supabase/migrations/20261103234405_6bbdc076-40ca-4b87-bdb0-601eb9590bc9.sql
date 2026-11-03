-- Invalidate approvals made before personal confirmation was enforced.
UPDATE public.gdpr_requests SET status = 'pending', approved_by = NULL, approved_at = NULL WHERE request_type = 'delete' AND status IN ('approved', 'processing');

CREATE OR REPLACE FUNCTION public.gdpr_check_four_eyes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  caller_role text := auth.role();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN
      RAISE EXCEPTION 'Neue Anfragen dürfen keine Freigabe enthalten.';
    END IF;
    IF caller_role IS DISTINCT FROM 'service_role' AND (actor IS NULL OR NEW.requested_by IS DISTINCT FROM actor) THEN
      RAISE EXCEPTION 'Anfragen müssen unter der eigenen Identität erstellt werden.';
    END IF;
    RETURN NEW;
  END IF;

  IF ROW(NEW.tenant_id, NEW.request_type, NEW.requested_by, NEW.subject_contact_id, NEW.subject_email, NEW.subject_name, NEW.reason)
     IS DISTINCT FROM ROW(OLD.tenant_id, OLD.request_type, OLD.requested_by, OLD.subject_contact_id, OLD.subject_email, OLD.subject_name, OLD.reason) THEN
    RAISE EXCEPTION 'Anfragende Person und Gegenstand der Anfrage sind unveränderlich.';
  END IF;

  IF caller_role = 'authenticated' THEN
    IF OLD.request_type <> 'delete' OR OLD.status <> 'pending' OR NEW.status <> 'approved' THEN
      RAISE EXCEPTION 'Nur ausstehende Löschanfragen können persönlich freigegeben werden.';
    END IF;
    IF actor IS NULL OR actor = OLD.requested_by OR NOT public.has_active_tenant_role(actor, OLD.tenant_id, ARRAY['abgeordneter', 'bueroleitung']) THEN
      RAISE EXCEPTION 'Freigabe erfordert eine zweite aktive berechtigte Person desselben Büros.';
    END IF;
    IF NEW.approved_by IS DISTINCT FROM OLD.approved_by AND NEW.approved_by IS DISTINCT FROM actor THEN
      RAISE EXCEPTION 'Eine fremde Zustimmung darf nicht eingetragen werden.';
    END IF;
    IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Der Zustimmungszeitpunkt wird automatisch ermittelt.';
    END IF;
    NEW.approved_by := actor;
    NEW.approved_at := clock_timestamp();
  ELSE
    IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Eine Freigabe erfordert die persönliche Anmeldung der zweiten Person.';
    END IF;
    IF NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Eine persönliche Zustimmung darf nicht nachträglich verändert werden.';
    END IF;
  END IF;

  IF NEW.request_type = 'delete' AND NEW.status IN ('approved', 'processing', 'completed') THEN
    IF NEW.approved_by IS NULL OR NEW.approved_at IS NULL OR NEW.approved_by = NEW.requested_by THEN
      RAISE EXCEPTION 'Persönliche Freigabe einer zweiten Person erforderlich.';
    END IF;
    IF NEW.status = 'processing' AND OLD.status <> 'approved' THEN
      RAISE EXCEPTION 'Nur freigegebene Löschanfragen dürfen verarbeitet werden.';
    END IF;
    IF NEW.status = 'completed' AND OLD.status NOT IN ('processing', 'completed') THEN
      RAISE EXCEPTION 'Nur laufende Löschanfragen dürfen abgeschlossen werden.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE UPDATE ON public.gdpr_requests FROM authenticated;
GRANT UPDATE (status) ON public.gdpr_requests TO authenticated;
GRANT SELECT, INSERT ON public.gdpr_requests TO authenticated;
GRANT ALL ON public.gdpr_requests TO service_role;

ALTER POLICY "Tenant admins create gdpr requests" ON public.gdpr_requests
WITH CHECK (requested_by = auth.uid() AND public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['abgeordneter', 'bueroleitung']));
ALTER POLICY "Tenant admins read gdpr requests" ON public.gdpr_requests
USING (public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['abgeordneter', 'bueroleitung']));
ALTER POLICY "Tenant admins update gdpr requests" ON public.gdpr_requests
USING (public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['abgeordneter', 'bueroleitung']))
WITH CHECK (public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['abgeordneter', 'bueroleitung']));

CREATE OR REPLACE FUNCTION public.approve_gdpr_delete(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Persönliche Anmeldung erforderlich.';
  END IF;
  UPDATE public.gdpr_requests SET status = 'approved'
  WHERE id = p_request_id AND request_type = 'delete' AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anfrage nicht verfügbar oder nicht mehr ausstehend.';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.approve_gdpr_delete(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.approve_gdpr_delete(uuid) TO authenticated;