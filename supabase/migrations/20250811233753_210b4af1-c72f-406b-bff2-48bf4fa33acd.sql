-- Remove duplicate contacts, keeping the oldest entry for each name
WITH duplicates AS (
  SELECT 
    id,
    name,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC) as rn
  FROM public.contacts
  WHERE contact_type = 'person'
)
DELETE FROM public.contacts 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);