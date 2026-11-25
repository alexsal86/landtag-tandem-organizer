-- Themen-Erwähnungen: Meldung erst nach der eigentlichen Speicherung, nicht beim Autosave.
--
-- Befund im Client: der Bearbeiten-Dialog sichert nach 1,2 s Tipppause automatisch
-- (useQuickNoteEditor -> repository.queue -> save_quick_note). Jede dieser Schreibungen
-- erhöht quick_notes.revision und löste über den Zeilen-Trigger sofort eine Meldung aus –
-- also mitten im Schreiben.
--
-- Deshalb entfällt der Trigger auf UPDATE. Meldungen entstehen jetzt an genau zwei Punkten:
--   1. beim Anlegen einer Notiz (expliziter Klick: Quick-Capture, Kopie eines Entwurfs),
--   2. serverseitig verzögert, sobald eine Notiz eine Ruhephase lang unverändert blieb
--      (dispatch_settled_topic_mentions, jede Minute per pg_cron).
--
-- Welche (Notiz, Person, Thema)-Paare schon gemeldet wurden, hält
-- quick_note_topic_mention_deliveries fest. Das ersetzt den früheren Vergleich mit
-- OLD.content: ein erneut eingefügtes Thema wird nicht noch einmal gemeldet, und der
-- Dispatcher kann beliebig oft laufen.

-- 1) Zustell-Ledger: pro Notiz, Person und Thema genau eine Meldung.
CREATE TABLE IF NOT EXISTS public.quick_note_topic_mention_deliveries (
  note_id uuid NOT NULL REFERENCES public.quick_notes(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  notified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS quick_note_topic_mention_deliveries_topic
  ON public.quick_note_topic_mention_deliveries (topic_id);

ALTER TABLE public.quick_note_topic_mention_deliveries ENABLE ROW LEVEL SECURITY;
-- Nur der serverseitige Dispatcher schreibt und liest; Clients haben keinen Zugriff.
REVOKE ALL ON TABLE public.quick_note_topic_mention_deliveries FROM PUBLIC, anon, authenticated;

-- 2) Kern: noch nicht gemeldete Paare beanspruchen und je Person eine Meldung erzeugen.
CREATE OR REPLACE FUNCTION public.dispatch_topic_mentions_for_note(p_note_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_note public.quick_notes;
  v_actor text;
  v_note_title text;
  v_recipient uuid;
  v_labels text;
  v_ids jsonb;
  v_sent integer := 0;
BEGIN
  SELECT * INTO v_note FROM public.quick_notes WHERE id = p_note_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  IF v_note.tenant_id IS NULL
     OR v_note.deleted_at IS NOT NULL
     OR coalesce(v_note.is_archived, false)
     OR coalesce(v_note.content, '') NOT LIKE '%data-lexical-topic-id%' THEN
    RETURN 0;
  END IF;

  -- Der Titel ist Editor-HTML; Meldungen tragen reinen Text.
  v_note_title := btrim(regexp_replace(coalesce(v_note.title, ''), '<[^>]*>', ' ', 'g'));
  IF v_note_title = '' THEN
    v_note_title := 'Ohne Titel';
  END IF;

  SELECT coalesce(p.display_name, 'Jemand')
    INTO v_actor
  FROM public.profiles p
  WHERE p.user_id = v_note.user_id AND p.tenant_id = v_note.tenant_id
  LIMIT 1;

  FOR v_recipient, v_labels, v_ids IN
    WITH mentioned AS (
      SELECT DISTINCT (m)[1]::uuid AS topic_id
      FROM regexp_matches(
             coalesce(v_note.content, ''),
             'data-lexical-topic-id\s*=\s*"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"',
             'gi'
           ) AS m
    ),
    candidate AS (
      SELECT r.user_id AS recipient, t.id AS topic_id
      FROM mentioned
      JOIN public.topics t
        ON t.id = mentioned.topic_id
       AND t.tenant_id = v_note.tenant_id
       AND t.is_active
      JOIN public.employee_responsibilities r
        ON r.tenant_id = v_note.tenant_id
       AND r.kind = 'topic'
       AND r.topic_id = t.id
       AND r.level = 'primary'
      WHERE r.user_id IS DISTINCT FROM v_note.user_id
        AND public.is_tenant_member(v_note.tenant_id, r.user_id)
    ),
    claimed AS (
      INSERT INTO public.quick_note_topic_mention_deliveries(note_id, tenant_id, user_id, topic_id)
      SELECT v_note.id, v_note.tenant_id, candidate.recipient, candidate.topic_id
      FROM candidate
      ON CONFLICT (note_id, user_id, topic_id) DO NOTHING
      RETURNING user_id, topic_id
    )
    SELECT c.user_id,
           string_agg(DISTINCT t.label, ', ' ORDER BY t.label),
           jsonb_agg(DISTINCT t.id ORDER BY t.id)
    FROM claimed c
    JOIN public.topics t ON t.id = c.topic_id
    GROUP BY c.user_id
  LOOP
    PERFORM public.create_notification(
      v_recipient,
      'topic_mention',
      left('Thema erwähnt: ' || v_labels, 120),
      left(
        coalesce(v_actor, 'Jemand') || ' hat dich in der Notiz "' || v_note_title
          || '" zum Thema ' || v_labels || ' erwähnt.',
        240
      ),
      jsonb_build_object(
        'note_id', v_note.id,
        'topic_ids', v_ids,
        'topic_labels', v_labels,
        'note_revision', v_note.revision,
        'tenant_id', v_note.tenant_id
      ),
      'medium',
      v_note.tenant_id
    );
    v_sent := v_sent + 1;
  END LOOP;

  RETURN v_sent;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_topic_mentions_for_note(uuid) FROM PUBLIC, anon, authenticated;

-- 3) Anlegen einer Notiz ist die eigentliche Speicherung: sofort melden.
CREATE OR REPLACE FUNCTION public.notify_topic_mentions_on_note_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.dispatch_topic_mentions_for_note(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_topic_mentions_on_note_create() FROM PUBLIC, anon, authenticated;

-- Der alte Trigger meldete auch bei jedem Autosave (UPDATE OF content).
DROP TRIGGER IF EXISTS trg_quick_note_topic_mentions ON public.quick_notes;
DROP FUNCTION IF EXISTS public.notify_quick_note_topic_mentions();

CREATE TRIGGER trg_quick_note_topic_mentions
  AFTER INSERT ON public.quick_notes
  FOR EACH ROW EXECUTE FUNCTION public.notify_topic_mentions_on_note_create();

-- 4) Verzögerter Anlauf für bearbeitete Notizen: erst wenn die Notiz ruht.
CREATE OR REPLACE FUNCTION public.dispatch_settled_topic_mentions(
  p_quiet_seconds integer DEFAULT 90,
  p_window_hours integer DEFAULT 6
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_note_id uuid;
  v_total integer := 0;
BEGIN
  FOR v_note_id IN
    SELECT n.id
    FROM public.quick_notes n
    WHERE n.deleted_at IS NULL
      AND NOT coalesce(n.is_archived, false)
      AND coalesce(n.content, '') LIKE '%data-lexical-topic-id%'
      AND n.updated_at <= now() - make_interval(secs => greatest(coalesce(p_quiet_seconds, 90), 30))
      AND n.updated_at > now() - make_interval(hours => greatest(coalesce(p_window_hours, 6), 1))
    ORDER BY n.updated_at
    LIMIT 500
  LOOP
    v_total := v_total + public.dispatch_topic_mentions_for_note(v_note_id);
  END LOOP;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_settled_topic_mentions(integer, integer) FROM PUBLIC, anon, authenticated;

-- Nur der Anlauf braucht den Index; die vorhandene tenant_id-Spalte führt hier nicht weiter.
CREATE INDEX IF NOT EXISTS quick_notes_topic_mention_dispatch
  ON public.quick_notes (updated_at)
  WHERE deleted_at IS NULL AND coalesce(is_archived, false) = false;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-topic-mentions') THEN
      PERFORM cron.unschedule('dispatch-topic-mentions');
    END IF;
    PERFORM cron.schedule(
      'dispatch-topic-mentions',
      '* * * * *',
      'SELECT public.dispatch_settled_topic_mentions();'
    );
  ELSE
    RAISE NOTICE 'pg_cron fehlt – Themen-Meldungen zu bearbeiteten Notizen laufen nicht automatisch';
  END IF;
END $$;
