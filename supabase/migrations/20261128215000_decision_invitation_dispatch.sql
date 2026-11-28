-- P1.5: Einladungsversand für Entscheidungen an dieselbe Quelle hängen.
--
-- Bisher rief nur der Client `send-decision-email` auf, und nur wenn dort
-- "per E-Mail senden" gewählt war. Teilnehmende, die über den Bearbeiten-Dialog
-- oder über einen API-Weg hinzukommen, erhielten keine Einladung. Der Versand
-- hängt jetzt am Teilnehmer-Insert:
--
--   1. task_decisions.invite_via_email hält die Absicht des Erstellers fest.
--   2. Jeder Teilnehmer-Insert legt genau eine Versandzeile an (Outbox).
--   3. Ein Cron-Worker übernimmt fällige Zeilen atomar, ruft den bestehenden
--      E-Mail-Renderer auf und verbucht Erfolg oder Fehler.
--
-- Matrix: Ein ausgehender Matrix-Versand für Einladungen existiert im Bestand
-- nicht (matrix-decision-handler verarbeitet nur eingehende Antworten). Die
-- Absicht wird deshalb nicht gespeichert; das Matrix-Kästchen bleibt ohne
-- serverseitige Entsprechung.

-- 1) Absicht am Entscheidungsdatensatz
ALTER TABLE public.task_decisions
  ADD COLUMN IF NOT EXISTS invite_via_email boolean NOT NULL DEFAULT false;

-- 2) Outbox
CREATE TABLE IF NOT EXISTS public.decision_invitation_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL UNIQUE REFERENCES public.task_decision_participants(id) ON DELETE CASCADE,
  decision_id uuid NOT NULL REFERENCES public.task_decisions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'skipped', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  claimed_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_invitation_dispatches_pending
  ON public.decision_invitation_dispatches (created_at)
  WHERE status = 'pending';

ALTER TABLE public.decision_invitation_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.decision_invitation_dispatches FROM PUBLIC, anon, authenticated;

-- 3) Jeder Teilnehmer-Insert stellt die Zeile ein; ein Fehler darf den Insert nicht kippen.
CREATE OR REPLACE FUNCTION public.enqueue_decision_invitation_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT td.tenant_id INTO v_tenant
  FROM public.task_decisions td
  WHERE td.id = NEW.decision_id;

  IF v_tenant IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.decision_invitation_dispatches (participant_id, decision_id, tenant_id, user_id)
  VALUES (NEW.id, NEW.decision_id, v_tenant, NEW.user_id)
  ON CONFLICT (participant_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Einladungsversand für Teilnehmer % konnte nicht eingestellt werden: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decision_invitation_dispatch ON public.task_decision_participants;
CREATE TRIGGER trg_decision_invitation_dispatch
  AFTER INSERT ON public.task_decision_participants
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_decision_invitation_dispatch();

REVOKE ALL ON FUNCTION public.enqueue_decision_invitation_dispatch() FROM PUBLIC, anon, authenticated;

-- 4) Übernahme durch den Worker. Nur service_role; Zeilen werden gesperrt und
--    beim Übernehmen auf 'processing' gesetzt, damit parallele Läufe nicht doppelt senden.
CREATE OR REPLACE FUNCTION public.claim_decision_invitation_dispatches(_limit integer DEFAULT 100)
RETURNS TABLE (
  dispatch_id uuid,
  participant_id uuid,
  decision_id uuid,
  tenant_id uuid,
  user_id uuid,
  participant_token text,
  decision_title text,
  decision_description text,
  task_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Zeilen, deren Entscheidung nie zum Versand freigegeben wurde, werden nach
  -- einer Stunde als übersprungen verbucht statt ewig anzustehen.
  UPDATE public.decision_invitation_dispatches d
  SET status = 'skipped', processed_at = now()
  WHERE d.status = 'pending'
    AND d.created_at < now() - interval '1 hour'
    AND NOT EXISTS (
      SELECT 1 FROM public.task_decisions td
      WHERE td.id = d.decision_id AND td.invite_via_email
    );

  RETURN QUERY
  WITH candidate AS (
    SELECT d.id
    FROM public.decision_invitation_dispatches d
    JOIN public.task_decisions td ON td.id = d.decision_id
    WHERE d.status = 'pending'
      AND d.attempts < 3
      AND td.invite_via_email
      AND d.created_at > now() - interval '7 days'
    ORDER BY d.created_at
    LIMIT greatest(_limit, 1)
    FOR UPDATE OF d SKIP LOCKED
  ), claimed AS (
    UPDATE public.decision_invitation_dispatches d
    SET status = 'processing', attempts = d.attempts + 1, claimed_at = now()
    FROM candidate c
    WHERE d.id = c.id
    RETURNING d.*
  )
  SELECT c.id, c.participant_id, c.decision_id, c.tenant_id, c.user_id,
         p.token, td.title, td.description, t.title
  FROM claimed c
  JOIN public.task_decision_participants p ON p.id = c.participant_id
  JOIN public.task_decisions td ON td.id = c.decision_id
  LEFT JOIN public.tasks t ON t.id = td.task_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_decision_invitation_dispatches(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_decision_invitation_dispatches(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_decision_invitation_dispatch(
  _dispatch_id uuid,
  _success boolean,
  _error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.decision_invitation_dispatches d
  SET status = CASE
        WHEN _success THEN 'sent'
        WHEN d.attempts >= 3 THEN 'failed'
        ELSE 'pending'
      END,
      last_error = left(_error, 500),
      processed_at = CASE WHEN _success OR d.attempts >= 3 THEN now() ELSE NULL END
  WHERE d.id = _dispatch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_decision_invitation_dispatch(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_decision_invitation_dispatch(uuid, boolean, text) TO service_role;

-- 5) Selbsttest: Einstellen, Übernehmen und Verbuchen in einer zurückgerollten Transaktion.
CREATE OR REPLACE FUNCTION public.decision_invitation_dispatch_selftest(p_tenant uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_decision uuid;
  v_participant uuid;
  v_enqueued boolean := false;
  v_claimed boolean := false;
  v_finished boolean := false;
  v_status text;
BEGIN
  IF v_actor IS NULL OR NOT public.is_tenant_member(p_tenant, v_actor) THEN
    RAISE EXCEPTION 'Keine Büromitgliedschaft' USING ERRCODE = '42501';
  END IF;

  BEGIN
    INSERT INTO public.task_decisions (title, description, status, created_by, tenant_id, invite_via_email)
    VALUES ('[SELFTEST] Einladungsversand', '[SELFTEST]', 'open', v_actor, p_tenant, true)
    RETURNING id INTO v_decision;

    INSERT INTO public.task_decision_participants (decision_id, user_id)
    VALUES (v_decision, v_actor)
    RETURNING id INTO v_participant;

    SELECT EXISTS (
      SELECT 1 FROM public.decision_invitation_dispatches d
      WHERE d.participant_id = v_participant AND d.tenant_id = p_tenant AND d.status = 'pending'
    ) INTO v_enqueued;

    SELECT EXISTS (
      SELECT 1 FROM public.claim_decision_invitation_dispatches(50) c
      WHERE c.participant_id = v_participant AND c.tenant_id = p_tenant
    ) INTO v_claimed;

    SELECT d.status INTO v_status
    FROM public.decision_invitation_dispatches d
    WHERE d.participant_id = v_participant;

    PERFORM public.finish_decision_invitation_dispatch(
      (SELECT d.id FROM public.decision_invitation_dispatches d WHERE d.participant_id = v_participant),
      true,
      NULL
    );

    SELECT EXISTS (
      SELECT 1 FROM public.decision_invitation_dispatches d
      WHERE d.participant_id = v_participant AND d.status = 'sent' AND d.attempts = 1
    ) INTO v_finished;

    RAISE EXCEPTION 'rollback selftest' USING ERRCODE = 'ZX025';
  EXCEPTION
    WHEN SQLSTATE 'ZX025' THEN NULL;
    WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'message', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', v_enqueued AND v_claimed AND v_status = 'processing' AND v_finished,
    'checks', jsonb_build_object(
      'enqueued', v_enqueued,
      'claimed', v_claimed,
      'processing', v_status,
      'finished', v_finished
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decision_invitation_dispatch_selftest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decision_invitation_dispatch_selftest(uuid) TO authenticated;

-- 6) Cron alle 5 Minuten: Worker übernimmt und versendet.
DO $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_cron/pg_net fehlen – Entscheidungs-Einladungen laufen nicht automatisch';
    RETURN;
  END IF;

  v_url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1);
  v_key := coalesce(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
  );

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE 'supabase_url/service_role_key fehlen im Vault – Cron dispatch-decision-invitations wird nicht eingerichtet';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-decision-invitations') THEN
    PERFORM cron.unschedule('dispatch-decision-invitations');
  END IF;

  PERFORM cron.schedule(
    'dispatch-decision-invitations',
    '*/5 * * * *',
    format(
      $job$SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || %L), body := '{}'::jsonb);$job$,
      rtrim(v_url, '/') || '/functions/v1/dispatch-decision-invitations',
      v_key
    )
  );
END $$;
