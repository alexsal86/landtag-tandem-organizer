-- Create task decisions table
CREATE TABLE public.task_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  subtask_id UUID NULL, -- For future subtask support
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived_at TIMESTAMP WITH TIME ZONE,
  archived_by UUID
);

-- Create task decision participants table
CREATE TABLE public.task_decision_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  decision_id UUID NOT NULL REFERENCES public.task_decisions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  token TEXT UNIQUE DEFAULT gen_random_uuid()::text
);

-- Create task decision responses table
CREATE TABLE public.task_decision_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  decision_id UUID NOT NULL REFERENCES public.task_decisions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.task_decision_participants(id) ON DELETE CASCADE,
  response_type TEXT NOT NULL CHECK (response_type IN ('yes', 'no', 'question')),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_decision_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_decision_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_decisions
CREATE POLICY "Users can view accessible task decisions" ON public.task_decisions
FOR SELECT USING (
  created_by = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.task_decision_participants tdp 
    WHERE tdp.decision_id = task_decisions.id AND tdp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create task decisions" ON public.task_decisions
FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators can update their task decisions" ON public.task_decisions
FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Creators can delete their task decisions" ON public.task_decisions
FOR DELETE USING (created_by = auth.uid());

-- RLS Policies for task_decision_participants
CREATE POLICY "Users can view participants of accessible decisions" ON public.task_decision_participants
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.task_decisions td 
    WHERE td.id = task_decision_participants.decision_id AND 
    (td.created_by = auth.uid() OR user_id = auth.uid())
  )
);

CREATE POLICY "Decision creators can manage participants" ON public.task_decision_participants
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.task_decisions td 
    WHERE td.id = task_decision_participants.decision_id AND td.created_by = auth.uid()
  )
);

-- RLS Policies for task_decision_responses
CREATE POLICY "Users can view responses for accessible decisions" ON public.task_decision_responses
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.task_decisions td 
    JOIN public.task_decision_participants tdp ON tdp.decision_id = td.id
    WHERE td.id = task_decision_responses.decision_id AND 
    (td.created_by = auth.uid() OR tdp.user_id = auth.uid())
  )
);

CREATE POLICY "Participants can create their responses" ON public.task_decision_responses
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.task_decision_participants tdp 
    WHERE tdp.id = task_decision_responses.participant_id AND tdp.user_id = auth.uid()
  )
);

CREATE POLICY "Participants can update their responses" ON public.task_decision_responses
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.task_decision_participants tdp 
    WHERE tdp.id = task_decision_responses.participant_id AND tdp.user_id = auth.uid()
  )
);

-- Add updated_at trigger for task_decisions
CREATE TRIGGER update_task_decisions_updated_at
  BEFORE UPDATE ON public.task_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for task_decision_responses
CREATE TRIGGER update_task_decision_responses_updated_at
  BEFORE UPDATE ON public.task_decision_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_task_decisions_task_id ON public.task_decisions(task_id);
CREATE INDEX idx_task_decisions_created_by ON public.task_decisions(created_by);
CREATE INDEX idx_task_decisions_status ON public.task_decisions(status);
CREATE INDEX idx_task_decision_participants_decision_id ON public.task_decision_participants(decision_id);
CREATE INDEX idx_task_decision_participants_user_id ON public.task_decision_participants(user_id);
CREATE INDEX idx_task_decision_responses_decision_id ON public.task_decision_responses(decision_id);
CREATE INDEX idx_task_decision_responses_participant_id ON public.task_decision_responses(participant_id);