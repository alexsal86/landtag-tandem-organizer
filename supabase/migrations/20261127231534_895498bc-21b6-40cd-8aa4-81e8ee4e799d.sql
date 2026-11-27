ALTER TABLE public.social_content_approval_events
  DROP CONSTRAINT IF EXISTS social_content_approval_events_action_check;
ALTER TABLE public.social_content_approval_events
  ADD CONSTRAINT social_content_approval_events_action_check
  CHECK (action IN ('submitted', 'approved', 'rejected', 'reset', 'reopened'));

CREATE OR REPLACE FUNCTION public.reopen_social_content_after_variant_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_item_id uuid;
  v_item public.social_content_items;
  v_previous_setting text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_item_id := NEW.content_item_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_item_id := OLD.content_item_id;
  ELSE
    IF ROW(NEW.caption, NEW.first_comment, NEW.media_type, NEW.asset_ids)
       IS NOT DISTINCT FROM ROW(OLD.caption, OLD.first_comment, OLD.media_type, OLD.asset_ids) THEN
      RETURN NULL;
    END IF;
    v_item_id := NEW.content_item_id;
  END IF;

  SELECT * INTO v_item FROM public.social_content_items WHERE id = v_item_id;
  IF NOT FOUND
     OR v_item.approval_state <> 'approved'
     OR v_item.published_at IS NOT NULL
     OR v_item.workflow_status = 'published' THEN
    RETURN NULL;
  END IF;

  v_previous_setting := coalesce(current_setting('app.social_approval_workflow', true), '');
  PERFORM set_config('app.social_approval_workflow', 'on', true);

  UPDATE public.social_content_items
     SET approval_state = 'pending_approval',
         approved_at = NULL,
         approved_by = NULL,
         workflow_status = 'approval'
   WHERE id = v_item_id;

  PERFORM set_config('app.social_approval_workflow', v_previous_setting, true);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_social_content_after_variant_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_social_content_variant_reopen_approval ON public.social_content_variants;
CREATE TRIGGER trg_social_content_variant_reopen_approval
  AFTER INSERT OR UPDATE OR DELETE ON public.social_content_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.reopen_social_content_after_variant_change();