-- Leadership may inspect question usage without opting into the games.
alter policy ritual_weeks_read on public.team_question_weeks using(
  public.team_ritual_participant(tenant_id)
  or (public.team_ritual_member(tenant_id) and public.is_tenant_admin(auth.uid(),tenant_id)));

-- Expose the latest persisted rotation week; keep invoker RLS and tenant checks.
create or replace function public.team_ritual_snapshot(p_tenant uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare result jsonb;
begin
  if not public.team_ritual_member(p_tenant) then raise exception 'Keine Berechtigung'; end if;
  select jsonb_build_object(
    'enabled',coalesce((select enabled from public.team_ritual_settings where tenant_id=p_tenant),false),
    'admin',public.is_tenant_admin(auth.uid(),p_tenant),
    'own',(select to_jsonb(p) from public.team_ritual_profiles p where tenant_id=p_tenant and user_id=auth.uid()),
    'profiles',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('display_name',coalesce(profiles.display_name,'Teammitglied'))) from public.team_ritual_profiles p left join public.profiles on profiles.user_id=p.user_id and profiles.tenant_id=p.tenant_id where p.tenant_id=p_tenant and p.opted_in and p.show_events),'[]'::jsonb),
    'questions',coalesce((select jsonb_agg(to_jsonb(q) || jsonb_build_object('usage_count', (select count(*) from public.team_question_weeks w where w.tenant_id=q.tenant_id and w.question_id=q.id), 'last_used_week', (select max(w.week_start) from public.team_question_weeks w where w.tenant_id=q.tenant_id and w.question_id=q.id)) order by q.id) from public.team_questions q where q.tenant_id=p_tenant),'[]'::jsonb),
    'week',(select to_jsonb(w) from public.team_question_weeks w where tenant_id=p_tenant and week_start=date_trunc('week',current_timestamp at time zone 'Europe/Berlin')::date),
    'answers',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('display_name',coalesce(p.display_name,'Teammitglied'))) from public.team_question_answers a left join public.profiles p on p.user_id=a.user_id and p.tenant_id=a.tenant_id join public.team_question_weeks w on w.id=a.week_id where a.tenant_id=p_tenant and w.week_start=date_trunc('week',current_timestamp at time zone 'Europe/Berlin')::date),'[]'::jsonb)
  ) into result;
  return result || jsonb_build_object('employment',public.team_ritual_employment(p_tenant));
end; $$;

-- Preserve the current month and its answers; only future selection changes.
create or replace function public.team_two_truths_snapshot(p_tenant uuid) returns jsonb
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
      -- A set of statements is used once, even after reordering or whitespace/case edits.
      and not exists(select 1 from public.team_two_truths_months used
        where used.tenant_id=f.tenant_id and used.subject_user_id=f.user_id
        and array(select lower(btrim(v)) from unnest(used.facts) v order by lower(btrim(v)))
          = array(select lower(btrim(v)) from unnest(f.facts) v order by lower(btrim(v))))
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

-- Past prompts only. No answer, lie index, subject ID, or private editor fields.
create function public.team_two_truths_archive(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.team_ritual_participant(p_tenant) then raise exception 'Teilnahme nicht aktiviert'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',q.id,'month',q.month_start,'subject_name',coalesce((select display_name from public.profiles
      where tenant_id=p_tenant and user_id=q.subject_user_id limit 1),'Teammitglied'),'facts',q.facts)
    order by q.month_start desc)
    from public.team_two_truths_months q
    join public.team_fun_facts f on f.tenant_id=q.tenant_id and f.user_id=q.subject_user_id and f.shared
    join public.team_ritual_profiles p on p.tenant_id=f.tenant_id and p.user_id=f.user_id and p.opted_in
    join public.user_tenant_memberships m on m.tenant_id=f.tenant_id and m.user_id=f.user_id and m.is_active
    where q.tenant_id=p_tenant and q.month_start < date_trunc('month',current_timestamp at time zone 'Europe/Berlin')::date), '[]'::jsonb);
end; $$;
revoke all on function public.team_two_truths_archive(uuid) from public,anon;
grant execute on function public.team_two_truths_archive(uuid) to authenticated;
