-- Add election district and party association tracking to appointments
ALTER TABLE public.appointments 
ADD COLUMN district_id uuid REFERENCES public.election_districts(id),
ADD COLUMN party_association_id uuid REFERENCES public.party_associations(id),
ADD COLUMN coordinates jsonb;

-- Add index for better performance when querying by district
CREATE INDEX idx_appointments_district_id ON public.appointments(district_id);
CREATE INDEX idx_appointments_party_association_id ON public.appointments(party_association_id);

-- Add comment for coordinates field
COMMENT ON COLUMN public.appointments.coordinates IS 'Stored as {"lat": number, "lng": number} for the appointment location';