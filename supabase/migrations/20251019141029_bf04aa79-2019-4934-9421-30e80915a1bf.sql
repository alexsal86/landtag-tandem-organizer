-- Drop the old CHECK constraint that limits category values
-- This allows flexible category management through the document_categories table
ALTER TABLE public.documents 
DROP CONSTRAINT IF EXISTS documents_category_check;