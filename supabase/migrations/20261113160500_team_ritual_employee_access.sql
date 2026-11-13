-- Management is shared by tenant-local abgeordneter and bueroleitung via is_tenant_admin.
-- This narrow projection exposes only employment dates needed for office anniversaries;
-- no HR notes, wellbeing, contracts or working-time settings leave employee_settings.
create function public.team_ritual_employment(p_tenant uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.team_ritual_member(p_tenant) then raise exception 'Keine Berechtigung'; end if;
  if not exists(select 1 from public.team_ritual_settings where tenant_id=p_tenant and enabled) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id',e.user_id,'display_name',coalesce(p.display_name,'Teammitglied'),'joined_on',e.employment_start_date))
    from public.employee_settings e
    join public.user_tenant_memberships m on m.user_id=e.user_id and m.tenant_id=p_tenant and m.is_active
    left join public.profiles p on p.user_id=e.user_id and p.tenant_id=p_tenant
    where e.employment_start_date is not null and (e.admin_id is null or exists(
      select 1 from public.user_tenant_memberships a where a.user_id=e.admin_id and a.tenant_id=p_tenant and a.is_active))), '[]'::jsonb);
end; $$;
revoke all on function public.team_ritual_employment(uuid) from public,anon;
grant execute on function public.team_ritual_employment(uuid) to authenticated;
-- Retire the duplicate field without changing previously shipped migration files.
update public.team_ritual_profiles set joined_on=null;
create or replace function public.save_team_ritual_profile(p_tenant uuid, p_opted_in boolean, p_show_events boolean, p_birthday text, p_birth_year integer, p_joined_on date) returns void
language plpgsql security definer set search_path=public as $$
begin
  p_joined_on := null; -- canonical employee_settings owns employment dates
  if not public.team_ritual_member(p_tenant) then raise exception 'Keine Berechtigung'; end if;
  -- Same tenant lock as answers/configuration; withdrawal cannot race an answer write.
  perform 1 from public.team_ritual_settings where tenant_id=p_tenant for update;
  if p_birth_year > extract(year from current_timestamp at time zone 'Europe/Berlin') or p_joined_on > (current_timestamp at time zone 'Europe/Berlin')::date then raise exception 'Datum liegt in der Zukunft'; end if;
  if p_birth_year is not null and p_birthday is not null and to_date(p_birth_year::text || '-' || p_birthday,'YYYY-MM-DD') > (current_timestamp at time zone 'Europe/Berlin')::date then raise exception 'Geburtstag liegt in der Zukunft'; end if;
  insert into public.team_ritual_profiles values(p_tenant,auth.uid(),p_opted_in,p_show_events,p_birthday,p_birth_year,p_joined_on)
  on conflict(tenant_id,user_id) do update set opted_in=excluded.opted_in,show_events=excluded.show_events,birthday=excluded.birthday,birth_year=excluded.birth_year,joined_on=excluded.joined_on;
  if not p_opted_in then delete from public.team_question_answers where tenant_id=p_tenant and user_id=auth.uid(); end if;
end; $$;

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
    'questions',coalesce((select jsonb_agg(to_jsonb(q) order by q.id) from public.team_questions q where q.tenant_id=p_tenant),'[]'::jsonb),
    'week',(select to_jsonb(w) from public.team_question_weeks w where tenant_id=p_tenant and week_start=date_trunc('week',current_timestamp at time zone 'Europe/Berlin')::date),
    'answers',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('display_name',coalesce(p.display_name,'Teammitglied'))) from public.team_question_answers a left join public.profiles p on p.user_id=a.user_id and p.tenant_id=a.tenant_id join public.team_question_weeks w on w.id=a.week_id where a.tenant_id=p_tenant and w.week_start=date_trunc('week',current_timestamp at time zone 'Europe/Berlin')::date),'[]'::jsonb)
  ) into result;
  return result || jsonb_build_object('employment',public.team_ritual_employment(p_tenant));
end; $$;
