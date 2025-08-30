-- Fix RLS policies for letter_collaborators table

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view collaborators for accessible letters" ON public.letter_collaborators;
DROP POLICY IF EXISTS "Letter creators can manage collaborators" ON public.letter_collaborators;

-- Create updated policies
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

CREATE POLICY "Letter creators can insert collaborators" 
ON public.letter_collaborators 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.letters l 
    WHERE l.id = letter_collaborators.letter_id AND l.created_by = auth.uid()
  )
);

CREATE POLICY "Letter creators can update collaborators" 
ON public.letter_collaborators 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.letters l 
    WHERE l.id = letter_collaborators.letter_id AND l.created_by = auth.uid()
  )
);

CREATE POLICY "Letter creators can delete collaborators" 
ON public.letter_collaborators 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.letters l 
    WHERE l.id = letter_collaborators.letter_id AND l.created_by = auth.uid()
  )
);