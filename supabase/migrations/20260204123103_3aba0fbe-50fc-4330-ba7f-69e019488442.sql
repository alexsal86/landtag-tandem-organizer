-- Create table for decision comments (separate from responses)
CREATE TABLE public.task_decision_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES public.task_decisions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.task_decision_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_task_decision_comments_decision ON public.task_decision_comments(decision_id);
CREATE INDEX idx_task_decision_comments_parent ON public.task_decision_comments(parent_id);
CREATE INDEX idx_task_decision_comments_user ON public.task_decision_comments(user_id);

-- Enable RLS
ALTER TABLE public.task_decision_comments ENABLE ROW LEVEL SECURITY;

-- Create a security definer function to check decision access
CREATE OR REPLACE FUNCTION public.can_access_decision(p_decision_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.task_decisions td
    WHERE td.id = p_decision_id
    AND (
      td.created_by = p_user_id
      OR td.visible_to_all = true
      OR EXISTS (
        SELECT 1 FROM public.task_decision_participants tdp
        WHERE tdp.decision_id = td.id AND tdp.user_id = p_user_id
      )
    )
  );
END;
$$;

-- RLS Policy: Select - Users can view comments if they have access to the decision
CREATE POLICY "Users can view comments on accessible decisions"
  ON public.task_decision_comments FOR SELECT
  USING (public.can_access_decision(decision_id, auth.uid()));

-- RLS Policy: Insert - Users can insert comments if they have access to the decision
CREATE POLICY "Users can insert comments on accessible decisions"
  ON public.task_decision_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_access_decision(decision_id, auth.uid())
  );

-- RLS Policy: Update - Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON public.task_decision_comments FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: Delete - Users can delete own comments or decision creator can delete any
CREATE POLICY "Users can delete comments"
  ON public.task_decision_comments FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.task_decisions td
      WHERE td.id = decision_id AND td.created_by = auth.uid()
    )
  );

-- Add parent_response_id to task_decision_responses for nested responses
ALTER TABLE public.task_decision_responses 
ADD COLUMN IF NOT EXISTS parent_response_id UUID REFERENCES public.task_decision_responses(id) ON DELETE CASCADE;

-- Create index for nested responses
CREATE INDEX IF NOT EXISTS idx_task_decision_responses_parent ON public.task_decision_responses(parent_response_id);

-- Trigger for updated_at
CREATE TRIGGER update_task_decision_comments_updated_at
  BEFORE UPDATE ON public.task_decision_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();