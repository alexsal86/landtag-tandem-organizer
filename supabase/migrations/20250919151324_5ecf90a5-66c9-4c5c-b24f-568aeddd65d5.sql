-- Add content_nodes field for JSON serialization of Lexical content
ALTER TABLE public.letters 
ADD COLUMN content_nodes JSONB;