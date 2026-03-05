-- Harden tenant/visibility model for case_items and interaction tables

DO $$
BEGIN
  CREATE TYPE public.case_item_interaction_visibility AS ENUM ('internal', 'team', 'public_to_case_participants');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.case_items
  ADD COLUMN IF NOT EXISTS last_modified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS last_modified_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.case_item_interactions
  ADD COLUMN IF NOT EXISTS visibility public.case_item_interaction_visibility NOT NULL DEFAULT 'team';

UPDATE public.case_item_interactions
SET visibility = 'team'
WHERE visibility IS NULL;

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
        ci.user_id = _user_id
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

CREATE OR REPLACE FUNCTION public.user_can_access_case_item_interaction(
  _user_id uuid,
  _interaction_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.case_item_interactions cii
    JOIN public.case_items ci ON ci.id = cii.case_item_id
    WHERE cii.id = _interaction_id
      AND public.user_can_access_case_item(_user_id, ci.id)
      AND (
        cii.visibility = 'team'
        OR (
          cii.visibility = 'internal'
          AND (
            cii.created_by = _user_id
            OR ci.user_id = _user_id
            OR ci.owner_user_id = _user_id
            OR public.is_tenant_admin(_user_id, ci.tenant_id)
            OR EXISTS (
              SELECT 1
              FROM public.case_item_participants cip
              WHERE cip.case_item_id = ci.id
                AND cip.user_id = _user_id
                AND cip.role IN ('owner', 'editor')
            )
          )
        )
        OR (
          cii.visibility = 'public_to_case_participants'
          AND (
            EXISTS (
              SELECT 1
              FROM public.case_item_participants cip
              WHERE cip.case_item_id = ci.id
                AND cip.user_id = _user_id
            )
            OR EXISTS (
              SELECT 1
              FROM public.case_file_participants cfp
              WHERE cfp.case_file_id = ci.case_file_id
                AND cfp.user_id = _user_id
            )
            OR ci.user_id = _user_id
            OR ci.owner_user_id = _user_id
          )
        )
      )
      AND (
        cii.interaction_type NOT IN ('phone', 'social')
        OR public.has_active_tenant_role(
          _user_id,
          ci.tenant_id,
          ARRAY['abgeordneter', 'bueroleitung', 'mitarbeiter']
        )
      )
  );
$$;

DROP POLICY IF EXISTS "Users can view case items in their tenant" ON public.case_items;
DROP POLICY IF EXISTS "Users can create case items in their tenant" ON public.case_items;
DROP POLICY IF EXISTS "Users can update case items in their tenant" ON public.case_items;
DROP POLICY IF EXISTS "Users can delete own case items in their tenant" ON public.case_items;

CREATE POLICY "Users can view accessible case items"
ON public.case_items FOR SELECT
USING (public.user_can_access_case_item(auth.uid(), id));

CREATE POLICY "Users can create case items in tenant"
ON public.case_items FOR INSERT
WITH CHECK (
  tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))
  AND user_id = auth.uid()
);

CREATE POLICY "Users can update accessible case items"
ON public.case_items FOR UPDATE
USING (public.user_can_access_case_item(auth.uid(), id))
WITH CHECK (
  tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))
  AND public.user_can_access_case_item(auth.uid(), id)
);

CREATE POLICY "Users can delete own case items"
ON public.case_items FOR DELETE
USING (
  tenant_id = ANY (public.get_user_tenant_ids(auth.uid()))
  AND user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can manage case item interactions in their tenant" ON public.case_item_interactions;

CREATE POLICY "Users can view allowed case item interactions"
ON public.case_item_interactions FOR SELECT
USING (public.user_can_access_case_item_interaction(auth.uid(), id));

CREATE POLICY "Users can insert allowed case item interactions"
ON public.case_item_interactions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.case_items ci
    WHERE ci.id = case_item_interactions.case_item_id
      AND ci.tenant_id = case_item_interactions.tenant_id
      AND public.user_can_access_case_item(auth.uid(), ci.id)
      AND (
        case_item_interactions.interaction_type NOT IN ('phone', 'social')
        OR public.has_active_tenant_role(
          auth.uid(),
          ci.tenant_id,
          ARRAY['abgeordneter', 'bueroleitung', 'mitarbeiter']
        )
      )
  )
);

CREATE POLICY "Users can update allowed case item interactions"
ON public.case_item_interactions FOR UPDATE
USING (public.user_can_access_case_item_interaction(auth.uid(), id))
WITH CHECK (public.user_can_access_case_item_interaction(auth.uid(), id));

CREATE POLICY "Users can delete own case item interactions"
ON public.case_item_interactions FOR DELETE
USING (
  public.user_can_access_case_item_interaction(auth.uid(), id)
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "Users can manage case item participants in their tenant" ON public.case_item_participants;

CREATE POLICY "Users can view case item participants"
ON public.case_item_participants FOR SELECT
USING (
  public.user_can_access_case_item(auth.uid(), case_item_id)
);

CREATE POLICY "Owners and tenant admins can manage case item participants"
ON public.case_item_participants FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.case_items ci
    WHERE ci.id = case_item_participants.case_item_id
      AND ci.tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
      AND (
        ci.user_id = auth.uid()
        OR ci.owner_user_id = auth.uid()
        OR public.is_tenant_admin(auth.uid(), ci.tenant_id)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.case_items ci
    WHERE ci.id = case_item_participants.case_item_id
      AND ci.tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
      AND (
        ci.user_id = auth.uid()
        OR ci.owner_user_id = auth.uid()
        OR public.is_tenant_admin(auth.uid(), ci.tenant_id)
      )
  )
);

DROP POLICY IF EXISTS "Users can manage case item attachments in their tenant" ON public.case_item_attachments;

CREATE POLICY "Users can view case item attachments"
ON public.case_item_attachments FOR SELECT
USING (
  public.user_can_access_case_item(auth.uid(), case_item_id)
);

CREATE POLICY "Editors can manage case item attachments"
ON public.case_item_attachments FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.case_items ci
    WHERE ci.id = case_item_attachments.case_item_id
      AND ci.tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
      AND (
        ci.user_id = auth.uid()
        OR ci.owner_user_id = auth.uid()
        OR public.is_tenant_admin(auth.uid(), ci.tenant_id)
        OR EXISTS (
          SELECT 1
          FROM public.case_item_participants cip
          WHERE cip.case_item_id = ci.id
            AND cip.user_id = auth.uid()
            AND cip.role IN ('owner', 'editor')
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.case_items ci
    WHERE ci.id = case_item_attachments.case_item_id
      AND ci.tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
      AND (
        ci.user_id = auth.uid()
        OR ci.owner_user_id = auth.uid()
        OR public.is_tenant_admin(auth.uid(), ci.tenant_id)
        OR EXISTS (
          SELECT 1
          FROM public.case_item_participants cip
          WHERE cip.case_item_id = ci.id
            AND cip.user_id = auth.uid()
            AND cip.role IN ('owner', 'editor')
        )
      )
  )
);

CREATE OR REPLACE FUNCTION public.set_case_item_last_modified_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.last_modified_at = now();
  NEW.last_modified_by = auth.uid();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_items_set_last_modified ON public.case_items;
CREATE TRIGGER trg_case_items_set_last_modified
BEFORE UPDATE ON public.case_items
FOR EACH ROW
EXECUTE FUNCTION public.set_case_item_last_modified_fields();

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

    IF NEW.status IN ('closed', 'archived') THEN
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

DROP TRIGGER IF EXISTS trg_case_items_audit_lifecycle ON public.case_items;
CREATE TRIGGER trg_case_items_audit_lifecycle
AFTER UPDATE ON public.case_items
FOR EACH ROW
EXECUTE FUNCTION public.audit_case_item_lifecycle_changes();

CREATE INDEX IF NOT EXISTS idx_case_item_interactions_visibility
  ON public.case_item_interactions(visibility);
CREATE INDEX IF NOT EXISTS idx_case_items_last_modified_at
  ON public.case_items(last_modified_at DESC);
