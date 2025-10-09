-- Add ETag and Last-Modified tracking columns to external_calendars
ALTER TABLE external_calendars 
ADD COLUMN IF NOT EXISTS last_etag TEXT,
ADD COLUMN IF NOT EXISTS last_modified_http TEXT;

COMMENT ON COLUMN external_calendars.last_etag IS 'HTTP ETag from last successful fetch for conditional requests';
COMMENT ON COLUMN external_calendars.last_modified_http IS 'HTTP Last-Modified from last successful fetch for conditional requests';

-- Create RSS cache table for reducing egress
CREATE TABLE IF NOT EXISTS rss_cache (
  cache_key TEXT PRIMARY KEY,
  content JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rss_cache_expires ON rss_cache(expires_at);

COMMENT ON TABLE rss_cache IS 'Cache for RSS feed content to reduce external fetches';
COMMENT ON COLUMN rss_cache.cache_key IS 'Unique key based on tenant_id and category';
COMMENT ON COLUMN rss_cache.content IS 'Cached RSS feed data including articles';
COMMENT ON COLUMN rss_cache.expires_at IS 'Expiration timestamp for cache invalidation';

-- Add index for better calendar sync query performance
CREATE INDEX IF NOT EXISTS idx_external_calendars_sync_status 
ON external_calendars(sync_enabled, last_sync) 
WHERE sync_enabled = true;