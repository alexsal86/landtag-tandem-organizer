create table public.event_planning_timeline_assignments (
  id uuid not null default gen_random_uuid() primary key,
  event_planning_id uuid not null references public.event_plannings(id) on delete cascade,
  checklist_item_id uuid not null references public.event_planning_checklist_items(id) on delete cascade,
  due_date date not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (event_planning_id, checklist_item_id)
);

create index idx_event_planning_timeline_assignments_planning_id
  on public.event_planning_timeline_assignments (event_planning_id, due_date);

alter table public.event_planning_timeline_assignments enable row level security;

create policy "Users can view timeline assignments for accessible plannings"
on public.event_planning_timeline_assignments
for select
using (
  exists (
    select 1
    from public.event_plannings ep
    where ep.id = event_planning_timeline_assignments.event_planning_id
      and (
        ep.user_id = auth.uid()
        or not ep.is_private
        or exists (
          select 1
          from public.event_planning_collaborators epc
          where epc.event_planning_id = ep.id
            and epc.user_id = auth.uid()
        )
      )
  )
);

create policy "Users can manage timeline assignments for editable plannings"
on public.event_planning_timeline_assignments
for all
using (
  exists (
    select 1
    from public.event_plannings ep
    where ep.id = event_planning_timeline_assignments.event_planning_id
      and (
        ep.user_id = auth.uid()
        or exists (
          select 1
          from public.event_planning_collaborators epc
          where epc.event_planning_id = ep.id
            and epc.user_id = auth.uid()
            and epc.can_edit = true
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.event_planning_checklist_items epci
    join public.event_plannings ep on ep.id = epci.event_planning_id
    where epci.id = event_planning_timeline_assignments.checklist_item_id
      and epci.event_planning_id = event_planning_timeline_assignments.event_planning_id
      and (
        ep.user_id = auth.uid()
        or exists (
          select 1
          from public.event_planning_collaborators epc
          where epc.event_planning_id = ep.id
            and epc.user_id = auth.uid()
            and epc.can_edit = true
        )
      )
  )
);

create trigger update_event_planning_timeline_assignments_updated_at
before update on public.event_planning_timeline_assignments
for each row
execute function public.update_updated_at_column();
