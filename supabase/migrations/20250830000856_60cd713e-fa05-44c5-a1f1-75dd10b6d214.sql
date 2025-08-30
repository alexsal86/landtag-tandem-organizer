-- Create letter_collaborators table for reviewer assignments
CREATE TABLE public.letter_collaborators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  letter_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'reviewer',
  can_edit boolean NOT NULL DEFAULT true,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.letter_collaborators ENABLE ROW LEVEL SECURITY;

-- Create policies for letter collaborators
CREATE POLICY "Users can view collaborators for accessible letters" 
ON public.letter_collaborators 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.letters l 
    WHERE l.id = letter_collaborators.letter_id 
    AND (
      l.created_by = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.letter_collaborators lc 
        WHERE lc.letter_id = l.id AND lc.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Letter creators can manage collaborators" 
ON public.letter_collaborators 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.letters l 
    WHERE l.id = letter_collaborators.letter_id AND l.created_by = auth.uid()
  )
);

-- Create trigger for updating timestamps
CREATE TRIGGER update_letter_collaborators_updated_at
BEFORE UPDATE ON public.letter_collaborators
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();