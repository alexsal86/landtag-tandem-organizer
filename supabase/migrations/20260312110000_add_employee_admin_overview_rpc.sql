create or replace function public.get_employee_admin_overview(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from user_tenant_memberships utm
    where utm.tenant_id = p_tenant_id
      and utm.user_id = auth.uid()
      and utm.is_active = true
  ) then
    raise exception 'No tenant access';
  end if;

  if not exists (
    select 1
    from user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'abgeordneter'
  ) then
    raise exception 'Admin role required';
  end if;

  with managed_users as (
    select utm.user_id
    from user_tenant_memberships utm
    join user_roles ur on ur.user_id = utm.user_id
    where utm.tenant_id = p_tenant_id
      and utm.is_active = true
      and ur.role in ('mitarbeiter', 'praktikant', 'bueroleitung')
  ),
  employee_overview as (
    select
      mu.user_id,
      p.display_name,
      p.avatar_url,
      es.hours_per_week,
      es.timezone,
      es.workdays,
      es.admin_id,
      es.annual_vacation_days,
      es.employment_start_date,
      es.hours_per_month,
      es.days_per_month,
      es.days_per_week,
      es.last_meeting_date,
      es.meeting_interval_months,
      es.next_meeting_reminder_days,
      es.carry_over_days,
      es.carry_over_expires_at,
      coalesce(mr.open_meeting_requests, 0) as open_meeting_requests,
      lm.last_meeting_id,
      coalesce(sd.sick_days_count, 0) as sick_days_count,
      coalesce(la.leave_agg, jsonb_build_object(
        'counts', jsonb_build_object('vacation', 0, 'sick', 0, 'other', 0, 'medical', 0, 'overtime_reduction', 0),
        'approved', jsonb_build_object('vacation', 0, 'sick', 0, 'other', 0, 'medical', 0, 'overtime_reduction', 0),
        'pending', jsonb_build_object('vacation', 0, 'sick', 0, 'other', 0, 'medical', 0, 'overtime_reduction', 0),
        'lastDates', jsonb_build_object()
      )) as leave_agg
    from managed_users mu
    left join profiles p on p.user_id = mu.user_id
    left join employee_settings es on es.user_id = mu.user_id
    left join (
      select employee_id, count(*)::int as open_meeting_requests
      from employee_meeting_requests
      where tenant_id = p_tenant_id
        and status = 'pending'
        and scheduled_meeting_id is null
      group by employee_id
    ) mr on mr.employee_id = mu.user_id
    left join (
      select distinct on (employee_id)
        employee_id,
        id as last_meeting_id,
        meeting_date
      from employee_meetings
      where tenant_id = p_tenant_id
      order by employee_id, meeting_date desc
    ) lm on lm.employee_id = mu.user_id
    left join (
      select user_id, count(*)::int as sick_days_count
      from sick_days
      group by user_id
    ) sd on sd.user_id = mu.user_id
    left join lateral (
      with leave_days as (
        select
          lr.type,
          lr.status,
          lr.start_date,
          (
            select count(*)::int
            from generate_series(lr.start_date::date, lr.end_date::date, interval '1 day') d(day)
            where extract(isodow from d.day) < 6
          ) as working_days
        from leave_requests lr
        where lr.user_id = mu.user_id
          and lr.start_date::date >= date_trunc('year', current_date)::date
          and lr.start_date::date <= (date_trunc('year', current_date) + interval '1 year - 1 day')::date
      )
      select jsonb_build_object(
        'counts', jsonb_build_object(
          'vacation', coalesce(sum(working_days) filter (where type = 'vacation'), 0),
          'sick', coalesce(sum(working_days) filter (where type = 'sick'), 0),
          'other', coalesce(sum(working_days) filter (where type = 'other'), 0),
          'medical', coalesce(sum(working_days) filter (where type = 'medical'), 0),
          'overtime_reduction', coalesce(sum(working_days) filter (where type = 'overtime_reduction'), 0)
        ),
        'approved', jsonb_build_object(
          'vacation', coalesce(sum(working_days) filter (where type = 'vacation' and status = 'approved'), 0),
          'sick', coalesce(sum(working_days) filter (where type = 'sick' and status = 'approved'), 0),
          'other', coalesce(sum(working_days) filter (where type = 'other' and status = 'approved'), 0),
          'medical', coalesce(sum(working_days) filter (where type = 'medical' and status = 'approved'), 0),
          'overtime_reduction', coalesce(sum(working_days) filter (where type = 'overtime_reduction' and status = 'approved'), 0)
        ),
        'pending', jsonb_build_object(
          'vacation', coalesce(sum(working_days) filter (where type = 'vacation' and status = 'pending'), 0),
          'sick', coalesce(sum(working_days) filter (where type = 'sick' and status = 'pending'), 0),
          'other', coalesce(sum(working_days) filter (where type = 'other' and status = 'pending'), 0),
          'medical', coalesce(sum(working_days) filter (where type = 'medical' and status = 'pending'), 0),
          'overtime_reduction', coalesce(sum(working_days) filter (where type = 'overtime_reduction' and status = 'pending'), 0)
        ),
        'lastDates', jsonb_strip_nulls(jsonb_build_object(
          'vacation', max(start_date) filter (where type = 'vacation'),
          'sick', max(start_date) filter (where type = 'sick'),
          'other', max(start_date) filter (where type = 'other'),
          'medical', max(start_date) filter (where type = 'medical'),
          'overtime_reduction', max(start_date) filter (where type = 'overtime_reduction')
        ))
      ) as leave_agg
      from leave_days
    ) la on true
  ),
  pending_leave_requests as (
    select jsonb_agg(jsonb_build_object(
      'id', lr.id,
      'user_id', lr.user_id,
      'user_name', coalesce(p.display_name, 'Unbekannt'),
      'type', lr.type,
      'start_date', lr.start_date,
      'end_date', lr.end_date,
      'status', lr.status
    ) order by lr.start_date asc) as data
    from leave_requests lr
    join managed_users mu on mu.user_id = lr.user_id
    left join profiles p on p.user_id = lr.user_id
    where lr.status in ('pending', 'cancel_requested')
  )
  select jsonb_build_object(
    'employees', coalesce((select jsonb_agg(to_jsonb(eo) order by eo.display_name nulls last) from employee_overview eo), '[]'::jsonb),
    'pending_leaves', coalesce((select data from pending_leave_requests), '[]'::jsonb),
    'pending_requests_count', (
      select count(*)::int
      from employee_meeting_requests emr
      join managed_users mu on mu.user_id = emr.employee_id
      where emr.tenant_id = p_tenant_id
        and emr.status = 'pending'
        and emr.scheduled_meeting_id is null
    )
  ) into v_result;

  return coalesce(v_result, jsonb_build_object(
    'employees', '[]'::jsonb,
    'pending_leaves', '[]'::jsonb,
    'pending_requests_count', 0
  ));
end;
$$;

grant execute on function public.get_employee_admin_overview(uuid) to authenticated;
