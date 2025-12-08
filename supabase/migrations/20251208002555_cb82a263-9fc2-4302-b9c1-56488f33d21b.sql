-- Add is_locked field to knowledge_documents
ALTER TABLE public.knowledge_documents 
ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- Create knowledge_document_topics junction table
CREATE TABLE IF NOT EXISTS public.knowledge_document_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(document_id, topic_id)
);

-- Enable RLS
ALTER TABLE public.knowledge_document_topics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for knowledge_document_topics
CREATE POLICY "Users can view knowledge document topics within their tenant" 
ON public.knowledge_document_topics 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.knowledge_documents kd 
    WHERE kd.id = document_id 
    AND kd.tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage topics for their own documents" 
ON public.knowledge_document_topics 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.knowledge_documents kd 
    WHERE kd.id = document_id 
    AND kd.created_by = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_document_topics_document_id 
ON public.knowledge_document_topics(document_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_document_topics_topic_id 
ON public.knowledge_document_topics(topic_id);