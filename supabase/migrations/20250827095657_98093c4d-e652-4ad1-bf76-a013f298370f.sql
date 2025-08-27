-- Create decision email templates table
CREATE TABLE public.decision_email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  subject TEXT NOT NULL DEFAULT 'Entscheidungsanfrage',
  greeting TEXT NOT NULL DEFAULT 'Hallo {participant_name},',
  introduction TEXT NOT NULL DEFAULT 'Sie wurden zu einer Entscheidung bezüglich einer Aufgabe eingeladen.',
  instruction TEXT NOT NULL DEFAULT 'Bitte wählen Sie eine der folgenden Optionen:',
  question_prompt TEXT NOT NULL DEFAULT 'Falls Sie Fragen haben, können Sie diese hier stellen:',
  closing TEXT NOT NULL DEFAULT 'Vielen Dank für Ihre Teilnahme!',
  signature TEXT NOT NULL DEFAULT 'Ihr Team',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on decision email templates
ALTER TABLE public.decision_email_templates ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for decision email templates
CREATE POLICY "Tenant admins can manage decision email templates"
ON public.decision_email_templates
FOR ALL
USING (is_tenant_admin(auth.uid(), tenant_id));

-- Add token field to task_decision_participants for email responses
ALTER TABLE public.task_decision_participants 
ADD COLUMN IF NOT EXISTS token TEXT;

-- Create function to generate unique tokens for decision participants
CREATE OR REPLACE FUNCTION public.generate_decision_participant_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  token_candidate text;
  token_exists boolean;
BEGIN
  LOOP
    -- Use gen_random_uuid and convert to string for uniqueness
    token_candidate := replace(gen_random_uuid()::text, '-', '') || 
                      replace(gen_random_uuid()::text, '-', '');
    
    SELECT EXISTS(
      SELECT 1 FROM public.task_decision_participants 
      WHERE token = token_candidate
    ) INTO token_exists;
    
    IF NOT token_exists THEN
      RETURN token_candidate;
    END IF;
  END LOOP;
END;
$$;

-- Create trigger to auto-generate tokens for new participants
CREATE OR REPLACE FUNCTION public.set_decision_participant_token()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.token IS NULL THEN
    NEW.token := public.generate_decision_participant_token();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_decision_participant_token
  BEFORE INSERT ON public.task_decision_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_decision_participant_token();

-- Create default email template for existing tenants
INSERT INTO public.decision_email_templates (tenant_id)
SELECT DISTINCT tenant_id FROM public.profiles
ON CONFLICT DO NOTHING;

-- Add updated_at trigger to decision_email_templates
CREATE TRIGGER update_decision_email_templates_updated_at
  BEFORE UPDATE ON public.decision_email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();