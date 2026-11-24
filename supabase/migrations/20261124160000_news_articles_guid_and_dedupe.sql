-- Ergänzt die News-Persistenz um die Feed-guid und einen Unique-Index gegen
-- doppelte Artikel derselben URL.
--
-- Die Artikel-ID bleibt deterministisch (Hash aus normalisiertem Link, guid nur
-- als Fallback für Einträge ohne Link). Der Unique-Index auf (tenant_id, link)
-- verhindert zusätzlich, dass derselbe Artikel über zwei Feeds doppelt entsteht.

ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS guid TEXT;

COMMENT ON COLUMN public.news_articles.guid IS 'RSS guid/id of the feed entry; identity fallback for entries without a link';

-- Bestehende Duplikate (gleiche URL) zusammenführen, bevor der Unique-Index greift.
-- Die persönlichen Statuszeilen hängen per ON DELETE CASCADE am behaltenen Artikel.
DELETE FROM public.news_articles AS duplicate
USING public.news_articles AS kept
WHERE duplicate.tenant_id = kept.tenant_id
  AND duplicate.link <> ''
  AND duplicate.link = kept.link
  AND duplicate.article_id > kept.article_id;

CREATE UNIQUE INDEX IF NOT EXISTS news_articles_tenant_link_key
  ON public.news_articles (tenant_id, link)
  WHERE link <> '';

CREATE INDEX IF NOT EXISTS news_articles_tenant_guid_idx
  ON public.news_articles (tenant_id, guid)
  WHERE guid IS NOT NULL;
