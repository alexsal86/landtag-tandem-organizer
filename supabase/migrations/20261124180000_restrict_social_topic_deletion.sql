-- Beiträge dürfen nicht mehr stillschweigend verschwinden, wenn ein Thema gelöscht wird.
-- Bisher löschte ON DELETE CASCADE alle verknüpften social_content_items mit dem Thema.
-- topic_backlog_id ist NOT NULL, ein SET NULL ist daher nicht möglich: die Löschung wird gesperrt,
-- solange noch Beiträge am Thema hängen.

ALTER TABLE public.social_content_items
  DROP CONSTRAINT IF EXISTS social_content_items_topic_backlog_id_fkey;

ALTER TABLE public.social_content_items
  ADD CONSTRAINT social_content_items_topic_backlog_id_fkey
  FOREIGN KEY (topic_backlog_id) REFERENCES public.topic_backlog(id) ON DELETE RESTRICT;

COMMENT ON CONSTRAINT social_content_items_topic_backlog_id_fkey ON public.social_content_items
  IS 'Beiträge hängen verbindlich am Thema; das Thema kann erst gelöscht werden, wenn keine Beiträge mehr verknüpft sind.';
