DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'case_item_status_v2'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.case_item_status_v2 AS ENUM ('neu', 'in_klaerung', 'antwort_ausstehend', 'erledigt');
  END IF;
END $$;

ALTER TABLE public.case_items
  ADD COLUMN IF NOT EXISTS completion_note text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE public.case_items
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.case_items
  ALTER COLUMN status TYPE public.case_item_status_v2
  USING (
    CASE status::text
      WHEN 'active' THEN 'neu'::public.case_item_status_v2
      WHEN 'pending' THEN 'in_klaerung'::public.case_item_status_v2
      WHEN 'closed' THEN 'erledigt'::public.case_item_status_v2
      WHEN 'archived' THEN 'erledigt'::public.case_item_status_v2
      ELSE 'neu'::public.case_item_status_v2
    END
  );

ALTER TABLE public.case_items
  ALTER COLUMN status SET DEFAULT 'neu'::public.case_item_status_v2;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'case_item_status'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    DROP TYPE public.case_item_status;
  END IF;
END $$;

ALTER TYPE public.case_item_status_v2 RENAME TO case_item_status;

ALTER TABLE public.case_items
  DROP CONSTRAINT IF EXISTS case_items_completion_required_when_done;

ALTER TABLE public.case_items
  ADD CONSTRAINT case_items_completion_required_when_done
  CHECK (
    status <> 'erledigt'
    OR (
      nullif(trim(completion_note), '') IS NOT NULL
      AND completed_at IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION public.audit_case_item_lifecycle_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_log_entries (tenant_id, user_id, payload)
    VALUES (
      NEW.tenant_id,
      auth.uid(),
      jsonb_build_object(
        'entity', 'case_item',
        'action', 'status_changed',
        'case_item_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );

    IF NEW.status = 'erledigt' THEN
      INSERT INTO public.audit_log_entries (tenant_id, user_id, payload)
      VALUES (
        NEW.tenant_id,
        auth.uid(),
        jsonb_build_object(
          'entity', 'case_item',
          'action', 'closed',
          'case_item_id', NEW.id,
          'closed_status', NEW.status
        )
      );
    END IF;
  END IF;

  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    INSERT INTO public.audit_log_entries (tenant_id, user_id, payload)
    VALUES (
      NEW.tenant_id,
      auth.uid(),
      jsonb_build_object(
        'entity', 'case_item',
        'action', 'owner_changed',
        'case_item_id', NEW.id,
        'old_owner_user_id', OLD.owner_user_id,
        'new_owner_user_id', NEW.owner_user_id
      )
    );
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority
     AND NEW.priority = 'urgent' THEN
    INSERT INTO public.audit_log_entries (tenant_id, user_id, payload)
    VALUES (
      NEW.tenant_id,
      auth.uid(),
      jsonb_build_object(
        'entity', 'case_item',
        'action', 'escalated',
        'case_item_id', NEW.id,
        'old_priority', OLD.priority,
        'new_priority', NEW.priority
      )
    );
  END IF;

  RETURN NEW;
END;
$$;
