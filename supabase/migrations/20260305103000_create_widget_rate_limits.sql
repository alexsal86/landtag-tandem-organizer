create table if not exists public.widget_rate_limits (
  id uuid primary key default gen_random_uuid(),
  limit_key text not null unique,
  event_type text not null,
  ip_address text not null,
  session_id text not null,
  request_count integer not null default 1,
  window_started_at timestamptz not null,
  window_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint widget_rate_limits_request_count_positive check (request_count > 0)
);

create index if not exists widget_rate_limits_window_expires_idx
  on public.widget_rate_limits (window_expires_at);

create index if not exists widget_rate_limits_event_type_idx
  on public.widget_rate_limits (event_type);

create trigger update_widget_rate_limits_updated_at
before update on public.widget_rate_limits
for each row
execute function public.update_updated_at_column();
