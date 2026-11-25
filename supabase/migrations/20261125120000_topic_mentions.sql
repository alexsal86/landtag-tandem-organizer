-- Themen-Erwähnungen (#Thema) in Notizen: Meldung an die primäre Zuständigkeit.
--
-- Der Notizeditor speichert HTML; eine Erwähnung ist ein Chip mit
-- data-lexical-topic-id="<uuid>". Die Meldung entsteht ausschließlich in der Datenbank,
-- damit auch offline vorgemerkte Notizen (Outbox -> save_quick_note) zugestellt werden.
--
-- Empfänger sind nur primäre Zuständigkeiten des Themas. Hat ein Thema keine primäre
-- Zuständigkeit, wird es still übersprungen – daraus darf keine Rundmeldung werden.
-- Eine Person erhält je Notiz eine Meldung mit allen ihren Themen; create_notification
-- verwirft sonst identische Meldungen innerhalb einer Minute als Dublette.

-- 1) Benachrichtigungstyp für bestehende Mandanten.
--    Ohne Typ gibt create_notification still NULL zurück, die Meldung ginge verloren.
INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
SELECT t.id,
       'topic_mention',
       'Thema erwähnt',
       'Eine Notiz nennt ein Thema, für das du primär zuständig bist.',
       'notes',
       true
FROM public.tenants t
ON CONFLICT (tenant_id, name) DO NOTHING;

-- 2) Neue Mandanten erhalten den Typ sofort.
CREATE OR REPLACE FUNCTION public.seed_topic_mention_notification_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notification_types (tenant_id, name, label, description, category, is_active)
  VALUES (NEW.id,
          'topic_mention',
          'Thema erwähnt',
          'Eine Notiz nennt ein Thema, für das du primär zuständig bist.',
          'notes',
          true)
  ON CONFLICT (tenant_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_topic_mention_notification_type ON public.tenants;
CREATE TRIGGER seed_topic_mention_notification_type
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.seed_topic_mention_notification_type();

REVOKE ALL ON FUNCTION public.seed_topic_mention_notification_type() FROM PUBLIC, anon, authenticated;

-- 3) Meldung zu neu hinzugekommenen Themen-Erwähnungen einer Notiz.
--    SECURITY DEFINER, weil die Meldung als Folge einer normalen Notizspeicherung entsteht.
CREATE OR REPLACE FUNCTION public.notify_quick_note_topic_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old text := '';
  v_note_title text;
  v_actor text;
  v_recipient uuid;
  v_labels text;
  v_ids jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_old := lower(coalesce(OLD.content, ''));
  END IF;

  -- Der Titel ist ebenfalls Editor-HTML; Meldungen sollen reinen Text tragen.
  v_note_title := btrim(regexp_replace(coalesce(NEW.title, ''), '<[^>]*>', ' ', 'g'));
  IF v_note_title = '' THEN
    v_note_title := 'Ohne Titel';
  END IF;

  SELECT coalesce(p.display_name, 'Jemand')
    INTO v_actor
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id AND p.tenant_id = NEW.tenant_id
  LIMIT 1;

  FOR v_recipient, v_labels, v_ids IN
    SELECT r.user_id,
           string_agg(DISTINCT t.label, ', ' ORDER BY t.label),
           jsonb_agg(DISTINCT t.id ORDER BY t.id)
    FROM (
      SELECT DISTINCT (m)[1]::uuid AS topic_id
      FROM regexp_matches(
             coalesce(NEW.content, ''),
             'data-lexical-topic-id\s*=\s*"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"',
             'gi'
           ) AS m
    ) AS mentioned
    JOIN public.topics t
      ON t.id = mentioned.topic_id
     AND t.tenant_id = NEW.tenant_id
     AND t.is_active
    JOIN public.employee_responsibilities r
      ON r.tenant_id = NEW.tenant_id
     AND r.kind = 'topic'
     AND r.topic_id = t.id
     AND r.level = 'primary'
    WHERE position(lower(t.id::text) in coalesce(v_old, '')) = 0
      AND r.user_id IS DISTINCT FROM NEW.user_id
      AND public.is_tenant_member(NEW.tenant_id, r.user_id)
    GROUP BY r.user_id
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
        'note_id', NEW.id,
        'topic_ids', v_ids,
        'topic_labels', v_labels,
        'tenant_id', NEW.tenant_id
      ),
      'medium',
      NEW.tenant_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_quick_note_topic_mentions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_quick_note_topic_mentions ON public.quick_notes;
CREATE TRIGGER trg_quick_note_topic_mentions
  AFTER INSERT OR UPDATE OF content ON public.quick_notes
  FOR EACH ROW EXECUTE FUNCTION public.notify_quick_note_topic_mentions();
