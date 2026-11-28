-- Inbox-Hygiene für Entscheidungs-Meldungen.
--
-- Öffnen oder Beantworten markiert nur die Anfrage-Meldungen genau dieser
-- Entscheidung als gelesen. Archivieren lässt offene Kommentar-, Reaktions-,
-- Erinnerungs- und Anfrage-Meldungen verfallen; Ergebnis- und Rückzugsmeldungen
-- bleiben unangetastet.

CREATE OR REPLACE FUNCTION public.mark_decision_request_notifications_read(_decision_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_can_access_task_decision(_decision_id, auth.uid()) THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Entscheidung.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.notifications n
  SET is_read = true,
      read_at = coalesce(n.read_at, now())
  FROM public.notification_types t
  WHERE t.id = n.notification_type_id
    AND n.user_id = auth.uid()
    AND t.name = 'task_decision_request'
    AND n.data->>'decision_id' = _decision_id::text
    AND NOT n.is_read;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_decision_request_notifications_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_decision_request_notifications_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_decision_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.status IN ('active', 'open') AND NEW.status = 'archived' THEN
    UPDATE public.notifications n
    SET is_read = true,
        read_at = coalesce(n.read_at, now()),
        data = coalesce(n.data, '{}'::jsonb) || jsonb_build_object(
          'expired', true,
          'expired_reason', 'decision_archived',
          'expired_at', now()
        )
    FROM public.notification_types t
    WHERE t.id = n.notification_type_id
      AND t.tenant_id = NEW.tenant_id
      AND n.data->>'decision_id' = NEW.id::text
      AND NOT n.is_read
      AND t.name IN (
        'task_decision_request',
        'task_decision_deadline_reminder',
        'task_decision_digest',
        'task_decision_comment_received',
        'task_decision_comment_reply',
        'task_decision_comment_reaction_received',
        'task_decision_mention'
      );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_decision_notifications() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS aaa_expire_decision_notifications ON public.task_decisions;
CREATE TRIGGER aaa_expire_decision_notifications
  AFTER UPDATE OF status ON public.task_decisions
  FOR EACH ROW EXECUTE FUNCTION public.expire_decision_notifications();
