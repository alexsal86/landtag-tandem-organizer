-- Create appointment_guests table for external guest management
CREATE TABLE public.appointment_guests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'invited', -- invited, confirmed, declined, attended
  invitation_token TEXT UNIQUE,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  response_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create default_appointment_guests table for administration
CREATE TABLE public.default_appointment_guests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add guest-related fields to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS has_external_guests BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS calendar_uid TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS last_invitation_sent_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS on new tables
ALTER TABLE public.appointment_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.default_appointment_guests ENABLE ROW LEVEL SECURITY;

-- RLS policies for appointment_guests
CREATE POLICY "Users can manage guests for appointments in their tenant"
ON public.appointment_guests
FOR ALL
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())))
WITH CHECK (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

-- RLS policies for default_appointment_guests  
CREATE POLICY "Tenant admins can manage default guests"
ON public.default_appointment_guests
FOR ALL
USING (is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Users can view default guests in their tenant"
ON public.default_appointment_guests
FOR SELECT
USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())) AND is_active = true);

-- Create indexes for performance
CREATE INDEX idx_appointment_guests_appointment_id ON public.appointment_guests(appointment_id);
CREATE INDEX idx_appointment_guests_token ON public.appointment_guests(invitation_token);
CREATE INDEX idx_default_appointment_guests_tenant_id ON public.default_appointment_guests(tenant_id);
CREATE INDEX idx_appointments_calendar_uid ON public.appointments(calendar_uid);

-- Create trigger for updated_at timestamps
CREATE TRIGGER update_appointment_guests_updated_at
  BEFORE UPDATE ON public.appointment_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_default_appointment_guests_updated_at
  BEFORE UPDATE ON public.default_appointment_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate unique invitation tokens
CREATE OR REPLACE FUNCTION public.generate_guest_invitation_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_candidate TEXT;
  token_exists BOOLEAN;
BEGIN
  LOOP
    token_candidate := replace(gen_random_uuid()::text, '-', '') || 
                      replace(gen_random_uuid()::text, '-', '');
    
    SELECT EXISTS(
      SELECT 1 FROM public.appointment_guests 
      WHERE invitation_token = token_candidate
    ) INTO token_exists;
    
    IF NOT token_exists THEN
      RETURN token_candidate;
    END IF;
  END LOOP;
END;
$$;

-- Trigger to set invitation token on insert
CREATE OR REPLACE FUNCTION public.set_guest_invitation_token()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invitation_token IS NULL THEN
    NEW.invitation_token := public.generate_guest_invitation_token();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_appointment_guest_token
  BEFORE INSERT ON public.appointment_guests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_guest_invitation_token();