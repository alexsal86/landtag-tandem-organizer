-- Ensure every tenant has a fixed dossier case file type
INSERT INTO public.case_file_types (
  name,
  label,
  icon,
  color,
  order_index,
  is_active,
  tenant_id
)
SELECT
  'dossier' AS name,
  'Dossier' AS label,
  'BookOpen' AS icon,
  '#0ea5e9' AS color,
  COALESCE(max_order.max_order_index, -1) + 1 AS order_index,
  true AS is_active,
  t.id AS tenant_id
FROM public.tenants t
LEFT JOIN LATERAL (
  SELECT MAX(cft.order_index) AS max_order_index
  FROM public.case_file_types cft
  WHERE cft.tenant_id = t.id
) AS max_order ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.case_file_types existing
  WHERE existing.tenant_id = t.id
    AND existing.name = 'dossier'
);
