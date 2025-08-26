-- Temporarily change assigned_to from ARRAY to TEXT to fix malformed array literal error
ALTER TABLE public.tasks ALTER COLUMN assigned_to TYPE TEXT USING 
  CASE 
    WHEN assigned_to IS NULL THEN NULL
    ELSE array_to_string(assigned_to, ',')
  END;