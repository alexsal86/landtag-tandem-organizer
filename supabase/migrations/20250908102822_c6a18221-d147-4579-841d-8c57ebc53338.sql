-- Add collaboration support to knowledge_documents
ALTER TABLE public.knowledge_documents 
ADD COLUMN IF NOT EXISTS yjs_state TEXT,
ADD COLUMN IF NOT EXISTS document_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_editor_id UUID,
ADD COLUMN IF NOT EXISTS editing_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_being_edited BOOLEAN DEFAULT FALSE;

-- Create knowledge_document_snapshots table for version history
CREATE TABLE IF NOT EXISTS public.knowledge_document_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  yjs_state TEXT NOT NULL,
  document_version INTEGER NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  snapshot_type TEXT NOT NULL DEFAULT 'auto' CHECK (snapshot_type IN ('auto', 'manual', 'backup'))
);

-- Create knowledge_document_collaborators table for active editing sessions
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

-- Enable RLS on new tables
ALTER TABLE public.knowledge_document_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_document_collaborators ENABLE ROW LEVEL SECURITY;

-- RLS policies for snapshots
CREATE POLICY "Users can view snapshots for accessible documents" 
ON public.knowledge_document_snapshots FOR SELECT 
USING (can_access_knowledge_document(document_id, auth.uid()));

CREATE POLICY "Users can create snapshots for editable documents" 
ON public.knowledge_document_snapshots FOR INSERT 
WITH CHECK (can_edit_knowledge_document(document_id, auth.uid()) AND created_by = auth.uid());

-- RLS policies for collaborators
CREATE POLICY "Users can view collaborators for accessible documents" 
ON public.knowledge_document_collaborators FOR SELECT 
USING (can_access_knowledge_document(document_id, auth.uid()));

CREATE POLICY "Users can manage their own collaboration sessions" 
ON public.knowledge_document_collaborators FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_document_snapshots_document_id ON public.knowledge_document_snapshots(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_document_snapshots_created_at ON public.knowledge_document_snapshots(created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_document_collaborators_document_id ON public.knowledge_document_collaborators(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_document_collaborators_user_active ON public.knowledge_document_collaborators(user_id, is_active);

-- Create trigger to update document version when yjs_state changes
CREATE OR REPLACE FUNCTION public.update_document_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.yjs_state IS DISTINCT FROM NEW.yjs_state THEN
    NEW.document_version = COALESCE(OLD.document_version, 1) + 1;
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_knowledge_document_version
  BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_document_version();

-- Enable realtime for collaboration tables
ALTER TABLE public.knowledge_document_collaborators REPLICA IDENTITY FULL;
ALTER TABLE public.knowledge_documents REPLICA IDENTITY FULL;