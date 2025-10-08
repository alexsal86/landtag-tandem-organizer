-- Create history table for tracking decision response changes
CREATE TABLE public.task_decision_response_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id UUID NOT NULL REFERENCES public.task_decision_responses(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES public.task_decisions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.task_decision_participants(id) ON DELETE CASCADE,
  response_type TEXT NOT NULL CHECK (response_type IN ('yes', 'no', 'question')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by UUID REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX idx_response_history_response_id ON public.task_decision_response_history(response_id);
CREATE INDEX idx_response_history_participant_id ON public.task_decision_response_history(participant_id);
CREATE INDEX idx_response_history_decision_id ON public.task_decision_response_history(decision_id);

-- Enable RLS
ALTER TABLE public.task_decision_response_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view history of decisions they participate in or created
CREATE POLICY "Users can view history of their decisions"
  ON public.task_decision_response_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.task_decision_participants tdp
      WHERE tdp.id = task_decision_response_history.participant_id
      AND tdp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.task_decisions td
      WHERE td.id = task_decision_response_history.decision_id
      AND td.created_by = auth.uid()
    )
  );

-- Policy: System and authenticated users can insert history entries
CREATE POLICY "Authenticated users can insert history"
  ON public.task_decision_response_history
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND 
    (changed_by = auth.uid() OR changed_by IS NULL)
  );

-- Trigger function to automatically log response changes
CREATE OR REPLACE FUNCTION public.log_decision_response_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log on INSERT or when response_type changes
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.response_type IS DISTINCT FROM NEW.response_type) THEN
    INSERT INTO public.task_decision_response_history (
      response_id,
      decision_id,
      participant_id,
      response_type,
      comment,
      changed_by
    ) VALUES (
      NEW.id,
      NEW.decision_id,
      NEW.participant_id,
      NEW.response_type,
      NEW.comment,
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on task_decision_responses
CREATE TRIGGER trigger_log_response_change
AFTER INSERT OR UPDATE ON public.task_decision_responses
FOR EACH ROW
EXECUTE FUNCTION public.log_decision_response_change();