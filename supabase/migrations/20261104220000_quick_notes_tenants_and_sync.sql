-- Explicit tenant boundaries, one read RPC and retry-safe versioned writes.
alter table public.quick_notes add column tenant_id uuid references public.tenants(id);
alter table public.quick_notes add column revision integer not null default 0;
alter table public.quick_note_shares add column tenant_id uuid references public.tenants(id);
alter table public.quick_note_global_shares add column tenant_id uuid references public.tenants(id);
alter table public.quick_note_versions add column tenant_id uuid references public.tenants(id);

-- Tenant assignment is not a content edit. Preserve old updated_at values so
-- the 30-day review does not reset when this migration is applied.
do $$ begin
  if exists (select 1 from pg_trigger where tgrelid = 'public.quick_notes'::regclass and tgname = 'update_quick_notes_updated_at') then
    alter table public.quick_notes disable trigger update_quick_notes_updated_at;
  end if;
end $$;

-- Prefer a single tenant evidenced by linked records. Otherwise use the existing
-- profile tenant, or the user's only active membership. Never pick an arbitrary
-- membership for a multi-tenant user. Unresolved rows remain quarantined (NULL).
with candidates as (
  select n.id, (array_agg(distinct t.tenant_id))[1] as tenant_id
  from public.quick_notes n
  cross join lateral (
    select tenant_id from public.tasks where id = n.task_id
    union select tenant_id from public.meetings where id = n.meeting_id
    union select tenant_id from public.case_items where id = n.case_item_id
    union select tenant_id from public.task_decisions where id = n.decision_id
    union select tenant_id from public.topic_backlog where id = n.topic_backlog_id
  ) t
  where t.tenant_id is not null
  group by n.id having count(distinct t.tenant_id) = 1
)
update public.quick_notes n set tenant_id = c.tenant_id from candidates c where c.id = n.id;
with candidates as (
  select n.id, (array_agg(distinct p.tenant_id))[1] as tenant_id
  from public.quick_notes n join public.profiles p on p.user_id = n.user_id
  where n.tenant_id is null and p.tenant_id is not null
    and exists (select 1 from public.user_tenant_memberships m where m.user_id = n.user_id and m.tenant_id = p.tenant_id and m.is_active)
    and n.task_id is null and n.meeting_id is null and n.case_item_id is null and n.decision_id is null and n.topic_backlog_id is null
  group by n.id having count(distinct p.tenant_id) = 1
)
update public.quick_notes n set tenant_id = c.tenant_id from candidates c where c.id = n.id;
with candidates as (
  select n.id, (array_agg(distinct m.tenant_id))[1] as tenant_id
  from public.quick_notes n join public.user_tenant_memberships m on m.user_id = n.user_id and m.is_active
  where n.tenant_id is null
    and n.task_id is null and n.meeting_id is null and n.case_item_id is null and n.decision_id is null and n.topic_backlog_id is null
  group by n.id having count(distinct m.tenant_id) = 1
)
update public.quick_notes n set tenant_id = c.tenant_id from candidates c where c.id = n.id;
update public.quick_note_shares s set tenant_id = n.tenant_id from public.quick_notes n where n.id = s.note_id;
update public.quick_note_versions v set tenant_id = n.tenant_id from public.quick_notes n where n.id = v.note_id;
-- Global grants are scoped to the owner's existing profile tenant only if both
-- parties still have active membership. Ambiguous grants remain inaccessible.
with candidates as (
  select s.id, (array_agg(distinct p.tenant_id))[1] as tenant_id
  from public.quick_note_global_shares s join public.profiles p on p.user_id = s.user_id
  where exists (select 1 from public.user_tenant_memberships m where m.user_id = s.user_id and m.tenant_id = p.tenant_id and m.is_active)
    and exists (select 1 from public.user_tenant_memberships m where m.user_id = s.shared_with_user_id and m.tenant_id = p.tenant_id and m.is_active)
  group by s.id having count(distinct p.tenant_id) = 1
)
update public.quick_note_global_shares s set tenant_id = c.tenant_id from candidates c where s.id = c.id;
do $$ begin
  if exists (select 1 from pg_trigger where tgrelid = 'public.quick_notes'::regclass and tgname = 'update_quick_notes_updated_at') then
    alter table public.quick_notes enable trigger update_quick_notes_updated_at;
  end if;
end $$;
alter table public.quick_note_global_shares drop constraint if exists unique_global_share;
create unique index quick_note_global_share_tenant_unique on public.quick_note_global_shares(tenant_id, user_id, shared_with_user_id);
create index quick_notes_tenant_active on public.quick_notes(tenant_id, updated_at desc) where deleted_at is null and not is_archived;

do $$ declare unresolved integer; begin
  select count(*) into unresolved from public.quick_notes where tenant_id is null;
  if unresolved > 0 then raise warning '% Quick Notes require explicit tenant assignment; their content is retained and hidden by RLS', unresolved; end if;
end $$;

create or replace function public.quick_note_member(p_tenant_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_tenant_memberships where tenant_id = p_tenant_id and user_id = p_user_id and is_active);
$$;
create or replace function public.quick_note_access(p_note_id uuid, p_edit boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.quick_notes n where n.id = p_note_id
      and public.quick_note_member(n.tenant_id, auth.uid())
      and (n.user_id = auth.uid() or (
        public.quick_note_member(n.tenant_id, n.user_id) and (
          exists (select 1 from public.quick_note_shares s where s.note_id = n.id and s.tenant_id = n.tenant_id and s.shared_with_user_id = auth.uid() and (not p_edit or s.permission_type = 'edit'))
          or exists (select 1 from public.quick_note_global_shares s where s.user_id = n.user_id and s.tenant_id = n.tenant_id and s.shared_with_user_id = auth.uid() and (not p_edit or s.permission_type = 'edit'))
        )
      ))
  );
$$;
create or replace function public.quick_note_owned(p_note_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.quick_notes where id = p_note_id and user_id = auth.uid() and public.quick_note_member(tenant_id, auth.uid()));
$$;
-- Restrictive policies also constrain pre-existing owner and meeting policies.
create policy quick_notes_tenant_boundary on public.quick_notes as restrictive for all to public
  using (auth.uid() is not null and public.quick_note_member(tenant_id, auth.uid()))
  with check (auth.uid() is not null and public.quick_note_member(tenant_id, auth.uid()));
drop policy if exists "Users can view shared notes" on public.quick_notes;
create policy "Users can view shared notes" on public.quick_notes for select to authenticated using (public.quick_note_access(id));
drop policy if exists "Shared users with edit permission can update notes" on public.quick_notes;
create policy "Shared users with edit permission can update notes" on public.quick_notes for update to authenticated
  using (public.quick_note_access(id, true)) with check (public.quick_note_access(id, true));

-- Replace share/version policies to avoid policy recursion and user-only grants.
do $$ declare p record; begin
  for p in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('quick_note_shares','quick_note_global_shares','quick_note_versions') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
create policy note_share_read on public.quick_note_shares for select to authenticated using (
  public.quick_note_member(tenant_id, auth.uid()) and (public.quick_note_owned(note_id) or shared_with_user_id = auth.uid()));
create policy note_share_manage on public.quick_note_shares for all to authenticated using (public.quick_note_owned(note_id)) with check (
  public.quick_note_owned(note_id) and shared_by_user_id = auth.uid() and public.quick_note_member(tenant_id, shared_with_user_id));
create policy global_note_share_read on public.quick_note_global_shares for select to authenticated using (
  public.quick_note_member(tenant_id, auth.uid()) and public.quick_note_member(tenant_id, user_id) and (user_id = auth.uid() or shared_with_user_id = auth.uid()));
create policy global_note_share_manage on public.quick_note_global_shares for all to authenticated using (
  user_id = auth.uid() and public.quick_note_member(tenant_id, auth.uid())) with check (
  user_id = auth.uid() and public.quick_note_member(tenant_id, auth.uid()) and public.quick_note_member(tenant_id, shared_with_user_id));
create policy note_version_read on public.quick_note_versions for select to authenticated using (public.quick_note_access(note_id, true) and public.quick_note_member(tenant_id, auth.uid()));
create policy note_version_insert on public.quick_note_versions for insert to authenticated with check (user_id = auth.uid() and public.quick_note_access(note_id, true) and public.quick_note_member(tenant_id, auth.uid()));

create or replace function public.enforce_quick_note_scope()
returns trigger language plpgsql security definer set search_path = public as $$
declare note_tenant uuid; begin
  if tg_table_name = 'quick_notes' then
    if tg_op = 'INSERT' and new.tenant_id is null then
      select (array_agg(tenant_id))[1] into new.tenant_id from public.user_tenant_memberships where user_id = new.user_id and is_active having count(*) = 1;
    end if;
    if auth.uid() is not null and tg_op = 'UPDATE' then
      if new.user_id <> old.user_id or new.tenant_id is distinct from old.tenant_id then raise exception 'Notiz-Eigentümer und Mandant sind unveränderlich'; end if;
      if old.user_id <> auth.uid() then
        if new.meeting_result is distinct from old.meeting_result and not (
          exists (select 1 from public.meeting_participants mp join public.meetings m on m.id = mp.meeting_id where mp.meeting_id = old.meeting_id and mp.user_id = auth.uid() and m.tenant_id = old.tenant_id)
          or exists (select 1 from public.meetings m where m.id = old.meeting_id and m.user_id = auth.uid() and m.tenant_id = old.tenant_id)
        ) then raise exception 'Nur Besprechungsteilnehmer dürfen das Ergebnis ändern'; end if;
        if public.quick_note_access(old.id, true) then
          if (to_jsonb(new) - array['title','content','color','color_full_card','meeting_result','updated_at','revision']) is distinct from (to_jsonb(old) - array['title','content','color','color_full_card','meeting_result','updated_at','revision']) then
            raise exception 'Freigegebene Notizen erlauben nur Inhalts- und Farbänderungen';
          end if;
        elsif (to_jsonb(new) - array['meeting_result','updated_at','revision']) is distinct from (to_jsonb(old) - array['meeting_result','updated_at','revision']) then
          raise exception 'Nur das Besprechungsergebnis darf geändert werden';
        end if;
      end if;
    end if;
    if new.tenant_id is null then raise exception 'Mandant muss eindeutig angegeben werden'; end if;
    if tg_op = 'UPDATE' then new.revision := old.revision + 1; end if;
    if new.task_id is not null and not exists (select 1 from public.tasks where id = new.task_id and tenant_id = new.tenant_id) then raise exception 'Aufgabe gehört zu anderem Mandanten'; end if;
    if new.meeting_id is not null and not exists (select 1 from public.meetings where id = new.meeting_id and tenant_id = new.tenant_id) then raise exception 'Besprechung gehört zu anderem Mandanten'; end if;
    if new.case_item_id is not null and not exists (select 1 from public.case_items where id = new.case_item_id and tenant_id = new.tenant_id) then raise exception 'Vorgang gehört zu anderem Mandanten'; end if;
    if new.topic_backlog_id is not null and not exists (select 1 from public.topic_backlog where id = new.topic_backlog_id and tenant_id = new.tenant_id) then raise exception 'Thema gehört zu anderem Mandanten'; end if;
    if new.decision_id is not null and not exists (select 1 from public.task_decisions where id = new.decision_id and tenant_id = new.tenant_id) then raise exception 'Entscheidung gehört zu anderem Mandanten'; end if;
  elsif tg_table_name in ('quick_note_shares', 'quick_note_versions') then
    select tenant_id into note_tenant from public.quick_notes where id = new.note_id;
    if new.tenant_id is not null and new.tenant_id is distinct from note_tenant then raise exception 'Mandant stimmt nicht mit Notiz überein'; end if;
    new.tenant_id := note_tenant;
    if note_tenant is null then raise exception 'Notiz ohne gültigen Mandanten'; end if;
    if tg_op = 'UPDATE' and (new.note_id <> old.note_id or new.tenant_id is distinct from old.tenant_id) then raise exception 'Notiz-Zuordnung ist unveränderlich'; end if;
  else
    if new.tenant_id is null then raise exception 'Mandant muss angegeben werden'; end if;
    if tg_op = 'UPDATE' and (new.tenant_id is distinct from old.tenant_id or new.user_id <> old.user_id) then raise exception 'Freigabe-Zuordnung ist unveränderlich'; end if;
  end if;
  return new;
end $$;
create trigger enforce_quick_note_scope before insert or update on public.quick_notes for each row execute function public.enforce_quick_note_scope();
create trigger enforce_quick_note_scope before insert or update on public.quick_note_shares for each row execute function public.enforce_quick_note_scope();
create trigger enforce_quick_note_scope before insert or update on public.quick_note_versions for each row execute function public.enforce_quick_note_scope();
create trigger enforce_quick_note_scope before insert or update on public.quick_note_global_shares for each row execute function public.enforce_quick_note_scope();

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

create table public.quick_note_write_receipts (
  operation_id uuid primary key,
  user_id uuid not null,
  tenant_id uuid not null references public.tenants(id),
  note_id uuid not null references public.quick_notes(id) on delete cascade,
  result jsonb not null,
  created_at timestamptz not null default now()
);
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
  -- Serialize retries of one operation, including concurrent requests.
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
      update public.quick_notes set title = p_title, content = p_content where id = n.id returning * into n;
    end if;
  end if;
  receipt := to_jsonb(n);
  insert into public.quick_note_write_receipts(operation_id, user_id, tenant_id, note_id, result) values(p_operation_id, auth.uid(), p_tenant_id, p_note_id, receipt);
  return receipt;
end $$;

revoke all on function public.quick_note_member(uuid, uuid), public.quick_note_access(uuid, boolean), public.quick_note_owned(uuid), public.list_quick_notes(uuid, uuid), public.save_quick_note(uuid,uuid,uuid,uuid,text,text,integer,boolean,text,boolean), public.enforce_quick_note_scope() from public, anon;
grant execute on function public.quick_note_member(uuid, uuid), public.quick_note_access(uuid, boolean), public.quick_note_owned(uuid), public.list_quick_notes(uuid, uuid), public.save_quick_note(uuid,uuid,uuid,uuid,text,text,integer,boolean,text,boolean) to authenticated;
grant select, insert on public.quick_note_write_receipts to authenticated;

-- Retire unrestricted metadata helper RPCs used by the old policies.
create or replace function public.is_note_owner(_note_id uuid, _user_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select _user_id = auth.uid() and public.quick_note_owned(_note_id);
$$;
create or replace function public.get_shared_note_ids(_user_id uuid)
returns setof uuid language sql stable security invoker set search_path = public as $$
  select note_id from public.quick_note_shares where _user_id = auth.uid() and shared_with_user_id = auth.uid() and public.quick_note_member(tenant_id, auth.uid());
$$;
create or replace function public.get_globally_shared_user_ids(_user_id uuid)
returns setof uuid language sql stable security invoker set search_path = public as $$
  select user_id from public.quick_note_global_shares where _user_id = auth.uid() and shared_with_user_id = auth.uid() and public.quick_note_member(tenant_id, auth.uid());
$$;
revoke all on function public.is_note_owner(uuid,uuid), public.get_shared_note_ids(uuid), public.get_globally_shared_user_ids(uuid) from public, anon;
grant execute on function public.is_note_owner(uuid,uuid), public.get_shared_note_ids(uuid), public.get_globally_shared_user_ids(uuid) to authenticated;
