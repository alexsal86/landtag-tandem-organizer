-- Enable real-time for notifications table
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Add notification table to real-time publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Check for duplicate triggers and clean them up
DROP TRIGGER IF EXISTS handle_knowledge_document_notifications_trigger ON public.knowledge_documents;