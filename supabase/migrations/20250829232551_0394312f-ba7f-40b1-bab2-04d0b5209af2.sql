-- First, let me check the structure of letter_collaborators table and fix the policies
-- Drop existing problematic RLS policies on letters table
DROP POLICY IF EXISTS "Users can view letters in their tenant" ON public.letters;
DROP POLICY IF EXISTS "Users can create letters in their tenant" ON public.letters;
DROP POLICY IF EXISTS "Users can update accessible letters" ON public.letters;
DROP POLICY IF EXISTS "Users can delete their own letters" ON public.letters;

-- Create simplified, safe RLS policies for letters table
CREATE POLICY "Users can view letters in their tenant" 
ON public.letters FOR SELECT 
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

CREATE POLICY "Users can create letters in their tenant" 
ON public.letters FOR INSERT 
WITH CHECK (
  tenant_id = ANY (get_user_tenant_ids(auth.uid())) 
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update their own letters" 
ON public.letters FOR UPDATE 
USING (
  tenant_id = ANY (get_user_tenant_ids(auth.uid())) 
  AND created_by = auth.uid()
);

CREATE POLICY "Users can delete their own letters" 
ON public.letters FOR DELETE 
USING (
  tenant_id = ANY (get_user_tenant_ids(auth.uid())) 
  AND created_by = auth.uid()
);