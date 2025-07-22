-- Create appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT DEFAULT 'meeting' CHECK (category IN ('meeting', 'appointment', 'event', 'task', 'other')),
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'confirmed', 'cancelled', 'completed')),
  reminder_minutes INTEGER DEFAULT 15,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own appointments" 
ON public.appointments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own appointments" 
ON public.appointments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appointments" 
ON public.appointments 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own appointments" 
ON public.appointments 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create appointment_contacts junction table for linking appointments to contacts
CREATE TABLE public.appointment_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  role TEXT DEFAULT 'participant' CHECK (role IN ('organizer', 'participant', 'observer')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(appointment_id, contact_id)
);

-- Enable RLS on appointment_contacts
ALTER TABLE public.appointment_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for appointment_contacts
CREATE POLICY "Users can view appointment contacts for their appointments" 
ON public.appointment_contacts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE appointments.id = appointment_contacts.appointment_id 
    AND appointments.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create appointment contacts for their appointments" 
ON public.appointment_contacts 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE appointments.id = appointment_contacts.appointment_id 
    AND appointments.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update appointment contacts for their appointments" 
ON public.appointment_contacts 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE appointments.id = appointment_contacts.appointment_id 
    AND appointments.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete appointment contacts for their appointments" 
ON public.appointment_contacts 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.appointments 
    WHERE appointments.id = appointment_contacts.appointment_id 
    AND appointments.user_id = auth.uid()
  )
);

-- Add trigger for automatic timestamp updates on appointments
CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();