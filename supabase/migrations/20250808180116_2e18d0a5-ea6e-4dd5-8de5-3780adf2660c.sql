-- Retry migration with corrected catalog references (pg_policies.policyname)

-- 1) Erweiterungen an employee_settings für moderne Mitarbeiterverwaltung
ALTER TABLE public.employee_settings
  ADD COLUMN IF NOT EXISTS hours_per_month integer NOT NULL DEFAULT 160,
  ADD COLUMN IF NOT EXISTS days_per_month integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS annual_vacation_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS work_location text,
  ADD COLUMN IF NOT EXISTS contract_file_path text,
  ADD COLUMN IF NOT EXISTS employment_start_date date;

-- 2) Zeiterfassungstabelle
CREATE TABLE IF NOT EXISTS public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  work_date date NOT NULL,
  minutes integer NOT NULL CHECK (minutes >= 0),
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS aktivieren
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Trigger für updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_time_entries_updated_at'
  ) THEN
    CREATE TRIGGER update_time_entries_updated_at
    BEFORE UPDATE ON public.time_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Policies: Nutzer und deren Admin können alles sehen/bearbeiten
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'time_entries_select_scoped'
  ) THEN
    CREATE POLICY time_entries_select_scoped ON public.time_entries
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin_of(user_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'time_entries_insert_scoped'
  ) THEN
    CREATE POLICY time_entries_insert_scoped ON public.time_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin_of(user_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'time_entries_update_scoped'
  ) THEN
    CREATE POLICY time_entries_update_scoped ON public.time_entries
    FOR UPDATE USING (auth.uid() = user_id OR public.is_admin_of(user_id))
    WITH CHECK (auth.uid() = user_id OR public.is_admin_of(user_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'time_entries_delete_scoped'
  ) THEN
    CREATE POLICY time_entries_delete_scoped ON public.time_entries
    FOR DELETE USING (auth.uid() = user_id OR public.is_admin_of(user_id));
  END IF;
END $$;

-- Index für schnelle Monats-Abfragen
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON public.time_entries(user_id, work_date);

-- 3) Storage-Policies für Vertrags-Uploads im privaten 'documents'-Bucket
-- Pfadkonvention: documents/{user_id}/contracts/<dateiname>
-- Owner (Mitarbeiter) und der zuständige Admin (public.is_admin_of) haben Zugriff

-- SELECT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND policyname = 'Users and admins can read contract docs'
  ) THEN
    CREATE POLICY "Users and admins can read contract docs" 
    ON storage.objects
    FOR SELECT USING (
      bucket_id = 'documents'
      AND (
        auth.uid()::text = (storage.foldername(name))[1]
        OR public.is_admin_of(((storage.foldername(name))[1])::uuid)
      )
    );
  END IF;
END $$;

-- INSERT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND policyname = 'Users and admins can upload contract docs'
  ) THEN
    CREATE POLICY "Users and admins can upload contract docs" 
    ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'documents'
      AND (
        auth.uid()::text = (storage.foldername(name))[1]
        OR public.is_admin_of(((storage.foldername(name))[1])::uuid)
      )
    );
  END IF;
END $$;

-- UPDATE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND policyname = 'Users and admins can update contract docs'
  ) THEN
    CREATE POLICY "Users and admins can update contract docs" 
    ON storage.objects
    FOR UPDATE USING (
      bucket_id = 'documents'
      AND (
        auth.uid()::text = (storage.foldername(name))[1]
        OR public.is_admin_of(((storage.foldername(name))[1])::uuid)
      )
    )
    WITH CHECK (
      bucket_id = 'documents'
      AND (
        auth.uid()::text = (storage.foldername(name))[1]
        OR public.is_admin_of(((storage.foldername(name))[1])::uuid)
      )
    );
  END IF;
END $$;

-- DELETE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND policyname = 'Users and admins can delete contract docs'
  ) THEN
    CREATE POLICY "Users and admins can delete contract docs" 
    ON storage.objects
    FOR DELETE USING (
      bucket_id = 'documents'
      AND (
        auth.uid()::text = (storage.foldername(name))[1]
        OR public.is_admin_of(((storage.foldername(name))[1])::uuid)
      )
    );
  END IF;
END $$;
