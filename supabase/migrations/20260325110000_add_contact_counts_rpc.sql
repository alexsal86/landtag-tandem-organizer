create or replace function public.get_contact_counts(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contacts_count integer := 0;
  v_stakeholders_count integer := 0;
  v_archive_count integer := 0;
  v_distribution_lists_count integer := 0;
begin
  select count(*) into v_contacts_count
  from contacts c
  where c.tenant_id = p_tenant_id
    and c.contact_type = 'person'
    and c.name <> 'Archivierter Kontakt';

  select count(*) into v_stakeholders_count
  from contacts c
  where c.tenant_id = p_tenant_id
    and c.contact_type = 'organization';

  select count(distinct c.phone) into v_archive_count
  from contacts c
  where c.tenant_id = p_tenant_id
    and c.name = 'Archivierter Kontakt'
    and c.phone is not null
    and btrim(c.phone) <> '';

  select count(*) into v_distribution_lists_count
  from distribution_lists dl
  where dl.tenant_id = p_tenant_id
    or dl.tenant_id is null;

  return jsonb_build_object(
    'contactsCount', v_contacts_count,
    'stakeholdersCount', v_stakeholders_count,
    'archiveCount', v_archive_count,
    'distributionListsCount', v_distribution_lists_count
  );
end;
$$;

grant execute on function public.get_contact_counts(uuid) to authenticated;
