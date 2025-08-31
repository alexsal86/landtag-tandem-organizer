-- Add archived_document_id column to letters table
ALTER TABLE letters ADD COLUMN archived_document_id uuid REFERENCES documents(id);