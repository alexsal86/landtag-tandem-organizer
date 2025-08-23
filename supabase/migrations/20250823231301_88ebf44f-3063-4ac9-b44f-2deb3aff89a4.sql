-- Extend contact_type constraint to include 'archive'
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_contact_type_check;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_contact_type_check 
CHECK (contact_type = ANY (ARRAY['person'::text, 'organization'::text, 'archive'::text]));

-- Add follow_up appointment category if it doesn't exist
INSERT INTO public.appointment_categories (name, label, color, is_active, order_index)
VALUES ('follow_up', 'Follow-Up', '#f59e0b', true, 10)
ON CONFLICT (name) DO NOTHING;