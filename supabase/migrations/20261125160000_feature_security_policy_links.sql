-- Liefert die wirksamen RLS-Policies je Tabelle, damit der Funktionskatalog
-- Sicherheitsbefunde und Policies den fachlichen Funktionen zuordnen kann.
-- Reine Leseoperation: keine Änderung an Policies, Tabellen oder Daten.

CREATE OR REPLACE FUNCTION public.audit_rls_policies(_tables text[] DEFAULT NULL)
RETURNS TABLE (
  table_name text,
  policy_name text,
  command text,
  roles name[],
  permissive text,
  has_using boolean,
  has_check boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'abgeordneter'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    p.tablename::text,
    p.policyname::text,
    p.cmd::text,
    p.roles,
    p.permissive::text,
    (p.qual IS NOT NULL),
    (p.with_check IS NOT NULL)
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND (_tables IS NULL OR p.tablename = ANY (_tables))
  ORDER BY p.tablename, p.policyname;
END;
$$;

COMMENT ON FUNCTION public.audit_rls_policies(text[]) IS
  'Read-only policy inventory per table for the feature catalog; returns names and command metadata, never an aggregate security rating.';

REVOKE ALL ON FUNCTION public.audit_rls_policies(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_rls_policies(text[]) TO authenticated;
