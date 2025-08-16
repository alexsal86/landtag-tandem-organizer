-- Check current constraint on appointments status
-- We need to see what values are allowed and add 'archived'

-- First, let's see the current constraint
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%appointments_status%';

-- Add 'archived' as a valid status for appointments
ALTER TABLE appointments 
DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments 
ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('planned', 'confirmed', 'cancelled', 'completed', 'archived'));