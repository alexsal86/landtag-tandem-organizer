
DROP POLICY IF EXISTS "Anon can view participants by token" ON public.poll_participants;
DROP POLICY IF EXISTS "Anon can view own responses" ON public.poll_responses;
DROP POLICY IF EXISTS "Anon can insert responses" ON public.poll_responses;
DROP POLICY IF EXISTS "Anon can delete own responses" ON public.poll_responses;

DROP POLICY IF EXISTS "Anon can view own RSVP by token" ON public.event_rsvps;
DROP POLICY IF EXISTS "Anon can update own RSVP by token" ON public.event_rsvps;
