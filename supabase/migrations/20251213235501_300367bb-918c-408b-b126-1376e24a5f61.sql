-- Create meeting_participants junction table
CREATE TABLE public.meeting_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  role text DEFAULT 'participant' CHECK (role IN ('organizer', 'participant', 'optional')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(meeting_id, contact_id)
);

-- Enable RLS
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

-- RLS policies for meeting_participants
CREATE POLICY "Users can view participants of their meetings"
  ON public.meeting_participants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_participants.meeting_id
    AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage participants of their meetings"
  ON public.meeting_participants FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_participants.meeting_id
    AND m.user_id = auth.uid()
  ));

-- Extend meetings table for recurring meetings
ALTER TABLE public.meetings 
  ADD COLUMN IF NOT EXISTS recurrence_rule jsonb,
  ADD COLUMN IF NOT EXISTS parent_meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_recurring_instance boolean DEFAULT false;

-- Extend meeting_templates table
ALTER TABLE public.meeting_templates
  ADD COLUMN IF NOT EXISTS default_participants uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS default_recurrence jsonb;

-- Create index for better performance
CREATE INDEX idx_meeting_participants_meeting_id ON public.meeting_participants(meeting_id);
CREATE INDEX idx_meeting_participants_contact_id ON public.meeting_participants(contact_id);
CREATE INDEX idx_meetings_parent_meeting_id ON public.meetings(parent_meeting_id);