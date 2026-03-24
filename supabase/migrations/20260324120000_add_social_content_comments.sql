-- Kommentare zu Social-Planner-Items (internes Team-Feedback im Approval-Workflow)
create table public.social_content_comments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  item_id     uuid not null references public.social_content_items(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index social_content_comments_item_id_idx on public.social_content_comments(item_id);
create index social_content_comments_tenant_id_idx on public.social_content_comments(tenant_id);

-- updated_at trigger
create trigger social_content_comments_updated_at
  before update on public.social_content_comments
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.social_content_comments enable row level security;

create policy "tenant members can read comments"
  on public.social_content_comments for select
  using (
    tenant_id in (
      select tenant_id from public.profiles where user_id = auth.uid()
    )
  );

create policy "tenant members can insert comments"
  on public.social_content_comments for insert
  with check (
    tenant_id in (
      select tenant_id from public.profiles where user_id = auth.uid()
    )
    and profile_id = (
      select id from public.profiles where user_id = auth.uid() limit 1
    )
  );

create policy "comment author can update own comment"
  on public.social_content_comments for update
  using (
    profile_id = (
      select id from public.profiles where user_id = auth.uid() limit 1
    )
  );

create policy "comment author and admins can delete comment"
  on public.social_content_comments for delete
  using (
    profile_id = (
      select id from public.profiles where user_id = auth.uid() limit 1
    )
    or exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('abgeordneter', 'bueroleitung')
    )
  );
