-- Phase 1: voluntary, tenant-local rituals. All client writes use checked RPCs.
create table public.team_ritual_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  enabled boolean not null default false
);
create table public.team_ritual_profiles (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  opted_in boolean not null default false,
  show_events boolean not null default false,
  birthday text check (birthday is null or (birthday ~ '^\d{2}-\d{2}$' and to_char(to_date('2000-' || birthday, 'YYYY-MM-DD'), 'MM-DD') = birthday)),
  birth_year integer check (birth_year between 1900 and 2200),
  joined_on date,
  primary key (tenant_id, user_id),
  check (birth_year is null or (birthday is not null and to_char(to_date(birth_year::text || '-' || birthday, 'YYYY-MM-DD'), 'YYYY-MM-DD') = birth_year::text || '-' || birthday))
);
create table public.team_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 1 and 280),
  active boolean not null default true,
  unique (tenant_id, id)
);
create table public.team_question_weeks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  question_id uuid not null,
  question text not null,
  foreign key (tenant_id, question_id) references public.team_questions(tenant_id, id),
  unique (tenant_id, week_start),
  unique (tenant_id, id)
);
create table public.team_question_answers (
  tenant_id uuid not null,
  week_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer text not null check (char_length(btrim(answer)) between 1 and 280),
  foreign key (tenant_id, week_id) references public.team_question_weeks(tenant_id, id) on delete cascade,
  foreign key (tenant_id, user_id) references public.team_ritual_profiles(tenant_id, user_id) on delete cascade,
  primary key (week_id, user_id)
);
create index on public.team_question_weeks (tenant_id, question_id, week_start desc);

create function public.team_ritual_member(p_tenant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_tenant_memberships where tenant_id=p_tenant and user_id=auth.uid() and is_active);
$$;
create function public.team_ritual_participant(p_tenant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.team_ritual_member(p_tenant) and exists (
    select 1 from public.team_ritual_settings s join public.team_ritual_profiles p using(tenant_id)
    where s.tenant_id=p_tenant and s.enabled and p.user_id=auth.uid() and p.opted_in);
$$;

-- Consent checks run behind a definer helper: ordinary members cannot read
-- colleagues' membership rows, and answer consent is independent of event sharing.
create function public.team_ritual_visible(p_tenant uuid, p_user uuid, p_events boolean) returns boolean
language sql stable security definer set search_path=public as $$
  select public.team_ritual_participant(p_tenant) and exists (
    select 1 from public.team_ritual_profiles p join public.user_tenant_memberships m
      on m.tenant_id=p.tenant_id and m.user_id=p.user_id
    where p.tenant_id=p_tenant and p.user_id=p_user and p.opted_in and m.is_active
      and (not p_events or p.show_events));
$$;

alter table public.team_ritual_settings enable row level security;
alter table public.team_ritual_profiles enable row level security;
alter table public.team_questions enable row level security;
alter table public.team_question_weeks enable row level security;
alter table public.team_question_answers enable row level security;
create policy ritual_settings_read on public.team_ritual_settings for select to authenticated using(public.team_ritual_member(tenant_id));
create policy ritual_profile_read on public.team_ritual_profiles for select to authenticated using(
  public.team_ritual_member(tenant_id) and (user_id=auth.uid() or public.team_ritual_visible(tenant_id,user_id,true)));
create policy ritual_questions_read on public.team_questions for select to authenticated using(public.team_ritual_participant(tenant_id) or (public.team_ritual_member(tenant_id) and public.is_tenant_admin(auth.uid(),tenant_id)));
create policy ritual_weeks_read on public.team_question_weeks for select to authenticated using(public.team_ritual_participant(tenant_id));
create policy ritual_answers_read on public.team_question_answers for select to authenticated using(public.team_ritual_visible(tenant_id,user_id,false));
revoke all on public.team_ritual_settings, public.team_ritual_profiles, public.team_questions, public.team_question_weeks, public.team_question_answers from anon, authenticated;
grant select on public.team_ritual_settings, public.team_ritual_profiles, public.team_questions, public.team_question_weeks, public.team_question_answers to authenticated;

create function public.configure_team_rituals(p_tenant uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.team_ritual_member(p_tenant) or not public.is_tenant_admin(auth.uid(),p_tenant) then raise exception 'Keine Berechtigung'; end if;
  insert into public.team_ritual_settings values(p_tenant,p_enabled) on conflict(tenant_id) do update set enabled=excluded.enabled;
  if not exists(select 1 from public.team_questions where tenant_id=p_tenant) then
    insert into public.team_questions(tenant_id,question) select p_tenant, unnest(array[
      'Welcher Song bringt dich morgens in Fahrt?', 'Welches Buch oder welcher Podcast hat dich zuletzt überrascht?',
      'Welches Gericht würdest du zum Teamessen mitbringen?', 'Was ist dein Lieblingsort zum Abschalten?',
      'Welche kleine Erfindung erleichtert deinen Alltag?', 'Was möchtest du einmal ausprobieren?',
      'Welches Spiel empfiehlst du für einen gemütlichen Abend?', 'Was war dein schönstes Naturerlebnis?',
      'Kaffee, Tee oder etwas anderes?', 'Welche Jahreszeit magst du besonders?',
      'Welchen Ausflug in der Region empfiehlst du?', 'Welche Fähigkeit würdest du gerne lernen?',
      'Welches Essen erinnert dich an deine Kindheit?', 'Was bringt dich zum Lachen?',
      'Welches Museum würdest du gerne besuchen?', 'Welcher Film hat dich zuletzt begeistert?',
      'Was darf bei einem guten Frühstück nicht fehlen?', 'Welches Hobby würdest du dem Team gerne vorstellen?',
      'Was ist dein liebster Weg zur Arbeit?', 'Was war diese Woche eine schöne kleine Überraschung?']);
  end if;
end; $$;

create function public.save_team_ritual_profile(p_tenant uuid, p_opted_in boolean, p_show_events boolean, p_birthday text, p_birth_year integer, p_joined_on date) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.team_ritual_member(p_tenant) then raise exception 'Keine Berechtigung'; end if;
  -- Same tenant lock as answers/configuration; withdrawal cannot race an answer write.
  perform 1 from public.team_ritual_settings where tenant_id=p_tenant for update;
  if p_birth_year > extract(year from current_timestamp at time zone 'Europe/Berlin') or p_joined_on > (current_timestamp at time zone 'Europe/Berlin')::date then raise exception 'Datum liegt in der Zukunft'; end if;
  if p_birth_year is not null and p_birthday is not null and to_date(p_birth_year::text || '-' || p_birthday,'YYYY-MM-DD') > (current_timestamp at time zone 'Europe/Berlin')::date then raise exception 'Geburtstag liegt in der Zukunft'; end if;
  insert into public.team_ritual_profiles values(p_tenant,auth.uid(),p_opted_in,p_show_events,p_birthday,p_birth_year,p_joined_on)
  on conflict(tenant_id,user_id) do update set opted_in=excluded.opted_in,show_events=excluded.show_events,birthday=excluded.birthday,birth_year=excluded.birth_year,joined_on=excluded.joined_on;
  if not p_opted_in then delete from public.team_question_answers where tenant_id=p_tenant and user_id=auth.uid(); end if;
end; $$;

create function public.save_team_question(p_tenant uuid, p_id uuid, p_question text, p_active boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.team_ritual_member(p_tenant) or not public.is_tenant_admin(auth.uid(),p_tenant) then raise exception 'Keine Berechtigung'; end if;
  perform 1 from public.team_ritual_settings where tenant_id=p_tenant for update;
  if p_id is null then insert into public.team_questions(tenant_id,question,active) values(p_tenant,btrim(p_question),p_active);
  else
    update public.team_questions set question=btrim(p_question),active=p_active where tenant_id=p_tenant and id=p_id;
    if not found then raise exception 'Frage nicht gefunden'; end if;
  end if;
end; $$;

create function public.ensure_weekly_question(p_tenant uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare w date := date_trunc('week',current_timestamp at time zone 'Europe/Berlin')::date; result uuid; q public.team_questions;
begin
  perform 1 from public.team_ritual_settings where tenant_id=p_tenant for update;
  if not public.team_ritual_participant(p_tenant) then raise exception 'Teilnahme nicht aktiviert'; end if;
  select id into result from public.team_question_weeks where tenant_id=p_tenant and week_start=w;
  if result is not null then return result; end if;
  -- Least recently used active question; mirrors pickNextQuestion, including newly added questions.
  select questions.* into q from public.team_questions questions
  left join public.team_question_weeks weeks on weeks.tenant_id=questions.tenant_id and weeks.question_id=questions.id
  where questions.tenant_id=p_tenant and questions.active
  group by questions.id order by max(weeks.week_start) nulls first, questions.id limit 1;
  if q.id is null then return null; end if;
  insert into public.team_question_weeks(tenant_id,week_start,question_id,question) values(p_tenant,w,q.id,q.question)
  on conflict(tenant_id,week_start) do nothing returning id into result;
  if result is null then select id into result from public.team_question_weeks where tenant_id=p_tenant and week_start=w; end if;
  return result;
end; $$;

create function public.upsert_weekly_answer(p_tenant uuid, p_week uuid, p_answer text) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform 1 from public.team_ritual_settings where tenant_id=p_tenant for update;
  if not public.team_ritual_participant(p_tenant) then raise exception 'Teilnahme nicht aktiviert'; end if;
  if not exists(select 1 from public.team_question_weeks where id=p_week and tenant_id=p_tenant and week_start=date_trunc('week',current_timestamp at time zone 'Europe/Berlin')::date) then raise exception 'Woche nicht aktuell'; end if;
  insert into public.team_question_answers values(p_tenant,p_week,auth.uid(),btrim(p_answer))
  on conflict(week_id,user_id) do update set answer=excluded.answer;
end; $$;
create function public.delete_weekly_answer(p_tenant uuid, p_week uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.team_ritual_member(p_tenant) then raise exception 'Keine Berechtigung'; end if;
  delete from public.team_question_answers where tenant_id=p_tenant and week_id=p_week and user_id=auth.uid();
end; $$;

-- Invoker reads preserve RLS; no unconsented profiles or answers enter client payloads.
create function public.team_ritual_snapshot(p_tenant uuid) returns jsonb
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
  return result;
end; $$;

-- Existing GDPR account deletion uses auth.admin.deleteUser: cascading FKs erase
-- dates, consent and answers. Tenant membership removal also erases this tenant's data.
create function public.cleanup_team_ritual_membership() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if TG_OP='DELETE' or not new.is_active or new.user_id is distinct from old.user_id or new.tenant_id is distinct from old.tenant_id then
    delete from public.team_ritual_profiles where tenant_id=old.tenant_id and user_id=old.user_id;
  end if;
  return null;
end; $$;
create trigger team_ritual_membership_cleanup after delete or update of is_active, tenant_id, user_id on public.user_tenant_memberships
for each row execute function public.cleanup_team_ritual_membership();

revoke all on function public.cleanup_team_ritual_membership() from public, anon, authenticated;
revoke all on function public.team_ritual_member(uuid) from public, anon;
grant execute on function public.team_ritual_member(uuid) to authenticated;
revoke all on function public.team_ritual_participant(uuid) from public, anon;
grant execute on function public.team_ritual_participant(uuid) to authenticated;
revoke all on function public.configure_team_rituals(uuid,boolean) from public, anon;
grant execute on function public.configure_team_rituals(uuid,boolean) to authenticated;
revoke all on function public.save_team_ritual_profile(uuid,boolean,boolean,text,integer,date) from public, anon;
grant execute on function public.save_team_ritual_profile(uuid,boolean,boolean,text,integer,date) to authenticated;
revoke all on function public.save_team_question(uuid,uuid,text,boolean) from public, anon;
grant execute on function public.save_team_question(uuid,uuid,text,boolean) to authenticated;
revoke all on function public.ensure_weekly_question(uuid) from public, anon;
grant execute on function public.ensure_weekly_question(uuid) to authenticated;
revoke all on function public.upsert_weekly_answer(uuid,uuid,text) from public, anon;
grant execute on function public.upsert_weekly_answer(uuid,uuid,text) to authenticated;
revoke all on function public.delete_weekly_answer(uuid,uuid) from public, anon;
grant execute on function public.delete_weekly_answer(uuid,uuid) to authenticated;
revoke all on function public.team_ritual_snapshot(uuid) from public, anon;
grant execute on function public.team_ritual_snapshot(uuid) to authenticated;
revoke all on function public.team_ritual_visible(uuid,uuid,boolean) from public, anon;
grant execute on function public.team_ritual_visible(uuid,uuid,boolean) to authenticated;
