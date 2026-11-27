-- Zusagen-Messung auswertbar machen: Summe über alle Nutzer, ohne Gesprächsinhalt.
--
-- Die Zähler liegen als JSON in user_preferences (Schlüssel
-- 'office-feedback-promise-hints:<tenant>:<user>'), pro Nutzer nur für diesen lesbar.
-- Diese Funktion liefert ausschließlich Summen und ist auf Superadmins beschränkt.
--
-- Manuell im SQL-Editor (Superadmin/Service-Rolle):
--   SELECT * FROM public.get_office_feedback_promise_hint_stats();
-- Reine Abfrage ohne Funktion:
--   SELECT count(DISTINCT user_id) AS users,
--          coalesce(sum((value->>'shown')::numeric), 0)     AS shown,
--          coalesce(sum((value->>'unchanged')::numeric), 0) AS unchanged,
--          coalesce(sum((value->>'edited')::numeric), 0)    AS edited,
--          coalesce(sum((value->>'discarded')::numeric), 0) AS discarded
--   FROM public.user_preferences
--   WHERE key LIKE 'office-feedback-promise-hints:%';

CREATE OR REPLACE FUNCTION public.get_office_feedback_promise_hint_stats()
RETURNS TABLE (
  shown bigint,
  unchanged bigint,
  edited bigint,
  discarded bigint,
  users bigint,
  last_updated timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Nur Superadmins dürfen die Zusagen-Messung auswerten.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH counted AS (
    SELECT
      p.user_id,
      p.updated_at,
      CASE WHEN jsonb_typeof(p.value -> 'shown') = 'number'
        THEN greatest((p.value ->> 'shown')::numeric, 0) ELSE 0 END AS shown,
      CASE WHEN jsonb_typeof(p.value -> 'unchanged') = 'number'
        THEN greatest((p.value ->> 'unchanged')::numeric, 0) ELSE 0 END AS unchanged,
      CASE WHEN jsonb_typeof(p.value -> 'edited') = 'number'
        THEN greatest((p.value ->> 'edited')::numeric, 0) ELSE 0 END AS edited,
      CASE WHEN jsonb_typeof(p.value -> 'discarded') = 'number'
        THEN greatest((p.value ->> 'discarded')::numeric, 0) ELSE 0 END AS discarded
    FROM public.user_preferences p
    WHERE p.key LIKE 'office-feedback-promise-hints:%'
  )
  SELECT
    -- `shown` ist mindestens die Summe der Ausgänge (Altbestände ohne shown-Zähler).
    greatest(coalesce(sum(c.shown), 0), coalesce(sum(c.unchanged + c.edited + c.discarded), 0))::bigint,
    coalesce(sum(c.unchanged), 0)::bigint,
    coalesce(sum(c.edited), 0)::bigint,
    coalesce(sum(c.discarded), 0)::bigint,
    count(DISTINCT c.user_id)::bigint,
    max(c.updated_at)
  FROM counted c;
END;
$$;

COMMENT ON FUNCTION public.get_office_feedback_promise_hint_stats() IS
  'Summiert die Zusagen-Hinweis-Zähler über alle Nutzer (nur Superadmins). Ohne Gesprächsinhalt.';

REVOKE ALL ON FUNCTION public.get_office_feedback_promise_hint_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_office_feedback_promise_hint_stats() TO authenticated;
