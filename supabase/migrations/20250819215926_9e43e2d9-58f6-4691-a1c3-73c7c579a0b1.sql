-- Create appointment_polls table
CREATE TABLE public.appointment_polls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  deadline TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create poll_time_slots table
CREATE TABLE public.poll_time_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES public.appointment_polls(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create poll_participants table
CREATE TABLE public.poll_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES public.appointment_polls(id) ON DELETE CASCADE,
  user_id UUID,
  email TEXT NOT NULL,
  name TEXT,
  token TEXT UNIQUE,
  is_external BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create poll_responses table
CREATE TABLE public.poll_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES public.appointment_polls(id) ON DELETE CASCADE,
  time_slot_id UUID NOT NULL REFERENCES public.poll_time_slots(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.poll_participants(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('available', 'tentative', 'unavailable')),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(poll_id, time_slot_id, participant_id)
);

-- Add poll_id to appointments table
ALTER TABLE public.appointments ADD COLUMN poll_id UUID REFERENCES public.appointment_polls(id);

-- Enable RLS on all tables
ALTER TABLE public.appointment_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_responses ENABLE ROW LEVEL SECURITY;

-- RLS policies for appointment_polls
CREATE POLICY "Users can manage their own polls"
ON public.appointment_polls
FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view all polls"
ON public.appointment_polls
FOR SELECT
USING (auth.role() = 'authenticated');

-- RLS policies for poll_time_slots
CREATE POLICY "Users can manage time slots for their polls"
ON public.poll_time_slots
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.appointment_polls ap 
  WHERE ap.id = poll_id AND ap.user_id = auth.uid()
));

CREATE POLICY "Users can view time slots for accessible polls"
ON public.poll_time_slots
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.appointment_polls ap 
  WHERE ap.id = poll_id AND (ap.user_id = auth.uid() OR ap.status = 'active')
));

-- RLS policies for poll_participants
CREATE POLICY "Users can manage participants for their polls"
ON public.poll_participants
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.appointment_polls ap 
  WHERE ap.id = poll_id AND ap.user_id = auth.uid()
));

CREATE POLICY "Users can view participants for accessible polls"
ON public.poll_participants
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.appointment_polls ap 
  WHERE ap.id = poll_id AND (ap.user_id = auth.uid() OR ap.status = 'active')
));

-- RLS policies for poll_responses
CREATE POLICY "Users can create responses for accessible polls"
ON public.poll_responses
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.poll_participants pp 
  WHERE pp.id = participant_id AND (pp.user_id = auth.uid() OR pp.token IS NOT NULL)
));

CREATE POLICY "Users can update their own responses"
ON public.poll_responses
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.poll_participants pp 
  WHERE pp.id = participant_id AND pp.user_id = auth.uid()
));

CREATE POLICY "Users can view responses for accessible polls"
ON public.poll_responses
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.appointment_polls ap 
  JOIN public.poll_participants pp ON pp.poll_id = ap.id
  WHERE ap.id = poll_id AND (ap.user_id = auth.uid() OR pp.user_id = auth.uid() OR pp.token IS NOT NULL)
));

-- Create function to generate unique participant tokens
CREATE OR REPLACE FUNCTION public.generate_participant_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64url');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update updated_at timestamps
CREATE TRIGGER update_appointment_polls_updated_at
  BEFORE UPDATE ON public.appointment_polls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_poll_responses_updated_at
  BEFORE UPDATE ON public.poll_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();