-- Team conversation dates and working hours must invalidate the team overview.
-- Existing row-level security continues to control which changes subscribers see.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'employee_settings'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_settings;
  END IF;
END $$;
