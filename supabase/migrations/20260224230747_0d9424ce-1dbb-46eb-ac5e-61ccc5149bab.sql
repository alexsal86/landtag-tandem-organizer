-- Re-activate all inactive letter templates for tenant
UPDATE public.letter_templates 
SET is_active = true, updated_at = now()
WHERE tenant_id = '2650522d-3c39-4734-b717-af3c188cc57c' 
AND is_active = false;