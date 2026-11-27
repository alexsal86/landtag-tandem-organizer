-- Audit-Schreibpfad: echte action-Spalte, Mandantenzuordnung an allen Schreibpfaden
-- und Ereignisse für DSGVO-Freigaben sowie verweigerte Zugriffe.
--
-- Bisher lag die Aktion nur in payload->>'action'. Der Audit-Trail konnte deshalb
-- nicht nach Ereignisart filtern, und mehrere Schreibpfade (Edge Function, generischer
-- Trigger, Rollen-Trigger) schrieben ohne tenant_id. Solche Zeilen waren für
-- Büro-Admins unsichtbar, weil die SELECT-Policy tenant_id IS NOT NULL verlangt.

-- 1) action-Spalte -----------------------------------------------------------------
ALTER TABLE public.audit_log_entries ADD COLUMN IF NOT EXISTS action text;

-- Bestehende Zeilen tragen die Aktion in payload->>'action'.
UPDATE public.audit_log_entries
   SET action = coalesce(nullif(btrim(payload->>'action'), ''), 'unknown')
 WHERE action IS NULL;

ALTER TABLE public.audit_log_entries ALTER COLUMN action SET DEFAULT 'unknown';
ALTER TABLE public.audit_log_entries ALTER COLUMN action SET NOT NULL;

-- Formatgrenze für neue Zeilen. NOT VALID, damit vorhandene Sonderfälle den Lauf
-- nicht abbrechen; neue Einträge werden geprüft.
ALTER TABLE public.audit_log_entries
  DROP CONSTRAINT IF EXISTS audit_log_entries_action_format;
ALTER TABLE public.audit_log_entries
  ADD CONSTRAINT audit_log_entries_action_format
  CHECK (action ~ '^[A-Za-z0-9_.:-]{1,80}$') NOT VALID;

-- Filter des Audit-Trails: Büro + Ereignisart + Zeit.
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_action_created
  ON public.audit_log_entries (tenant_id, action, created_at DESC);

-- 2) Schreibpfade, die action nicht explizit setzen ---------------------------------
-- Die Aktion bleibt aus dem Payload nachgezogen, damit ältere Aufrufer weiter
-- funktionieren und die Spalte nie leer ist.
CREATE OR REPLACE FUNCTION public.audit_entry_default_action()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.action IS NULL OR btrim(NEW.action) = '' THEN
    NEW.action := coalesce(nullif(btrim(NEW.payload->>'action'), ''), 'unknown');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_entry_default_action ON public.audit_log_entries;
CREATE TRIGGER trg_audit_entry_default_action
  BEFORE INSERT ON public.audit_log_entries
  FOR EACH ROW EXECUTE FUNCTION public.audit_entry_default_action();

-- 3) Generischer Tabellen-Trigger: Aktion und Mandant aus der Zeile -----------------
-- Der Trigger ist generisch (TG_TABLE_NAME), deshalb wird tenant_id über to_jsonb
-- gelesen; Tabellen ohne tenant_id bleiben bei NULL.
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text := TG_TABLE_NAME || '.' || lower(TG_OP);
  v_new jsonb;
  v_old jsonb;
  v_tenant uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old := to_jsonb(OLD);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_new := to_jsonb(NEW);
  END IF;

  BEGIN
    v_tenant := nullif(coalesce(v_new->>'tenant_id', v_old->>'tenant_id'), '')::uuid;
  EXCEPTION WHEN others THEN
    v_tenant := NULL;
  END;

  INSERT INTO public.audit_log_entries (tenant_id, user_id, action, payload)
  VALUES (
    v_tenant,
    auth.uid(),
    v_action,
    jsonb_build_object(
      'action', v_action,
      'operation', TG_OP,
      'table', TG_TABLE_NAME,
      'timestamp', now()
    )
    || CASE WHEN v_old IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('old_data', v_old) END
    || CASE WHEN v_new IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('new_data', v_new) END
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Rollen-Trigger: eine Zeile je Büro der betroffenen Person ----------------------
-- user_roles ist plattformweit und hat keine tenant_id. Die Zuordnung entsteht über
-- die aktiven Mitgliedschaften der betroffenen Person, damit Büro-Admins die
-- Rechteänderung in ihrem eigenen Audit-Trail sehen.
CREATE OR REPLACE FUNCTION public.audit_user_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_action text;
  v_name text;
  v_payload jsonb;
  v_tenants uuid[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.user_id;
    v_action := 'user.role_removed';
    v_payload := jsonb_build_object('affected_user_id', OLD.user_id, 'role', OLD.role);
  ELSIF TG_OP = 'INSERT' THEN
    v_user := NEW.user_id;
    v_action := 'user.role_assigned';
    v_payload := jsonb_build_object('affected_user_id', NEW.user_id, 'role', NEW.role);
  ELSE
    IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
      RETURN NEW;
    END IF;
    v_user := NEW.user_id;
    v_action := 'user.role_changed';
    v_payload := jsonb_build_object('affected_user_id', NEW.user_id, 'old_role', OLD.role, 'new_role', NEW.role);
  END IF;

  SELECT p.display_name INTO v_name
  FROM public.profiles p
  WHERE p.user_id = v_user
  LIMIT 1;

  SELECT array_agg(m.tenant_id) INTO v_tenants
  FROM public.user_tenant_memberships m
  WHERE m.user_id = v_user AND m.is_active;

  v_payload := v_payload || jsonb_build_object(
    'action', v_action,
    'affected_user_name', v_name,
    'timestamp', now()
  );

  IF v_tenants IS NULL OR cardinality(v_tenants) = 0 THEN
    INSERT INTO public.audit_log_entries (tenant_id, user_id, action, payload)
    VALUES (NULL, auth.uid(), v_action, v_payload);
  ELSE
    INSERT INTO public.audit_log_entries (tenant_id, user_id, action, payload)
    SELECT t.tenant_id, auth.uid(), v_action, v_payload
    FROM unnest(v_tenants) AS t(tenant_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Client-IP für Ereignisse aus RPC-Pfaden ---------------------------------------
-- PostgREST stellt die Kopfzeilen als GUC bereit. Fehlt sie, bleibt die IP leer;
-- der Fehler darf das Ereignis nie verhindern.
CREATE OR REPLACE FUNCTION public.audit_request_ip()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_headers text;
BEGIN
  v_headers := current_setting('request.headers', true);
  IF v_headers IS NULL OR v_headers = '' THEN
    RETURN NULL;
  END IF;
  RETURN nullif(btrim(split_part(coalesce((v_headers::jsonb)->>'x-forwarded-for', ''), ',', 1)), '');
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_request_ip() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_request_ip() TO authenticated;

-- 6) Ein Schreibpfad für Sicherheitsereignisse aus dem Browser ----------------------
-- Der Client kann einen verweigerten Zugriff (42501) nur nach der Ablehnung melden;
-- ein Ereignis im abgebrochenen Statement selbst wird mit der Transaktion zurück-
-- gerollt. Diese Funktion schreibt deshalb die clientseitig beobachtete Ablehnung –
-- strikt begrenzt: nur security.*-Aktionen, nur das eigene Büro, nur eigene
-- Urheberschaft, begrenzte Detailgröße.
CREATE OR REPLACE FUNCTION public.record_audit_entry(
  _action text,
  _tenant_id uuid DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_details jsonb;
  v_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Anmeldung erforderlich.' USING ERRCODE = '42501';
  END IF;

  IF _action IS NULL OR _action !~ '^security\.[a-z0-9_]+(\.[a-z0-9_]+){0,3}$' THEN
    RAISE EXCEPTION 'Unbekanntes Sicherheitsereignis.' USING ERRCODE = '22023';
  END IF;

  IF _tenant_id IS NULL THEN
    IF _action NOT LIKE 'security.auth.%' THEN
      RAISE EXCEPTION 'Sicherheitsereignis ohne Büro ist nur für Anmeldeereignisse zulässig.'
        USING ERRCODE = '22023';
    END IF;
  ELSIF NOT coalesce(public.is_superadmin(v_actor), false)
        AND NOT EXISTS (
          SELECT 1 FROM public.user_tenant_memberships m
          WHERE m.user_id = v_actor AND m.tenant_id = _tenant_id AND m.is_active
        ) THEN
    RAISE EXCEPTION 'Kein Zugriff auf dieses Büro.' USING ERRCODE = '42501';
  END IF;

  v_details := coalesce(_payload, '{}'::jsonb);
  IF jsonb_typeof(v_details) <> 'object' OR length(v_details::text) > 4096 THEN
    RAISE EXCEPTION 'Ungültige Ereignisdetails.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.audit_log_entries (tenant_id, user_id, ip_address, action, payload)
  VALUES (
    _tenant_id,
    v_actor,
    public.audit_request_ip(),
    _action,
    v_details || jsonb_build_object('action', _action, 'timestamp', now())
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_audit_entry(text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_audit_entry(text, uuid, jsonb) TO authenticated;

-- 7) DSGVO-Freigabe als Ereignis ---------------------------------------------------
-- Die Freigabe selbst bleibt Invoker-Recht und Vier-Augen-geprüft; ergänzt wird nur
-- der Audit-Eintrag nach erfolgreicher Statusänderung. Eine abgewiesene Freigabe
-- wird nicht hier, sondern als beobachtete Ablehnung (security.access_denied)
-- protokolliert, weil das zurückgerollte Statement keinen Eintrag behalten kann.
CREATE OR REPLACE FUNCTION public.approve_gdpr_delete(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_request public.gdpr_requests;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Persönliche Anmeldung erforderlich.';
  END IF;

  UPDATE public.gdpr_requests
     SET status = 'approved'
   WHERE id = p_request_id
     AND request_type = 'delete'
     AND status = 'pending'
  RETURNING * INTO v_request;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Anfrage nicht verfügbar oder nicht mehr ausstehend.';
  END IF;

  PERFORM public.record_audit_entry(
    'security.gdpr.delete_approved',
    v_request.tenant_id,
    jsonb_build_object(
      'request_id', v_request.id,
      'requested_by', v_request.requested_by
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_gdpr_delete(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.approve_gdpr_delete(uuid) TO authenticated;
