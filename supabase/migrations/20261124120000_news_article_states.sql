-- Persistente News-Artikel und der persönliche Gelesen-/Merken-Status.
--
-- Die Artikel-ID wird in der Edge Function deterministisch aus dem normalisierten
-- Link gebildet (nws_ + Hash). Dadurch bleiben Aufgaben-, Merklisten- und
-- Gelesen-Verknüpfungen gültig, auch wenn ein Artikel aus dem Feed fällt.

CREATE TABLE IF NOT EXISTS public.news_articles (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  link TEXT NOT NULL,
  source TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  image_url TEXT,
  pub_date TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_news_articles_pub_date
  ON public.news_articles (tenant_id, pub_date DESC);

COMMENT ON TABLE public.news_articles IS 'Persisted news articles per office; article_id is a deterministic hash of the normalized link';
COMMENT ON COLUMN public.news_articles.article_id IS 'Stable id (nws_ + 128 bit of the normalized link hash) shared by UI, tasks and shares';

CREATE TABLE IF NOT EXISTS public.news_article_states (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_saved BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  saved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id, article_id),
  CONSTRAINT news_article_states_article_fkey
    FOREIGN KEY (tenant_id, article_id)
    REFERENCES public.news_articles(tenant_id, article_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_news_article_states_saved
  ON public.news_article_states (tenant_id, user_id)
  WHERE is_saved = true;

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_article_states ENABLE ROW LEVEL SECURITY;

-- Artikel werden ausschließlich serverseitig geschrieben, gelesen wird im eigenen Büro.
CREATE POLICY "Users can view news articles in their tenant"
ON public.news_articles FOR SELECT
TO authenticated
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Service role can manage news articles"
ON public.news_articles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Gelesen/merken ist persönlich: jede Person sieht und schreibt nur eigene Zeilen.
CREATE POLICY "Users can view their own news article states"
ON public.news_article_states FOR SELECT
TO authenticated
USING (user_id = auth.uid() AND tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can insert their own news article states"
ON public.news_article_states FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can update their own news article states"
ON public.news_article_states FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND tenant_id = ANY (get_user_tenant_ids(auth.uid())))
WITH CHECK (user_id = auth.uid() AND tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can delete their own news article states"
ON public.news_article_states FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND tenant_id = ANY (get_user_tenant_ids(auth.uid())));

DROP TRIGGER IF EXISTS update_news_article_states_updated_at ON public.news_article_states;
CREATE TRIGGER update_news_article_states_updated_at
  BEFORE UPDATE ON public.news_article_states
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
