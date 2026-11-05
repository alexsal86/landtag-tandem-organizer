CREATE TABLE public.appointment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  requester text,
  channel text NOT NULL DEFAULT 'email',
  requested_date date NOT NULL,
  requested_time time,
  duration_minutes integer NOT NULL DEFAULT 60,
  location text,
  response_deadline date,
  notes text,
  recommendation text,
  recommendation_note text,
  recommended_by uuid,
  status text NOT NULL DEFAULT 'open',
  decided_by uuid,
  decided_at timestamptz,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_requests TO authenticated;
GRANT ALL ON public.appointment_requests TO service_role;
ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX appointment_requests_tenant_status_idx ON public.appointment_requests(tenant_id, status, requested_date);

CREATE POLICY "Tenant members view requests" ON public.appointment_requests FOR SELECT TO authenticated
  USING (tenant_id = ANY (public.get_user_tenant_ids(auth.uid())));
CREATE POLICY "Tenant members create requests" ON public.appointment_requests FOR INSERT TO authenticated
  WITH CHECK (tenant_id = ANY (public.get_user_tenant_ids(auth.uid())) AND created_by = auth.uid() AND status = 'open');
CREATE POLICY "Tenant members update open requests" ON public.appointment_requests FOR UPDATE TO authenticated
  USING (tenant_id = ANY (public.get_user_tenant_ids(auth.uid())) AND status = 'open')
  WITH CHECK (tenant_id = ANY (public.get_user_tenant_ids(auth.uid())) AND status = 'open');
CREATE POLICY "Creator or leads delete requests" ON public.appointment_requests FOR DELETE TO authenticated
  USING (tenant_id = ANY (public.get_user_tenant_ids(auth.uid())) AND (created_by = auth.uid()
    OR public.has_active_tenant_role(auth.uid(), tenant_id, ARRAY['abgeordneter','bueroleitung'])));

CREATE OR REPLACE FUNCTION public.appointment_requests_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.channel NOT IN ('email','post','phone','in_person','other') THEN RAISE EXCEPTION 'invalid channel'; END IF;
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
CREATE TRIGGER appointment_requests_guard BEFORE INSERT OR UPDATE ON public.appointment_requests
  FOR EACH ROW EXECUTE FUNCTION public.appointment_requests_guard();

CREATE OR REPLACE FUNCTION public.decide_appointment_request(_request_id uuid, _decision text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.appointment_requests; v_start timestamptz; v_appt uuid;
BEGIN
  IF _decision NOT IN ('accepted','declined') THEN RAISE EXCEPTION 'invalid decision'; END IF;
  SELECT * INTO r FROM public.appointment_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF r.status <> 'open' THEN RAISE EXCEPTION 'Anfrage wurde bereits entschieden'; END IF;
  IF NOT public.has_active_tenant_role(auth.uid(), r.tenant_id, ARRAY['abgeordneter','bueroleitung']) THEN
    RAISE EXCEPTION 'Nur Abgeordnete oder Büroleitung dürfen entscheiden';
  END IF;
  PERFORM set_config('app.request_decision', 'on', true);
  IF _decision = 'accepted' THEN
    v_start := ((r.requested_date + COALESCE(r.requested_time, time '09:00')) AT TIME ZONE 'Europe/Berlin');
    INSERT INTO public.appointments(user_id, tenant_id, title, description, start_time, end_time, location, is_all_day, status)
    VALUES (auth.uid(), r.tenant_id, r.title,
      concat_ws(E'\n', CASE WHEN r.requester IS NOT NULL THEN 'Anfrage von: ' || r.requester END, r.notes),
      v_start, v_start + make_interval(mins => r.duration_minutes), r.location, r.requested_time IS NULL, 'planned')
    RETURNING id INTO v_appt;
  END IF;
  UPDATE public.appointment_requests SET status = _decision, decided_by = auth.uid(), decided_at = now(), appointment_id = v_appt
  WHERE id = _request_id;
  PERFORM set_config('app.request_decision', 'off', true);
  RETURN v_appt;
END $$;
REVOKE ALL ON FUNCTION public.decide_appointment_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_appointment_request(uuid, text) TO authenticated;