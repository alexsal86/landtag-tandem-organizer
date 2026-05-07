ALTER FUNCTION public.create_default_checklist_items(uuid, uuid) SET search_path = 'public';
ALTER FUNCTION public.dossier_is_duplicate_entry(uuid, uuid, text, text) SET search_path = 'public';
ALTER FUNCTION public.gdpr_check_four_eyes() SET search_path = 'public';
ALTER FUNCTION public.gdpr_set_updated_at() SET search_path = 'public';
ALTER FUNCTION public.parse_task_assignee_ids(text) SET search_path = 'public';
ALTER FUNCTION public.touch_mobile_push_tokens() SET search_path = 'public';