-- Redaktion: Freigabe-Sperre vollständig machen.
--
-- Bisher lief der Freigabe-Trigger nur bei UPDATE. Die INSERT-Prüfung in der Funktion wurde
-- damit nie ausgeführt, und ein bereits freigegebener Beitrag durfte inhaltlich beliebig
-- geändert werden, weil die Funktion bei unverändertem Freigabestatus sofort zurückkehrt.
--
-- Jetzt gilt:
--  * Der Trigger ist für INSERT und UPDATE registriert; wer einen Beitrag direkt als
--    „freigegeben“ anlegt, muss Büroleitung oder Abgeordnete/r sein.
--  * Inhaltliche Änderungen an einem freigegebenen Beitrag entziehen der Freigabe die
--    Grundlage: Der Beitrag geht zurück in die Freigabe (pending_approval), Freigeber und
--    Zeitpunkt werden geleert, und das Protokoll hält den Vorgang als „reopened“ fest.
--  * Dasselbe gilt für die Kanaltexte in social_content_variants – der eigentliche Posttext
--    steht ebenso unter der Freigabe wie das Briefing.
--  * Kanalzuordnung, Kampagne, verantwortliche Person, Termin, interne Notizen und
--    Veröffentlichungsdaten sind Organisation bzw. Nachbereitung und lösen keine neue
--    Freigabe aus; das Umhängen des Themas bleibt laut Bearbeitungspanel freigabeneutral.

-- 1) Protokoll um die automatische Rückgabe in die Freigabe erweitern.
ALTER TABLE public.social_content_approval_events
  DROP CONSTRAINT IF EXISTS social_content_approval_events_action_check;
ALTER TABLE public.social_content_approval_events
  ADD CONSTRAINT social_content_approval_events_action_check
  CHECK (action IN ('submitted', 'approved', 'rejected', 'reset', 'reopened'));

-- 2) Freigabe-Trigger: Einreichen ist Redaktionsarbeit, Entscheiden ist Leitungssache.
--    Wer/wann kommt ausschließlich aus auth.uid()/now(); Client-Werte werden überschrieben.
--    Inhaltliche Änderungen einer bestätigten Freigabe setzen den Beitrag zurück in die Freigabe.
CREATE OR REPLACE FUNCTION public.enforce_social_content_approval_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_actor uuid;
  v_admin boolean;
  v_allowed boolean := false;
  v_workflow_bypass boolean := coalesce(current_setting('app.social_approval_workflow', true), '') = 'on';
  v_content_changed boolean;
BEGIN
  v_actor := (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1);

  IF TG_OP = 'INSERT' THEN
    IF NEW.approval_state = 'approved' AND NOT public.is_tenant_admin(auth.uid(), NEW.tenant_id) THEN
      RAISE EXCEPTION 'Nur Büroleitung und Abgeordnete dürfen Freigaben erteilen.' USING ERRCODE = '42501';
    END IF;
    IF NEW.approval_state = 'approved' THEN
      NEW.approved_at := now();
      NEW.approved_by := v_actor;
    ELSE
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
    END IF;
    RETURN NEW;
  END IF;

  v_content_changed := ROW(
    NEW.format, NEW.format_variant, NEW.content_goal, NEW.hook, NEW.core_message, NEW.cta,
    NEW.draft_text, NEW.hashtags, NEW.hashtags_in_comment, NEW.alt_text, NEW.image_url,
    NEW.asset_requirements
  ) IS DISTINCT FROM ROW(
    OLD.format, OLD.format_variant, OLD.content_goal, OLD.hook, OLD.core_message, OLD.cta,
    OLD.draft_text, OLD.hashtags, OLD.hashtags_in_comment, OLD.alt_text, OLD.image_url,
    OLD.asset_requirements
  );

  IF ROW(NEW.approval_state, NEW.approved_at, NEW.approved_by)
     IS NOT DISTINCT FROM ROW(OLD.approval_state, OLD.approved_at, OLD.approved_by) THEN
    -- Ohne Freigabe-Änderung bleibt eine bestätigte Freigabe nur gültig, solange der Inhalt
    -- gleich bleibt. Sonst verfällt sie und der Beitrag geht zurück in die Freigabe; das ist
    -- Redaktionsarbeit und braucht deshalb keine Leitungsrolle.
    IF v_content_changed
       AND OLD.approval_state = 'approved'
       AND OLD.published_at IS NULL
       AND OLD.workflow_status <> 'published' THEN
      NEW.approval_state := 'pending_approval';
      NEW.workflow_status := 'approval';
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
    END IF;
    RETURN NEW;
  END IF;

  v_admin := public.is_tenant_admin(auth.uid(), NEW.tenant_id);

  IF v_workflow_bypass THEN
    v_allowed := true;
  ELSIF NEW.approval_state IN ('approved', 'rejected') OR OLD.approval_state = 'approved' THEN
    -- Bestätigte Freigaben sind gesperrt: nur die Leitung kann sie erteilen oder zurücknehmen.
    v_allowed := v_admin;
  ELSE
    v_allowed := public.has_active_tenant_role(
      auth.uid(), NEW.tenant_id, ARRAY['mitarbeiter', 'praktikant', 'bueroleitung', 'abgeordneter']
    );
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Nur Büroleitung und Abgeordnete dürfen Freigaben erteilen oder zurücknehmen.' USING ERRCODE = '42501';
  END IF;

  IF NEW.approval_state = 'approved' THEN
    NEW.approved_at := now();
    NEW.approved_by := v_actor;
  ELSE
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Der Trigger greift jetzt auch beim Anlegen eines Beitrags.
DROP TRIGGER IF EXISTS trg_social_content_approval_permissions ON public.social_content_items;
CREATE TRIGGER trg_social_content_approval_permissions
  BEFORE INSERT OR UPDATE ON public.social_content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_social_content_approval_permissions();

-- 3) Protokoll schreiben (wer, wann, von welchem Zustand wohin). Auch die vom Trigger selbst
--    gesetzte Rückgabe in die Freigabe muss protokolliert werden: Ein UPDATE OF approval_state
--    feuert nicht, wenn der Client die Spalte nicht im SET hat – deshalb ohne Spaltenliste,
--    die Funktion vergleicht die Werte ohnehin selbst.
CREATE OR REPLACE FUNCTION public.log_social_content_approval_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_actor uuid;
  v_actor_name text;
  v_from text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.approval_state NOT IN ('pending_approval', 'approved') THEN
      RETURN NEW;
    END IF;
  ELSE
    IF NEW.approval_state IS NOT DISTINCT FROM OLD.approval_state THEN
      RETURN NEW;
    END IF;
    v_from := OLD.approval_state;
  END IF;

  v_actor := (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1);
  v_actor_name := coalesce((SELECT p.display_name FROM public.profiles p WHERE p.id = v_actor), 'Unbekannt');

  INSERT INTO public.social_content_approval_events(
    tenant_id, content_item_id, actor_id, actor_user_id, actor_name, action, from_state, to_state
  ) VALUES (
    NEW.tenant_id,
    NEW.id,
    v_actor,
    auth.uid(),
    v_actor_name,
    CASE
      WHEN NEW.approval_state = 'approved' THEN 'approved'
      WHEN NEW.approval_state = 'rejected' THEN 'rejected'
      WHEN NEW.approval_state = 'pending_approval' AND v_from = 'approved' THEN 'reopened'
      WHEN NEW.approval_state = 'pending_approval' THEN 'submitted'
      ELSE 'reset'
    END,
    v_from,
    NEW.approval_state
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_social_content_approval_log ON public.social_content_items;
CREATE TRIGGER trg_social_content_approval_log
  AFTER INSERT OR UPDATE ON public.social_content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_social_content_approval_event();

-- 4) Kanaltexte: Der eigentliche Posttext steht ebenfalls unter der Freigabe.
CREATE OR REPLACE FUNCTION public.reopen_social_content_after_variant_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_item_id uuid;
  v_item public.social_content_items;
  v_previous_setting text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_item_id := NEW.content_item_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_item_id := OLD.content_item_id;
  ELSE
    IF ROW(NEW.caption, NEW.first_comment, NEW.media_type, NEW.asset_ids)
       IS NOT DISTINCT FROM ROW(OLD.caption, OLD.first_comment, OLD.media_type, OLD.asset_ids) THEN
      RETURN NULL;
    END IF;
    v_item_id := NEW.content_item_id;
  END IF;

  SELECT * INTO v_item FROM public.social_content_items WHERE id = v_item_id;
  IF NOT FOUND
     OR v_item.approval_state <> 'approved'
     OR v_item.published_at IS NOT NULL
     OR v_item.workflow_status = 'published' THEN
    RETURN NULL;
  END IF;

  -- Die Rückgabe in die Freigabe ist Systemfolge der Inhaltsänderung, keine Freigabeentscheidung.
  v_previous_setting := coalesce(current_setting('app.social_approval_workflow', true), '');
  PERFORM set_config('app.social_approval_workflow', 'on', true);

  UPDATE public.social_content_items
     SET approval_state = 'pending_approval',
         approved_at = NULL,
         approved_by = NULL,
         workflow_status = 'approval'
   WHERE id = v_item_id;

  PERFORM set_config('app.social_approval_workflow', v_previous_setting, true);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_social_content_variant_reopen_approval ON public.social_content_variants;
CREATE TRIGGER trg_social_content_variant_reopen_approval
  AFTER INSERT OR UPDATE OR DELETE ON public.social_content_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.reopen_social_content_after_variant_change();
