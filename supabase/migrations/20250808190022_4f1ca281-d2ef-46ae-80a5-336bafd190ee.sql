-- Add annual_vacation_days and employment_start_date to employee_settings if not exists
ALTER TABLE public.employee_settings 
ADD COLUMN IF NOT EXISTS annual_vacation_days integer NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS employment_start_date date DEFAULT '2025-01-01';

-- Create sick_days table for tracking sick leave entries
CREATE TABLE IF NOT EXISTS public.sick_days (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  sick_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text
);

-- Enable RLS on sick_days
ALTER TABLE public.sick_days ENABLE ROW LEVEL SECURITY;

-- Create policies for sick_days
CREATE POLICY "Users can view their own sick days" 
ON public.sick_days 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sick days" 
ON public.sick_days 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sick days" 
ON public.sick_days 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sick days" 
ON public.sick_days 
FOR DELETE 
USING (auth.uid() = user_id);

-- Allow admins to view/manage sick days of their employees
CREATE POLICY "Admins can view employee sick days" 
ON public.sick_days 
FOR SELECT 
USING (is_admin_of(user_id));

CREATE POLICY "Admins can create employee sick days" 
ON public.sick_days 
FOR INSERT 
WITH CHECK (is_admin_of(user_id));

CREATE POLICY "Admins can update employee sick days" 
ON public.sick_days 
FOR UPDATE 
USING (is_admin_of(user_id));

CREATE POLICY "Admins can delete employee sick days" 
ON public.sick_days 
FOR DELETE 
USING (is_admin_of(user_id));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_sick_days_updated_at
BEFORE UPDATE ON public.sick_days
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();