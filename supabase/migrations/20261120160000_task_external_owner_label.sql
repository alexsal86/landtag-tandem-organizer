ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS ball_external_label text;
