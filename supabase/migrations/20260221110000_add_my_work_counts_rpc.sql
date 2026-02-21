create or replace function public.get_my_work_counts(
  p_user_id uuid,
  p_include_team boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tasks integer := 0;
  v_decisions integer := 0;
  v_case_files integer := 0;
  v_plannings integer := 0;
  v_jour_fixe integer := 0;
  v_team integer := 0;
begin
  select count(*) into v_tasks
  from tasks t
  where (
    t.assigned_to = p_user_id::text
    or t.assigned_to ilike '%' || p_user_id::text || '%'
    or t.user_id = p_user_id
  )
    and t.status <> 'completed';

  select count(*) into v_decisions
  from task_decision_participants tdp
  join task_decisions td on td.id = tdp.decision_id
  where tdp.user_id = p_user_id
    and td.status in ('active', 'open');

  select count(*) into v_case_files
  from case_files cf
  where cf.user_id = p_user_id
    and cf.status in ('active', 'pending');

  select (
    (select count(*) from event_plannings ep where ep.user_id = p_user_id)
    +
    (select count(*) from event_planning_collaborators epc where epc.user_id = p_user_id)
  ) into v_plannings;

  select count(*) into v_jour_fixe
  from meetings m
  where m.user_id = p_user_id
    and m.status <> 'archived'
    and m.meeting_date >= now();

  if p_include_team then
    with active_members as (
      select utm.user_id
      from user_tenant_memberships utm
      where utm.is_active = true
    ),
    employee_members as (
      select am.user_id
      from active_members am
      join user_roles ur on ur.user_id = am.user_id
      where ur.role in ('mitarbeiter', 'praktikant', 'bueroleitung')
    ),
    latest_entries as (
      select te.user_id, max(te.work_date) as last_work_date
      from time_entries te
      join employee_members em on em.user_id = te.user_id
      where te.work_date >= current_date - interval '45 day'
      group by te.user_id
    ),
    warning_users as (
      select em.user_id
      from employee_members em
      left join latest_entries le on le.user_id = em.user_id
      where le.last_work_date is null
         or (
           select count(*)
           from generate_series(le.last_work_date + interval '1 day', current_date, interval '1 day') as d(day)
           where extract(dow from d.day) not in (0, 6)
         ) > 3
    )
    select
      (select count(*) from employee_meeting_requests where status = 'pending')
      +
      (select count(*) from warning_users)
    into v_team;
  end if;

  return jsonb_build_object(
    'tasks', v_tasks,
    'decisions', v_decisions,
    'caseFiles', v_case_files,
    'plannings', v_plannings,
    'team', v_team,
    'jourFixe', v_jour_fixe
  );
end;
$$;

grant execute on function public.get_my_work_counts(uuid, boolean) to authenticated;
