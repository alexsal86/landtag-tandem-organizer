-- Edge Function Cache (KV) für teure externe Calls
CREATE TABLE IF NOT EXISTS public.edge_function_cache (
  cache_key TEXT PRIMARY KEY,
  cache_value JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS edge_function_cache_expires_idx
  ON public.edge_function_cache(expires_at);

ALTER TABLE public.edge_function_cache ENABLE ROW LEVEL SECURITY;

-- Nur Service-Role darf lesen/schreiben (Edge Functions). Keine Policy für anon/authenticated => kein Zugriff.
-- (RLS aktiv, ohne Policies = default deny für nicht-service-role)

-- Cleanup-Funktion (idempotent), wird via pg_cron stündlich aufgerufen
CREATE OR REPLACE FUNCTION public.cleanup_edge_function_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.edge_function_cache
  WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_edge_function_cache() FROM PUBLIC, anon, authenticated;