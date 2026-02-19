import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MeetingParticipant {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time?: string | null;
  status: string;
  description?: string | null;
  is_public?: boolean;
  user_id?: string;
}

export function useMyWorkJourFixeMeetings(userId?: string) {
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [pastMeetings, setPastMeetings] = useState<Meeting[]>([]);
  const [meetingParticipants, setMeetingParticipants] = useState<Record<string, MeetingParticipant[]>>({});
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  const loadParticipantsForMeetings = useCallback(async (meetingIds: string[]) => {
    if (meetingIds.length === 0) return;

    try {
      const { data: participants, error: participantsError } = await supabase
        .from('meeting_participants')
        .select('meeting_id, user_id')
        .in('meeting_id', meetingIds);

      if (participantsError || !participants || participants.length === 0) return;

      const userIds = [...new Set(participants.map(p => p.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      if (profilesError) return;

      const participantsByMeeting: Record<string, MeetingParticipant[]> = {};
      participants.forEach(p => {
        const profile = profiles?.find(prof => prof.user_id === p.user_id);
        if (!participantsByMeeting[p.meeting_id]) participantsByMeeting[p.meeting_id] = [];
        participantsByMeeting[p.meeting_id].push({
          user_id: p.user_id,
          display_name: profile?.display_name || null,
          avatar_url: profile?.avatar_url || null
        });
      });

      if (isMountedRef.current) setMeetingParticipants(participantsByMeeting);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  }, []);

  const loadMeetings = useCallback(async () => {
    if (!userId) return;

    try {
      const now = new Date().toISOString();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const selectFields = "id, title, meeting_date, meeting_time, status, description, is_public, user_id";

      const { data: ownUpcoming } = await supabase
        .from("meetings")
        .select(selectFields)
        .eq("user_id", userId)
        .neq("status", "archived")
        .gte("meeting_date", now)
        .order("meeting_date", { ascending: true })
        .limit(20);

      const { data: ownPast } = await supabase
        .from("meetings")
        .select(selectFields)
        .eq("user_id", userId)
        .neq("status", "archived")
        .lt("meeting_date", now)
        .gte("meeting_date", thirtyDaysAgo.toISOString())
        .order("meeting_date", { ascending: false })
        .limit(10);

      const { data: participantData } = await supabase
        .from("meeting_participants")
        .select(`meeting_id, meetings(${selectFields})`)
        .eq("user_id", userId);

      const { data: publicMeetings } = await supabase
        .from("meetings")
        .select(selectFields)
        .eq("is_public", true)
        .neq("status", "archived")
        .gte("meeting_date", thirtyDaysAgo.toISOString());

      const ownIds = new Set([...(ownUpcoming || []).map(m => m.id), ...(ownPast || []).map(m => m.id)]);
      const participantMeetings = (participantData || [])
        .filter((p: any) => p.meetings && !ownIds.has(p.meetings.id) && p.meetings.status !== 'archived')
        .map((p: any) => p.meetings as Meeting);

      const allIds = new Set([...ownIds, ...participantMeetings.map(m => m.id)]);
      const publicExtra = (publicMeetings || []).filter(m => !allIds.has(m.id));
      const allMeetings: Meeting[] = [ ...(ownUpcoming || []), ...(ownPast || []), ...participantMeetings, ...publicExtra ];

      const seenIds = new Set<string>();
      const deduped = allMeetings.filter(m => {
        if (seenIds.has(m.id)) return false;
        seenIds.add(m.id);
        return true;
      });

      const upcoming = deduped
        .filter(m => new Date(m.meeting_date) >= new Date(now))
        .sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime())
        .slice(0, 20);

      const past = deduped
        .filter(m => new Date(m.meeting_date) < new Date(now))
        .sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime())
        .slice(0, 10);

      if (isMountedRef.current) {
        setUpcomingMeetings(upcoming);
        setPastMeetings(past);
      }
    } catch (error) {
      console.error("Error loading meetings:", error);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (userId) void loadMeetings();
  }, [userId, loadMeetings]);

  useEffect(() => {
    const allMeetingIds = [...upcomingMeetings, ...pastMeetings].map(m => m.id);
    if (allMeetingIds.length > 0) {
      void loadParticipantsForMeetings(allMeetingIds);
    }
  }, [upcomingMeetings, pastMeetings, loadParticipantsForMeetings]);

  return {
    upcomingMeetings,
    pastMeetings,
    meetingParticipants,
    loading,
  };
}
