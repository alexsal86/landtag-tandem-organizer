ALTER TABLE public.election_representatives 
ADD COLUMN IF NOT EXISTS legislature_period TEXT DEFAULT '18. Legislaturperiode';

-- Update all existing representatives to current legislature
UPDATE public.election_representatives 
SET legislature_period = '18. Legislaturperiode' 
WHERE legislature_period IS NULL;