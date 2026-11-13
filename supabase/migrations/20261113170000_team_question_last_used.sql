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
    'questions',coalesce((select jsonb_agg(to_jsonb(q) || jsonb_build_object('last_used_week', (select max(w.week_start) from public.team_question_weeks w where w.tenant_id=q.tenant_id and w.question_id=q.id)) order by q.id) from public.team_questions q where q.tenant_id=p_tenant),'[]'::jsonb),
    'week',(select to_jsonb(w) from public.team_question_weeks w where tenant_id=p_tenant and week_start=date_trunc('week',current_timestamp at time zone 'Europe/Berlin')::date),
    'answers',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('display_name',coalesce(p.display_name,'Teammitglied'))) from public.team_question_answers a left join public.profiles p on p.user_id=a.user_id and p.tenant_id=a.tenant_id join public.team_question_weeks w on w.id=a.week_id where a.tenant_id=p_tenant and w.week_start=date_trunc('week',current_timestamp at time zone 'Europe/Berlin')::date),'[]'::jsonb)
  ) into result;
  return result || jsonb_build_object('employment',public.team_ritual_employment(p_tenant));
end; $$;
