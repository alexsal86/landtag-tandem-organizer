-- Anrede-Override und Abschlussformel fuer Briefe
ALTER TABLE letters ADD COLUMN IF NOT EXISTS salutation_override TEXT;
ALTER TABLE letters ADD COLUMN IF NOT EXISTS closing_formula TEXT;
ALTER TABLE letters ADD COLUMN IF NOT EXISTS closing_name TEXT;