-- Create letter workflow history table
CREATE TABLE public.letter_workflow_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  letter_id UUID NOT NULL,
  status_from TEXT NOT NULL,
  status_to TEXT NOT NULL,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  additional_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.letter_workflow_history ENABLE ROW LEVEL SECURITY;

-- Create policies for workflow history
CREATE POLICY "Users can view workflow history for accessible letters" 
ON public.letter_workflow_history 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM letters l 
  WHERE l.id = letter_workflow_history.letter_id 
  AND l.tenant_id = ANY (get_user_tenant_ids(auth.uid()))
));

CREATE POLICY "Users can create workflow history entries" 
ON public.letter_workflow_history 
FOR INSERT 
WITH CHECK (changed_by = auth.uid());

-- Update letters table to add archived_document_id
ALTER TABLE public.letters ADD COLUMN archived_document_id UUID;

-- Create function to log workflow changes
CREATE OR REPLACE FUNCTION public.log_letter_workflow_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.letter_workflow_history (
      letter_id,
      status_from,
      status_to,
      changed_by,
      notes,
      additional_data
    ) VALUES (
      NEW.id,
      COALESCE(OLD.status, 'created'),
      NEW.status,
      auth.uid(),
      NULL, -- Notes can be added separately if needed
      jsonb_build_object(
        'sent_method', NEW.sent_method,
        'sent_date', NEW.sent_date,
        'reviewer_id', NEW.reviewer_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;