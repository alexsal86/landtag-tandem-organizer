-- Only add columns that don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_documents' AND column_name = 'yjs_state') THEN
    ALTER TABLE public.knowledge_documents ADD COLUMN yjs_state TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_documents' AND column_name = 'document_version') THEN
    ALTER TABLE public.knowledge_documents ADD COLUMN document_version INTEGER DEFAULT 1;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_documents' AND column_name = 'last_editor_id') THEN
    ALTER TABLE public.knowledge_documents ADD COLUMN last_editor_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_documents' AND column_name = 'editing_started_at') THEN
    ALTER TABLE public.knowledge_documents ADD COLUMN editing_started_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'knowledge_documents' AND column_name = 'is_being_edited') THEN
    ALTER TABLE public.knowledge_documents ADD COLUMN is_being_edited BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Create collaborators table only if it doesn't exist
CREATE TABLE IF NOT EXISTS public.knowledge_document_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  cursor_position JSONB,
  selection_state JSONB,
  user_color TEXT,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(document_id, user_id)
);

-- Enable RLS only if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'knowledge_document_collaborators' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.knowledge_document_collaborators ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'knowledge_document_collaborators' 
    AND policyname = 'Users can view collaborators for accessible documents'
  ) THEN
    CREATE POLICY "Users can view collaborators for accessible documents" 
    ON public.knowledge_document_collaborators FOR SELECT 
    USING (can_access_knowledge_document(document_id, auth.uid()));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'knowledge_document_collaborators' 
    AND policyname = 'Users can manage their own collaboration sessions'
  ) THEN
    CREATE POLICY "Users can manage their own collaboration sessions" 
    ON public.knowledge_document_collaborators FOR ALL 
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Enable realtime
ALTER TABLE public.knowledge_document_collaborators REPLICA IDENTITY FULL;
ALTER TABLE public.knowledge_documents REPLICA IDENTITY FULL;