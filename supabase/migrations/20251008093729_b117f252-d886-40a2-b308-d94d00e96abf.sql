-- Create task_decision_attachments table
CREATE TABLE public.task_decision_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  decision_id UUID NOT NULL REFERENCES public.task_decisions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_decision_attachments_decision_id ON public.task_decision_attachments(decision_id);
CREATE INDEX idx_decision_attachments_uploaded_by ON public.task_decision_attachments(uploaded_by);

-- Enable RLS
ALTER TABLE public.task_decision_attachments ENABLE ROW LEVEL SECURITY;

-- Users can view attachments of decisions they participate in
CREATE POLICY "Users can view attachments of decisions they participate in"
  ON public.task_decision_attachments
  FOR SELECT
  USING (
    user_can_access_task_decision(decision_id, auth.uid())
  );

-- Users can upload attachments to decisions they participate in
CREATE POLICY "Users can upload attachments to decisions they participate in"
  ON public.task_decision_attachments
  FOR INSERT
  WITH CHECK (
    user_can_access_task_decision(decision_id, auth.uid())
    AND uploaded_by = auth.uid()
  );

-- Users can delete their own attachments or creator can delete all
CREATE POLICY "Users can delete their own attachments or creator can delete all"
  ON public.task_decision_attachments
  FOR DELETE
  USING (
    uploaded_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.task_decisions td
      WHERE td.id = decision_id AND td.created_by = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_task_decision_attachments_updated_at
BEFORE UPDATE ON public.task_decision_attachments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();