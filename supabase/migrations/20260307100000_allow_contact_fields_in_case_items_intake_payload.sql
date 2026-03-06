alter table public.case_items
  drop constraint if exists case_items_intake_payload_contact_fields_check;

alter table public.case_items
  add constraint case_items_intake_payload_contact_fields_check
  check (
    intake_payload is null
    or (
      (not (intake_payload ? 'contact_name') or jsonb_typeof(intake_payload->'contact_name') in ('string', 'null'))
      and (not (intake_payload ? 'contact_detail') or jsonb_typeof(intake_payload->'contact_detail') in ('string', 'null'))
    )
  );
