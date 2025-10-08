-- Add new columns to email_logs for personalization and error handling
ALTER TABLE email_logs 
ADD COLUMN IF NOT EXISTS personalization_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS failed_recipients JSONB DEFAULT '[]';