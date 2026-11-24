-- Aufbewahrungsregel für persistierte News-Artikel.
--
-- Jeder Feed-Abruf legt neue Zeilen an, deshalb werden Artikel nach einer festen
-- Frist entfernt. Ausgenommen sind Artikel, an denen Nutzerdaten oder Verweise
-- hängen:
--   * jede Zeile in news_article_states (gelesen oder gemerkt), und
--   * jede Aufgabe mit source_type = 'news' und source_id = article_id.
-- Damit bleiben Gelesen-/Merken-Status und Task-Backlinks unangetastet; der
-- Foreign Key auf news_article_states würde sonst per CASCADE mitlöschen.
--
-- Maßgeblich ist last_seen_at: der Zeitpunkt, an dem der Artikel zuletzt in
-- einem aktiven Feed auftauchte. Ein Artikel, der noch ausgeliefert wird, bleibt
-- also erhalten, auch wenn sein Erscheinungsdatum alt ist.

CREATE INDEX IF NOT EXISTS news_articles_last_seen_idx
  ON public.news_articles (last_seen_at);

-- Beschleunigt die Anti-Join-Prüfung auf Task-Backlinks (auch für WorkflowLinks).
CREATE INDEX IF NOT EXISTS tasks_news_source_idx
  ON public.tasks (tenant_id, source_id)
  WHERE source_type = 'news' AND source_id IS NOT NULL;

-- Beschleunigt die Anti-Join-Prüfung auf Gelesen-/Merken-Zeilen; der Primärschlüssel
-- beginnt mit user_id und hilft hier nicht.
CREATE INDEX IF NOT EXISTS news_article_states_article_idx
  ON public.news_article_states (tenant_id, article_id);

CREATE OR REPLACE FUNCTION public.cleanup_stale_news_articles(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  IF retention_days IS NULL OR retention_days < 7 THEN
    RAISE EXCEPTION 'Die Aufbewahrungsfrist für News muss mindestens 7 Tage betragen.';
  END IF;

  DELETE FROM public.news_articles article
  WHERE article.last_seen_at < now() - make_interval(days => retention_days)
    AND NOT EXISTS (
      SELECT 1
      FROM public.news_article_states state
      WHERE state.tenant_id = article.tenant_id
        AND state.article_id = article.article_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.tasks task
      WHERE task.tenant_id = article.tenant_id
        AND task.source_type = 'news'
        AND task.source_id = article.article_id
    );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_stale_news_articles(INTEGER) IS
  'Entfernt News-Artikel, die seit der Frist nicht mehr im Feed erschienen und weder gelesen/gemerkt noch von einer Aufgabe referenziert sind.';

REVOKE ALL ON FUNCTION public.cleanup_stale_news_articles(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_news_articles(INTEGER) TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news-retention-cleanup') THEN
    PERFORM cron.schedule(
      'news-retention-cleanup',
      '45 3 * * *',
      $cron$ SELECT public.cleanup_stale_news_articles(90); $cron$
    );
  END IF;
END $$;
