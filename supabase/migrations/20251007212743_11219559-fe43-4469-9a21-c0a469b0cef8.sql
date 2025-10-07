-- Enable realtime for user_status table
ALTER TABLE public.user_status REPLICA IDENTITY FULL;

-- Add table to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'user_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_status;
  END IF;
END $$;