ALTER TABLE public.event_rsvp_public_links
  ADD COLUMN IF NOT EXISTS response_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_response_ip_hash text,
  ADD COLUMN IF NOT EXISTS last_response_user_agent text,
  ADD COLUMN IF NOT EXISTS last_response_source text;

COMMENT ON COLUMN public.event_rsvp_public_links.response_count IS 'Anzahl der über den öffentlichen Link gespeicherten Antworten.';
COMMENT ON COLUMN public.event_rsvp_public_links.last_response_ip_hash IS 'SHA-256 Hash der zuletzt verwendeten Client-IP für Missbrauchsanalyse.';
COMMENT ON COLUMN public.event_rsvp_public_links.last_response_user_agent IS 'Zuletzt beobachteter User-Agent des öffentlichen RSVP-Endpunkts.';
COMMENT ON COLUMN public.event_rsvp_public_links.last_response_source IS 'Technische Quelle der letzten öffentlichen Antwort, z. B. public_website.';

ALTER TABLE public.event_rsvp_public_links
  ADD CONSTRAINT event_rsvp_public_links_last_response_source_check
  CHECK (last_response_source IS NULL OR last_response_source IN ('public_website'));
