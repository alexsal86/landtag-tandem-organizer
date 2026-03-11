CREATE TABLE IF NOT EXISTS public.case_item_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_case_item_categories_tenant_name UNIQUE (tenant_id, name)
);

ALTER TABLE public.case_item_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can view case item categories" ON public.case_item_categories;
CREATE POLICY "Tenant members can view case item categories"
ON public.case_item_categories
FOR SELECT
TO authenticated
USING (public.user_belongs_to_tenant(tenant_id) AND is_active = true);

DROP POLICY IF EXISTS "Tenant admins can manage case item categories" ON public.case_item_categories;
CREATE POLICY "Tenant admins can manage case item categories"
ON public.case_item_categories
FOR ALL
TO authenticated
USING (public.is_tenant_config_admin(tenant_id))
WITH CHECK (public.is_tenant_config_admin(tenant_id));

DROP TRIGGER IF EXISTS update_case_item_categories_updated_at ON public.case_item_categories;
CREATE TRIGGER update_case_item_categories_updated_at
BEFORE UPDATE ON public.case_item_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

WITH defaults(name, label, order_index) AS (
  VALUES
    ('allgemein', 'Allgemein', 0),
    ('buergeranliegen', 'Bürgeranliegen', 1),
    ('anfrage', 'Anfrage', 2),
    ('beschwerde', 'Beschwerde', 3),
    ('termin', 'Termin', 4),
    ('sonstiges', 'Sonstiges', 5)
)
INSERT INTO public.case_item_categories (tenant_id, name, label, order_index)
SELECT t.id, d.name, d.label, d.order_index
FROM public.tenants t
CROSS JOIN defaults d
ON CONFLICT (tenant_id, name) DO NOTHING;
