-- Secrets never have a client SELECT policy. Only checked RPC projections expose quiz prompts/results.
create table public.team_fun_facts (
  tenant_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  facts text[] not null check (array_length(facts,1)=3 and array_ndims(facts)=1 and array_lower(facts,1)=1),
  lie_index integer not null check (lie_index between 0 and 2),
  shared boolean not null default false,
  primary key(tenant_id,user_id),
  foreign key(tenant_id,user_id) references public.team_ritual_profiles(tenant_id,user_id) on delete cascade
);
create table public.team_two_truths_months (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  month_start date not null check(extract(day from month_start)=1),
  subject_user_id uuid not null,
  facts text[] not null,
  lie_index integer not null check(lie_index between 0 and 2),
  foreign key(tenant_id,subject_user_id) references public.team_fun_facts(tenant_id,user_id) on delete cascade,
  unique(tenant_id,month_start),
  unique(tenant_id,id)
);
create table public.team_two_truths_answers (
  tenant_id uuid not null,
  quiz_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  guess_index integer not null check(guess_index between 0 and 2),
  primary key(quiz_id,user_id),
  foreign key(tenant_id,quiz_id) references public.team_two_truths_months(tenant_id,id) on delete cascade,
  foreign key(tenant_id,user_id) references public.team_ritual_profiles(tenant_id,user_id) on delete cascade
);
alter table public.team_fun_facts enable row level security;
alter table public.team_two_truths_months enable row level security;
alter table public.team_two_truths_answers enable row level security;
revoke all on public.team_fun_facts,public.team_two_truths_months,public.team_two_truths_answers from public,anon,authenticated;

create function public.team_ritual_enabled(p_tenant uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select public.team_ritual_member(p_tenant) and exists(select 1 from public.team_ritual_settings where tenant_id=p_tenant and enabled);
$$;
create function public.own_team_fun_facts(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.team_ritual_member(p_tenant) then raise exception 'Keine Berechtigung'; end if;
  -- The editor is the sole endpoint allowed to return the caller's OWN lie index before playing.
  return (select jsonb_build_object('facts',facts,'lie_index',lie_index,'shared',shared) from public.team_fun_facts where tenant_id=p_tenant and user_id=auth.uid());
end; $$;
create function public.save_team_fun_facts(p_tenant uuid,p_facts text[],p_lie_index integer,p_shared boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.team_ritual_member(p_tenant) then raise exception 'Keine Berechtigung'; end if;
  perform 1 from public.team_ritual_settings where tenant_id=p_tenant for update;
  if p_shared and not public.team_ritual_participant(p_tenant) then raise exception 'Bitte zuerst die Teilnahme an Team-Ritualen aktivieren'; end if;
  if array_length(p_facts,1) is distinct from 3 or array_ndims(p_facts) is distinct from 1 or array_lower(p_facts,1) is distinct from 1
    or p_lie_index is null or p_lie_index not between 0 and 2 or p_shared is null
    or exists(select 1 from unnest(p_facts) f where f is null or char_length(btrim(f)) not between 1 and 160)
    or (select count(distinct lower(btrim(f))) from unnest(p_facts) f)<>3 then raise exception 'Drei verschiedene Aussagen mit jeweils 1–160 Zeichen und eine Lüge angeben'; end if;
  insert into public.team_ritual_profiles(tenant_id,user_id) values(p_tenant,auth.uid()) on conflict do nothing;
  insert into public.team_fun_facts values(p_tenant,auth.uid(),p_facts,p_lie_index,p_shared)
    on conflict(tenant_id,user_id) do update set facts=excluded.facts,lie_index=excluded.lie_index,shared=excluded.shared;
  if not p_shared then delete from public.team_two_truths_months where tenant_id=p_tenant and subject_user_id=auth.uid(); end if;
end; $$;
create function public.delete_team_fun_facts(p_tenant uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.team_ritual_member(p_tenant) then raise exception 'Keine Berechtigung'; end if;
  perform 1 from public.team_ritual_settings where tenant_id=p_tenant for update;
  delete from public.team_fun_facts where tenant_id=p_tenant and user_id=auth.uid();
end; $$;

create function public.team_two_truths_snapshot(p_tenant uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare q public.team_two_truths_months; subject uuid; guess integer; result jsonb;
  current_month date:=date_trunc('month',current_timestamp at time zone 'Europe/Berlin')::date;
begin
  perform 1 from public.team_ritual_settings where tenant_id=p_tenant for update;
  if not public.team_ritual_participant(p_tenant) then raise exception 'Teilnahme nicht aktiviert'; end if;
  select * into q from public.team_two_truths_months where tenant_id=p_tenant and month_start=current_month;
  if q.id is null then
    select f.user_id into subject from public.team_fun_facts f
      join public.team_ritual_profiles p on p.tenant_id=f.tenant_id and p.user_id=f.user_id and p.opted_in
      join public.user_tenant_memberships m on m.tenant_id=f.tenant_id and m.user_id=f.user_id and m.is_active
      left join public.team_two_truths_months history on history.tenant_id=f.tenant_id and history.subject_user_id=f.user_id
      where f.tenant_id=p_tenant and f.shared
      group by f.tenant_id,f.user_id order by max(history.month_start) nulls first,f.user_id limit 1;
    if subject is null then return null; end if;
    insert into public.team_two_truths_months(tenant_id,month_start,subject_user_id,facts,lie_index)
      select p_tenant,current_month,user_id,facts,lie_index from public.team_fun_facts where tenant_id=p_tenant and user_id=subject
      on conflict(tenant_id,month_start) do nothing;
    select * into q from public.team_two_truths_months where tenant_id=p_tenant and month_start=current_month;
  end if;
  if not exists(select 1 from public.team_fun_facts f join public.team_ritual_profiles p using(tenant_id,user_id)
    join public.user_tenant_memberships m using(tenant_id,user_id)
    where f.tenant_id=p_tenant and f.user_id=q.subject_user_id and f.shared and p.opted_in and m.is_active) then return null; end if;
  select guess_index into guess from public.team_two_truths_answers where quiz_id=q.id and user_id=auth.uid();
  result:=jsonb_build_object('id',q.id,'month',q.month_start,'subject_name',coalesce((select display_name from public.profiles where tenant_id=p_tenant and user_id=q.subject_user_id limit 1),'Teammitglied'),'facts',q.facts,'answered',guess is not null);
  -- Deliberately whitelist public fields. Never return to_jsonb(q).
  if guess is not null then result:=result||jsonb_build_object('guess_index',guess,'lie_index',q.lie_index,'correct',guess=q.lie_index); end if;
  return result;
end; $$;
create function public.answer_two_truths_quiz(p_tenant uuid,p_quiz uuid,p_guess integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare q public.team_two_truths_months; guess integer;
begin
  perform 1 from public.team_ritual_settings where tenant_id=p_tenant for update;
  if not public.team_ritual_participant(p_tenant) then raise exception 'Teilnahme nicht aktiviert'; end if;
  select * into q from public.team_two_truths_months where id=p_quiz and tenant_id=p_tenant
    and month_start=date_trunc('month',current_timestamp at time zone 'Europe/Berlin')::date for update;
  if q.id is null or p_guess is null or p_guess not between 0 and 2 then raise exception 'Ungültige Quizantwort'; end if;
  if not exists(select 1 from public.team_fun_facts f join public.team_ritual_profiles p using(tenant_id,user_id)
    join public.user_tenant_memberships m using(tenant_id,user_id)
    where f.tenant_id=p_tenant and f.user_id=q.subject_user_id and f.shared and p.opted_in and m.is_active) then raise exception 'Freigabe nicht mehr aktiv'; end if;
  insert into public.team_two_truths_answers values(p_tenant,p_quiz,auth.uid(),p_guess) on conflict(quiz_id,user_id) do nothing;
  select guess_index into guess from public.team_two_truths_answers where quiz_id=p_quiz and user_id=auth.uid();
  return jsonb_build_object('lie_index',q.lie_index,'guess_index',guess,'correct',guess=q.lie_index);
end; $$;

create function public.clear_team_quiz_consent() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if not new.opted_in then
    delete from public.team_fun_facts where tenant_id=new.tenant_id and user_id=new.user_id;
    delete from public.team_two_truths_answers where tenant_id=new.tenant_id and user_id=new.user_id;
  end if;
  return null;
end; $$;
create trigger team_quiz_consent_withdrawal after update of opted_in on public.team_ritual_profiles
  for each row when(old.opted_in and not new.opted_in) execute function public.clear_team_quiz_consent();
revoke all on function public.clear_team_quiz_consent() from public,anon,authenticated;
-- GDPR: all facts, quiz snapshots and answers cascade with auth user/profile/membership deletion.
revoke all on function public.team_ritual_enabled(uuid) from public,anon;
grant execute on function public.team_ritual_enabled(uuid) to authenticated;
revoke all on function public.own_team_fun_facts(uuid) from public,anon;
grant execute on function public.own_team_fun_facts(uuid) to authenticated;
revoke all on function public.save_team_fun_facts(uuid,text[],integer,boolean) from public,anon;
grant execute on function public.save_team_fun_facts(uuid,text[],integer,boolean) to authenticated;
revoke all on function public.delete_team_fun_facts(uuid) from public,anon;
grant execute on function public.delete_team_fun_facts(uuid) to authenticated;
revoke all on function public.team_two_truths_snapshot(uuid) from public,anon;
grant execute on function public.team_two_truths_snapshot(uuid) to authenticated;
revoke all on function public.answer_two_truths_quiz(uuid,uuid,integer) from public,anon;
grant execute on function public.answer_two_truths_quiz(uuid,uuid,integer) to authenticated;
