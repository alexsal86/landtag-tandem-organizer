-- Add tenant-wide public visibility for case items

ALTER TABLE public.case_items
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_case_items_tenant_public
  ON public.case_items (tenant_id, is_public);

CREATE OR REPLACE FUNCTION public.user_can_access_case_item(_user_id uuid, _case_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.case_items ci
    WHERE ci.id = _case_item_id
      AND ci.tenant_id = ANY(public.get_user_tenant_ids(_user_id))
      AND (
        ci.is_public = true
        OR ci.user_id = _user_id
        OR ci.owner_user_id = _user_id
        OR EXISTS (
          SELECT 1
          FROM public.case_item_participants cip
          WHERE cip.case_item_id = ci.id
            AND cip.user_id = _user_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.case_files cf
          WHERE cf.id = ci.case_file_id
            AND (
              cf.user_id = _user_id
              OR cf.visibility = 'public'
              OR EXISTS (
                SELECT 1
                FROM public.case_file_participants cfp
                WHERE cfp.case_file_id = cf.id
                  AND cfp.user_id = _user_id
              )
            )
        )
      )
  );
$$;
