-- Add content_html column to knowledge_documents table for HTML content
ALTER TABLE public.knowledge_documents 
ADD COLUMN content_html TEXT;

-- Update existing records to have empty HTML content
UPDATE public.knowledge_documents 
SET content_html = '' 
WHERE content_html IS NULL;