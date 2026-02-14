
-- ===========================================
-- 1. Fix letter_occasions RLS policies
-- ===========================================
DROP POLICY IF EXISTS "Users can insert letter occasions for their tenant" ON letter_occasions;
DROP POLICY IF EXISTS "Users can view letter occasions for their tenant" ON letter_occasions;
DROP POLICY IF EXISTS "Users can update letter occasions for their tenant" ON letter_occasions;
DROP POLICY IF EXISTS "Users can delete letter occasions for their tenant" ON letter_occasions;

CREATE POLICY "Users can insert letter occasions for their tenant" ON letter_occasions
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can view letter occasions for their tenant" ON letter_occasions
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can update letter occasions for their tenant" ON letter_occasions
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete letter occasions for their tenant" ON letter_occasions
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- ===========================================
-- 2.2 Anon RLS policies for poll guest access
-- ===========================================

-- Allow anon users to read active polls (for guest voting links)
CREATE POLICY "Anon can view active polls" ON appointment_polls
  FOR SELECT TO anon USING (status = 'active');

-- Allow anon to view time slots for active polls
CREATE POLICY "Anon can view time slots for active polls" ON poll_time_slots
  FOR SELECT TO anon USING (EXISTS (
    SELECT 1 FROM appointment_polls ap 
    WHERE ap.id = poll_time_slots.poll_id AND ap.status = 'active'
  ));

-- Allow anon to view/find their participant record by token
CREATE POLICY "Anon can view participants by token" ON poll_participants
  FOR SELECT TO anon USING (token IS NOT NULL);

-- Allow anon to manage responses via token-based participants
CREATE POLICY "Anon can insert responses" ON poll_responses
  FOR INSERT TO anon WITH CHECK (EXISTS (
    SELECT 1 FROM poll_participants pp 
    WHERE pp.id = poll_responses.participant_id AND pp.token IS NOT NULL
  ));
CREATE POLICY "Anon can view own responses" ON poll_responses
  FOR SELECT TO anon USING (EXISTS (
    SELECT 1 FROM poll_participants pp 
    WHERE pp.id = poll_responses.participant_id AND pp.token IS NOT NULL
  ));
CREATE POLICY "Anon can delete own responses" ON poll_responses
  FOR DELETE TO anon USING (EXISTS (
    SELECT 1 FROM poll_participants pp 
    WHERE pp.id = poll_responses.participant_id AND pp.token IS NOT NULL
  ));

-- ===========================================
-- 2.7 RSVP table for event planning
-- ===========================================
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_planning_id UUID NOT NULL REFERENCES public.event_plannings(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'invited',
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  comment TEXT,
  responded_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  tenant_id UUID REFERENCES public.tenants(id)
);

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage RSVPs for their tenant
CREATE POLICY "Users can view RSVPs for their tenant" ON event_rsvps
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert RSVPs for their tenant" ON event_rsvps
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can update RSVPs for their tenant" ON event_rsvps
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete RSVPs for their tenant" ON event_rsvps
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- Anon users can view and update their own RSVP via token
CREATE POLICY "Anon can view own RSVP by token" ON event_rsvps
  FOR SELECT TO anon USING (token IS NOT NULL);
CREATE POLICY "Anon can update own RSVP by token" ON event_rsvps
  FOR UPDATE TO anon USING (token IS NOT NULL);
