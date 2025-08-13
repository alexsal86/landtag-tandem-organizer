-- Enable realtime for knowledge_documents table
ALTER TABLE public.knowledge_documents REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.knowledge_documents;