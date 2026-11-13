CREATE OR REPLACE FUNCTION public.read_secured_contacts(_tenant_id uuid DEFAULT NULL::uuid, _ids uuid[] DEFAULT NULL::uuid[])
 RETURNS SETOF contacts
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE previous text:=current_setting('app.secured_field_read',true);
BEGIN
  PERFORM set_config('app.secured_field_read','contacts',true);
  -- Field rules are evaluated once per tenant, and the record is built once per row
  -- (the former "(func(...)).*" form re-ran the masking for every column of every row).
  RETURN QUERY
  WITH base AS (
    SELECT c.* FROM contacts c
    WHERE (_tenant_id IS NULL OR c.tenant_id=_tenant_id) AND (_ids IS NULL OR c.id=ANY(_ids))
  ), rules AS (
    SELECT t.tenant_id,
      ARRAY(SELECT col FROM unnest(ARRAY['phone','email','notes','email_2','email_3','mobile_phone','business_phone']) col
            WHERE field_read_rule(t.tenant_id,'contacts',col)<>'allow') AS masked
    FROM (SELECT DISTINCT b.tenant_id FROM base b) t
  )
  SELECT x.* FROM base b
  JOIN rules r ON r.tenant_id IS NOT DISTINCT FROM b.tenant_id
  CROSS JOIN LATERAL jsonb_populate_record(NULL::public.contacts,
    CASE WHEN cardinality(r.masked)=0 THEN to_jsonb(b) ELSE to_jsonb(b)-r.masked END) x;
  PERFORM set_config('app.secured_field_read',coalesce(previous,''),true);
EXCEPTION WHEN OTHERS THEN PERFORM set_config('app.secured_field_read',coalesce(previous,''),true); RAISE;
END $function$;