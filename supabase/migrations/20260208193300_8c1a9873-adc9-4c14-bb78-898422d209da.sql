
-- Step 1: Add visibility column to case_files
ALTER TABLE public.case_files 
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';

-- Migrate existing data based on is_private
UPDATE public.case_files SET visibility = CASE 
  WHEN is_private = true THEN 'private'
  ELSE 'public' 
END;

-- Step 2: Create case_file_participants table
CREATE TABLE IF NOT EXISTS public.case_file_participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_file_id uuid NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  created_at timestamptz DEFAULT now(),
  UNIQUE(case_file_id, user_id)
);

-- Enable RLS
ALTER TABLE public.case_file_participants ENABLE ROW LEVEL SECURITY;

-- RLS policies for case_file_participants
CREATE POLICY "Users can view participants of their tenant case files"
  ON public.case_file_participants FOR SELECT
  USING (
    case_file_id IN (
      SELECT cf.id FROM public.case_files cf
      WHERE cf.tenant_id IN (
        SELECT utm.tenant_id FROM public.user_tenant_memberships utm
        WHERE utm.user_id = auth.uid() AND utm.is_active = true
      )
    )
  );

CREATE POLICY "Case file owners can insert participants"
  ON public.case_file_participants FOR INSERT
  WITH CHECK (
    case_file_id IN (
      SELECT id FROM public.case_files WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Case file owners can update participants"
  ON public.case_file_participants FOR UPDATE
  USING (
    case_file_id IN (
      SELECT id FROM public.case_files WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Case file owners can delete participants"
  ON public.case_file_participants FOR DELETE
  USING (
    case_file_id IN (
      SELECT id FROM public.case_files WHERE user_id = auth.uid()
    )
  );

-- Step 3: Update RLS policy for case_files SELECT to include visibility logic
-- First check what policies exist and drop the relevant SELECT one
DO $$
BEGIN
  -- Try to drop common policy names
  BEGIN
    DROP POLICY IF EXISTS "Users can view case files in their tenant" ON public.case_files;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    DROP POLICY IF EXISTS "Users can view their tenant case files" ON public.case_files;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    DROP POLICY IF EXISTS "Tenant members can view case files" ON public.case_files;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Create new visibility-aware SELECT policy
CREATE POLICY "Users can view accessible case files"
  ON public.case_files FOR SELECT
  USING (
    tenant_id IN (
      SELECT utm.tenant_id FROM public.user_tenant_memberships utm
      WHERE utm.user_id = auth.uid() AND utm.is_active = true
    )
    AND (
      visibility = 'public'
      OR user_id = auth.uid()
      OR id IN (SELECT cfp.case_file_id FROM public.case_file_participants cfp WHERE cfp.user_id = auth.uid())
    )
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_case_file_participants_user_id ON public.case_file_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_case_file_participants_case_file_id ON public.case_file_participants(case_file_id);
CREATE INDEX IF NOT EXISTS idx_case_files_visibility ON public.case_files(visibility);
