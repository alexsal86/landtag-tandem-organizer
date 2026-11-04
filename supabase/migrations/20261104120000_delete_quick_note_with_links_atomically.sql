-- SECURITY INVOKER preserves RLS for every affected object. Any failed step
-- raises, rolling back the entire request, including successful earlier steps.
create or replace function public.delete_quick_note_with_links(
  p_note_id uuid,
  p_delete_task boolean default false,
  p_delete_decision boolean default false,
  p_archive_case_item boolean default false,
  p_remove_meeting boolean default false
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_note public.quick_notes%rowtype;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  select * into v_note from public.quick_notes
    where id = p_note_id and user_id = auth.uid() and deleted_at is null
    for update;
  if not found then
    raise exception 'Notiz nicht vorhanden oder keine Berechtigung';
  end if;

  if p_delete_task and v_note.task_id is not null then
    delete from public.tasks where id = v_note.task_id;
    get diagnostics v_count = row_count;
    if v_count <> 1 then
      raise exception 'Aufgabe konnte nicht gelöscht werden';
    end if;
  end if;
  if p_delete_decision and v_note.decision_id is not null then
    delete from public.task_decisions where id = v_note.decision_id;
    get diagnostics v_count = row_count;
    if v_count <> 1 then
      raise exception 'Entscheidung konnte nicht gelöscht werden';
    end if;
  end if;
  if p_archive_case_item and v_note.case_item_id is not null then
    update public.case_items set status = 'archiviert' where id = v_note.case_item_id;
    get diagnostics v_count = row_count;
    if v_count <> 1 then
      raise exception 'Vorgang konnte nicht archiviert werden';
    end if;
  end if;

  update public.quick_notes set
    deleted_at = now(), permanent_delete_at = now() + interval '30 days',
    meeting_id = case when p_remove_meeting then null else meeting_id end,
    added_to_meeting_at = case when p_remove_meeting then null else added_to_meeting_at end
    where id = p_note_id and user_id = auth.uid() and deleted_at is null;
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'Notiz konnte nicht in den Papierkorb verschoben werden';
  end if;
end;
$$;
revoke all on function public.delete_quick_note_with_links(uuid, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.delete_quick_note_with_links(uuid, boolean, boolean, boolean, boolean) to authenticated;
