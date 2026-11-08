import { supabase } from '@/integrations/supabase/client';

/** One transaction owns decision documentation, follow-up tasks and the archive state. */
export async function persistMeetingArchive(meetingId: string) {
  const { data, error } = await supabase.rpc('archive_meeting_with_stafette', { _meeting_id: meetingId });
  if (error) throw error;
  return data;
}