CREATE TABLE IF NOT EXISTS public.task_decision_comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.task_decision_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_decision_comment_reactions_comment_user_emoji_key UNIQUE (comment_id, user_id, emoji)
);

ALTER TABLE public.task_decision_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view decision comment reactions"
ON public.task_decision_comment_reactions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert own decision comment reactions"
ON public.task_decision_comment_reactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own decision comment reactions"
ON public.task_decision_comment_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
