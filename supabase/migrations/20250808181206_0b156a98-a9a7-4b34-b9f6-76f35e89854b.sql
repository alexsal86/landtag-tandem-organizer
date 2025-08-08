-- 1) Add carry_over_days for vacation carry-over
ALTER TABLE public.employee_settings
ADD COLUMN IF NOT EXISTS carry_over_days integer NOT NULL DEFAULT 0;

-- 2) Auto-calculate minutes from start/end in time_entries
CREATE OR REPLACE FUNCTION public.time_entries_set_minutes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.started_at IS NOT NULL AND NEW.ended_at IS NOT NULL THEN
    IF NEW.ended_at < NEW.started_at THEN
      RAISE EXCEPTION 'ended_at cannot be earlier than started_at';
    END IF;
    NEW.minutes := CEIL(EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) / 60.0)::int;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_time_entries_set_minutes ON public.time_entries;
CREATE TRIGGER trg_time_entries_set_minutes
BEFORE INSERT OR UPDATE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.time_entries_set_minutes();

-- 3) Validate contract file: PDF-only and <= 10 MB, reading from storage.objects if present
CREATE OR REPLACE FUNCTION public.validate_contract_file()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  obj RECORD;
  size_bytes bigint;
  mime_guess text;
BEGIN
  IF NEW.contract_file_path IS NULL THEN
    RETURN NEW;
  END IF;

  -- Enforce .pdf extension quickly
  IF RIGHT(LOWER(NEW.contract_file_path), 4) <> '.pdf' THEN
    RAISE EXCEPTION 'Contract file must be a PDF (.pdf)';
  END IF;

  -- Try to read the object (may not exist yet during first save)
  SELECT o.* INTO obj
  FROM storage.objects o
  WHERE o.bucket_id = 'documents' AND o.name = NEW.contract_file_path
  LIMIT 1;

  IF FOUND THEN
    -- Best-effort size detection across potential metadata keys
    size_bytes := COALESCE(
      NULLIF((obj.metadata->>'size'), '')::bigint,
      NULLIF((obj.metadata->>'contentLength'), '')::bigint,
      NULLIF((obj.metadata->'httpMetadata'->>'content_length'), '')::bigint,
      NULLIF((obj.metadata->>'cacheControl'), '')::bigint,  -- unlikely but fallback
      0
    );

    IF size_bytes > 10485760 THEN -- 10 MB
      RAISE EXCEPTION 'Contract file exceeds 10 MB';
    END IF;

    -- Best-effort mime detection
    mime_guess := LOWER(COALESCE(
      obj.metadata->>'mimetype',
      obj.metadata->>'contentType',
      obj.metadata->'httpMetadata'->>'content_type'
    ));

    IF mime_guess IS NOT NULL AND mime_guess NOT LIKE 'application/pdf%' THEN
      RAISE EXCEPTION 'Contract file must be PDF';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employee_settings_validate_contract ON public.employee_settings;
CREATE TRIGGER trg_employee_settings_validate_contract
BEFORE INSERT OR UPDATE OF contract_file_path ON public.employee_settings
FOR EACH ROW
EXECUTE FUNCTION public.validate_contract_file();

-- 4) Helper: daily hours = hours_per_month / days_per_month
CREATE OR REPLACE FUNCTION public.get_daily_hours(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT (es.hours_per_month::numeric) / NULLIF(es.days_per_month, 0)
  FROM public.employee_settings es
  WHERE es.user_id = _user_id
  LIMIT 1;
$$;