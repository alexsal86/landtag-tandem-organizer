-- Add RLS policies for rss_cache table
ALTER TABLE rss_cache ENABLE ROW LEVEL SECURITY;

-- Service role can manage all cache entries
CREATE POLICY "Service role can manage rss cache"
ON rss_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Authenticated users can read cache (for debugging/monitoring)
CREATE POLICY "Authenticated users can read rss cache"
ON rss_cache
FOR SELECT
TO authenticated
USING (true);