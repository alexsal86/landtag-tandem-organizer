-- Kommentarmeldungen tragen die Kommentar-ID, damit der Deep Link genau diesen
-- Kommentar fokussiert. Die Fassung aus 20261128217000 bleibt sonst unverändert.
CREATE OR REPLACE FUNCTION public.notify_decision_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant uuid;
  v_title text;
  v_creator uuid;
  v_parent_author uuid;
  v_actor text;
  v_recipient uuid;
BEGIN
  BEGIN
    SELECT td.tenant_id, td.title, td.created_by
      INTO v_tenant, v_title, v_creator
    FROM public.task_decisions td
    WHERE td.id = NEW.decision_id;

    IF v_tenant IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT p.display_name
      INTO v_actor
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id AND p.tenant_id = v_tenant
    LIMIT 1;

    IF NEW.parent_id IS NOT NULL THEN
      SELECT c.user_id INTO v_parent_author
      FROM public.task_decision_comments c
      WHERE c.id = NEW.parent_id;

      IF v_parent_author IS NOT NULL
         AND v_parent_author <> NEW.user_id
         AND public.is_tenant_member(v_tenant, v_parent_author) THEN
        PERFORM public.create_notification(
          v_parent_author,
          'task_decision_comment_reply',
          'Antwort auf deinen Kommentar',
          left(
            coalesce(v_actor, 'Ein Teammitglied')
              || ' hat auf deinen Kommentar zu "' || coalesce(v_title, '') || '" geantwortet.',
            240
          ),
          jsonb_build_object(
            'decision_id', NEW.decision_id,
            'decision_title', v_title,
            'comment_id', NEW.id,
            'parent_comment_id', NEW.parent_id,
            'tenant_id', v_tenant
          ),
          'medium',
          v_tenant
        );
      END IF;
    END IF;

    FOR v_recipient IN
      SELECT DISTINCT candidate.user_id
      FROM (
        SELECT v_creator AS user_id
        UNION
        SELECT p.user_id
        FROM public.task_decision_participants p
        WHERE p.decision_id = NEW.decision_id
      ) AS candidate
      WHERE candidate.user_id IS NOT NULL
        AND candidate.user_id <> NEW.user_id
        AND candidate.user_id <> coalesce(v_parent_author, NEW.user_id)
    LOOP
      IF NOT public.is_tenant_member(v_tenant, v_recipient) THEN
        CONTINUE;
      END IF;

      PERFORM public.create_notification(
        v_recipient,
        'task_decision_comment_received',
        'Neuer Kommentar',
        left(
          coalesce(v_actor, 'Ein Teammitglied')
            || ' hat einen Kommentar zu "' || coalesce(v_title, '') || '" hinterlassen.',
          240
        ),
        jsonb_build_object(
          'decision_id', NEW.decision_id,
          'decision_title', v_title,
          'comment_id', NEW.id,
          'tenant_id', v_tenant
        ),
        'low',
        v_tenant
      );
    END LOOP;

    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Entscheidungs-Meldung (%) fehlgeschlagen: %', TG_NAME, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_decision_comment() FROM PUBLIC, anon, authenticated;
