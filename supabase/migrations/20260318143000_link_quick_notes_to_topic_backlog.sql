ALTER TABLE public.quick_notes
ADD COLUMN IF NOT EXISTS topic_backlog_id uuid REFERENCES public.topic_backlog(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quick_notes_topic_backlog_id
  ON public.quick_notes(topic_backlog_id)
  WHERE topic_backlog_id IS NOT NULL;

COMMENT ON COLUMN public.quick_notes.topic_backlog_id
  IS 'Optional link to a topic_backlog entry when a Quick Note was copied or moved into the Themenspeicher.';
