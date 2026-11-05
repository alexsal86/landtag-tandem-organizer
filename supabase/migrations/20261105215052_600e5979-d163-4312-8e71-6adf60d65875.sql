create or replace function public.list_quick_notes(p_tenant_id uuid, p_note_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare result jsonb; begin
  if not public.quick_note_member(p_tenant_id, auth.uid()) then raise exception 'Kein Zugriff auf diesen Mandanten' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(n) || jsonb_build_object(
    'is_shared', n.user_id <> auth.uid(), 'can_edit', public.quick_note_access(n.id, true),
    'owner', (select jsonb_build_object('display_name', p.display_name, 'avatar_url', p.avatar_url) from public.profiles p where p.user_id = n.user_id and p.tenant_id = n.tenant_id limit 1),
    'meetings', (select jsonb_build_object('title', m.title, 'meeting_date', m.meeting_date, 'status', m.status) from public.meetings m where m.id = n.meeting_id and m.tenant_id = n.tenant_id),
    'shared_with_users', coalesce((select jsonb_agg(jsonb_build_object('id', s.shared_with_user_id, 'display_name', p.display_name)) from public.quick_note_shares s left join public.profiles p on p.user_id = s.shared_with_user_id and p.tenant_id = s.tenant_id where s.note_id = n.id and s.tenant_id = n.tenant_id), '[]'::jsonb),
    'share_count', (select count(*) from public.quick_note_shares s where s.note_id = n.id and s.tenant_id = n.tenant_id)
  ) order by n.is_pinned desc, n.created_at desc), '[]'::jsonb) into result
  from public.quick_notes n where n.tenant_id = p_tenant_id and n.deleted_at is null and not coalesce(n.is_archived,false)
    and (p_note_id is null or n.id = p_note_id) and public.quick_note_access(n.id);
  return result;
end $$;

create table if not exists public.quick_note_write_receipts (
  operation_id uuid primary key,
  user_id uuid not null,
  tenant_id uuid not null references public.tenants(id),
  note_id uuid not null references public.quick_notes(id) on delete cascade,
  result jsonb not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.quick_note_write_receipts to authenticated;
grant all on public.quick_note_write_receipts to service_role;
alter table public.quick_note_write_receipts enable row level security;
create policy note_receipt_own on public.quick_note_write_receipts for select to authenticated using (user_id = auth.uid() and public.quick_note_member(tenant_id, auth.uid()) and public.quick_note_access(note_id, true));
create policy note_receipt_insert on public.quick_note_write_receipts for insert to authenticated with check (user_id = auth.uid() and public.quick_note_member(tenant_id, auth.uid()) and public.quick_note_access(note_id, true));

create or replace function public.save_quick_note(
 p_tenant_id uuid, p_note_id uuid, p_operation_id uuid, p_actor_id uuid, p_title text, p_content text,
 p_base_revision integer default null, p_create boolean default false,
 p_color text default null, p_is_pinned boolean default false
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare n public.quick_notes%rowtype; receipt jsonb; begin
  if not public.quick_note_member(p_tenant_id, auth.uid()) then raise exception 'Kein Zugriff auf diesen Mandanten' using errcode = '42501'; end if;
  if p_actor_id is distinct from auth.uid() then raise exception 'Benutzer hat sich geändert' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text, 0));
  select result into receipt from public.quick_note_write_receipts where operation_id = p_operation_id and user_id = auth.uid() and tenant_id = p_tenant_id and note_id = p_note_id;
  if found then return receipt; end if;
  if p_create then
    insert into public.quick_notes(id, tenant_id, user_id, title, content, color, is_pinned)
      values(p_note_id, p_tenant_id, auth.uid(), p_title, p_content, p_color, p_is_pinned) returning * into n;
  else
    select * into n from public.quick_notes where id = p_note_id and tenant_id = p_tenant_id and deleted_at is null and not coalesce(is_archived,false) for update;
    if not found or not public.quick_note_access(p_note_id, true) then raise exception 'Keine Bearbeitungsberechtigung' using errcode = '42501'; end if;
    if p_base_revision is null or n.revision <> p_base_revision then raise exception 'NOTE_CONFLICT: Die Notiz wurde inzwischen geändert' using errcode = '40001'; end if;
    if n.title is distinct from p_title or n.content is distinct from p_content then
      insert into public.quick_note_versions(note_id, tenant_id, user_id, title, content) values(n.id, n.tenant_id, auth.uid(), n.title, n.content);
      update public.quick_notes set title = p_title, content = p_content, revision = revision + 1 where id = n.id returning * into n;
    end if;
  end if;
  receipt := to_jsonb(n);
  insert into public.quick_note_write_receipts(operation_id, user_id, tenant_id, note_id, result) values(p_operation_id, auth.uid(), p_tenant_id, p_note_id, receipt);
  return receipt;
end $$;

revoke all on function public.list_quick_notes(uuid, uuid), public.save_quick_note(uuid,uuid,uuid,uuid,text,text,integer,boolean,text,boolean) from public, anon;
grant execute on function public.list_quick_notes(uuid, uuid), public.save_quick_note(uuid,uuid,uuid,uuid,text,text,integer,boolean,text,boolean) to authenticated;
notify pgrst, 'reload schema';