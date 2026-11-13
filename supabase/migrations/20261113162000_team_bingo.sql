-- Only the neutral configuration is stored remotely; play state remains in the browser.
create table public.team_bingo_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  fields text[] not null check(cardinality(fields) between 9 and 40 and array_ndims(fields)=1 and array_lower(fields,1)=1)
);
alter table public.team_bingo_settings enable row level security;
create policy team_bingo_read on public.team_bingo_settings for select to authenticated using(public.team_ritual_member(tenant_id));
revoke all on public.team_bingo_settings from public,anon,authenticated;
grant select on public.team_bingo_settings to authenticated;
create function public.team_bingo_config(p_tenant uuid) returns jsonb
language plpgsql stable security invoker set search_path=public as $$
begin
  if not public.team_ritual_member(p_tenant) then raise exception 'Keine Berechtigung'; end if;
  return jsonb_build_object('fields',coalesce((select fields from public.team_bingo_settings where tenant_id=p_tenant),array[
    'Mikrofon vergessen einzuschalten','Jemand zitiert Goethe','Ein Regenschirm wird ausgeliehen',
    'Die Kaffeemaschine wird nachgefüllt','Ein Termin beginnt pünktlich','Ein neues Wort gelernt',
    'Ein Fahrrad steht vor dem Büro','Ein gemeinsames Mittagessen entsteht','Ein Drucker braucht Papier',
    'Jemand entdeckt eine neue Abkürzung','Ein freundlicher Anruf kommt an','Ein regionaler Snack wird geteilt']));
end; $$;
create function public.save_team_bingo_config(p_tenant uuid,p_fields text[]) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.team_ritual_member(p_tenant) or not public.is_tenant_admin(auth.uid(),p_tenant) then raise exception 'Keine Berechtigung'; end if;
  if cardinality(p_fields) is null or cardinality(p_fields) not between 9 and 40 or array_ndims(p_fields)<>1 or array_lower(p_fields,1)<>1
    or exists(select 1 from unnest(p_fields) f where f is null or char_length(btrim(f)) not between 1 and 120)
    or (select count(distinct lower(btrim(f))) from unnest(p_fields) f)<>cardinality(p_fields) then raise exception '9–40 verschiedene Felder mit jeweils 1–120 Zeichen angeben'; end if;
  insert into public.team_bingo_settings values(p_tenant,p_fields) on conflict(tenant_id) do update set fields=excluded.fields;
end; $$;
revoke all on function public.team_bingo_config(uuid),public.save_team_bingo_config(uuid,text[]) from public,anon;
grant execute on function public.team_bingo_config(uuid),public.save_team_bingo_config(uuid,text[]) to authenticated;
