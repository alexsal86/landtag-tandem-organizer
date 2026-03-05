create or replace function public.get_my_work_new_counts(
  p_user_id uuid,
  p_contexts text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counts jsonb := '{}'::jsonb;
  v_contexts text[] := coalesce(
    p_contexts,
    array[
      'mywork_tasks',
      'mywork_decisions',
      'mywork_jourFixe',
      'mywork_casefiles',
      'mywork_plannings',
      'mywork_team',
      'mywork_feedbackfeed'
    ]::text[]
  );
  v_tasks_last_visit timestamptz := 'epoch'::timestamptz;
  v_decisions_last_visit timestamptz := 'epoch'::timestamptz;
  v_jour_fixe_last_visit timestamptz := 'epoch'::timestamptz;
  v_case_files_last_visit timestamptz := 'epoch'::timestamptz;
  v_plannings_last_visit timestamptz := 'epoch'::timestamptz;
  v_team_last_visit timestamptz := 'epoch'::timestamptz;
  v_feedback_feed_last_visit timestamptz := 'epoch'::timestamptz;
  v_decisions integer := 0;
begin
  select
    coalesce(max(case when unv.navigation_context = 'mywork_tasks' then unv.last_visited_at end), 'epoch'::timestamptz),
    coalesce(max(case when unv.navigation_context = 'mywork_decisions' then unv.last_visited_at end), 'epoch'::timestamptz),
    coalesce(max(case when unv.navigation_context = 'mywork_jourFixe' then unv.last_visited_at end), 'epoch'::timestamptz),
    coalesce(max(case when unv.navigation_context = 'mywork_casefiles' then unv.last_visited_at end), 'epoch'::timestamptz),
    coalesce(max(case when unv.navigation_context = 'mywork_plannings' then unv.last_visited_at end), 'epoch'::timestamptz),
    coalesce(max(case when unv.navigation_context = 'mywork_team' then unv.last_visited_at end), 'epoch'::timestamptz),
    coalesce(max(case when unv.navigation_context = 'mywork_feedbackfeed' then unv.last_visited_at end), 'epoch'::timestamptz)
  into
    v_tasks_last_visit,
    v_decisions_last_visit,
    v_jour_fixe_last_visit,
    v_case_files_last_visit,
    v_plannings_last_visit,
    v_team_last_visit,
    v_feedback_feed_last_visit
  from user_navigation_visits unv
  where unv.user_id = p_user_id
    and unv.navigation_context = any(v_contexts);

  if 'mywork_tasks' = any(v_contexts) then
    v_counts := v_counts || jsonb_build_object(
      'tasks',
      (
        select count(*)
        from tasks t
        where (
          t.assigned_to = p_user_id::text
          or t.assigned_to ilike '%' || p_user_id::text || '%'
          or t.user_id = p_user_id
        )
          and t.status <> 'completed'
          and t.created_at > v_tasks_last_visit
      )
    );
  end if;

  if 'mywork_decisions' = any(v_contexts) then
    select
      (
        select count(*)
        from task_decision_participants tdp
        join task_decisions td on td.id = tdp.decision_id
        where tdp.user_id = p_user_id
          and td.status in ('active', 'open')
          and tdp.invited_at > v_decisions_last_visit
      )
      +
      (
        select count(*)
        from task_decision_responses tdr
        join task_decision_participants tdp on tdp.id = tdr.participant_id
        join task_decisions td on td.id = tdp.decision_id
        where td.created_by = p_user_id
          and td.status in ('active', 'open')
          and tdr.created_at > v_decisions_last_visit
      )
    into v_decisions;

    v_counts := v_counts || jsonb_build_object('decisions', v_decisions);
  end if;

  if 'mywork_jourFixe' = any(v_contexts) then
    v_counts := v_counts || jsonb_build_object(
      'jourFixe',
      (
        (select count(*) from meetings m where m.user_id = p_user_id and m.status <> 'archived' and m.created_at > v_jour_fixe_last_visit)
        +
        (select count(*) from meeting_participants mp where mp.user_id = p_user_id and mp.created_at > v_jour_fixe_last_visit)
      )
    );
  end if;

  if 'mywork_casefiles' = any(v_contexts) then
    v_counts := v_counts || jsonb_build_object(
      'caseFiles',
      (select count(*) from case_files cf where cf.user_id = p_user_id and cf.created_at > v_case_files_last_visit)
    );
  end if;

  if 'mywork_plannings' = any(v_contexts) then
    v_counts := v_counts || jsonb_build_object(
      'plannings',
      (
        (select count(*) from event_plannings ep where ep.user_id = p_user_id and ep.created_at > v_plannings_last_visit)
        +
        (select count(*) from event_planning_collaborators epc where epc.user_id = p_user_id and epc.created_at > v_plannings_last_visit)
      )
    );
  end if;

  if 'mywork_team' = any(v_contexts) then
    v_counts := v_counts || jsonb_build_object(
      'team',
      (select count(*) from notifications n where n.user_id = p_user_id and n.is_read = false and n.created_at > v_team_last_visit)
    );
  end if;

  if 'mywork_feedbackfeed' = any(v_contexts) then
    v_counts := v_counts || jsonb_build_object(
      'feedbackFeed',
      (select count(*) from appointment_feedback af where af.feedback_status = 'completed' and af.completed_at > v_feedback_feed_last_visit)
    );
  end if;

  return v_counts;
end;
$$;

grant execute on function public.get_my_work_new_counts(uuid, text[]) to authenticated;

create index if not exists idx_tasks_user_status_created_at on public.tasks (user_id, status, created_at desc);
create index if not exists idx_task_decision_participants_user_invited_at on public.task_decision_participants (user_id, invited_at desc);
create index if not exists idx_task_decisions_created_by_status on public.task_decisions (created_by, status);
create index if not exists idx_task_decision_responses_created_at_participant_id on public.task_decision_responses (created_at desc, participant_id);
create index if not exists idx_meetings_user_status_created_at on public.meetings (user_id, status, created_at desc);
create index if not exists idx_meeting_participants_user_created_at on public.meeting_participants (user_id, created_at desc);
create index if not exists idx_case_files_user_created_at on public.case_files (user_id, created_at desc);
create index if not exists idx_event_plannings_user_created_at on public.event_plannings (user_id, created_at desc);
create index if not exists idx_event_planning_collaborators_user_created_at on public.event_planning_collaborators (user_id, created_at desc);
create index if not exists idx_notifications_user_is_read_created_at on public.notifications (user_id, is_read, created_at desc);
create index if not exists idx_appointment_feedback_status_completed_at on public.appointment_feedback (feedback_status, completed_at desc);
