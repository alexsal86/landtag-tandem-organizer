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

  const getMeetingTimestamp = useCallback((meeting: Pick<Meeting, "meeting_date" | "meeting_time">) => {
    const time = meeting.meeting_time?.slice(0, 5);
    const meetingDateTime = time ? `${meeting.meeting_date}T${time}:00` : `${meeting.meeting_date}T23:59:59`;
    const parsed = new Date(meetingDateTime);
    return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
  }, []);

  const loadParticipantsForMeetings = useCallback(async (meetingIds: string[]) => {
    if (meetingIds.length === 0) {
      if (isMountedRef.current) setMeetingParticipants({});
      return;
    }

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
    if (!userId) {
      if (isMountedRef.current) {
        setUpcomingMeetings([]);
        setPastMeetings([]);
        setMeetingParticipants({});
        setLoading(false);
      }
      return;
    }

    try {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const selectFields = "id, title, meeting_date, meeting_time, status, description, is_public, user_id";

      const [ownUpcomingResult, ownPastResult, participantResult, publicResult] = await Promise.all([
        supabase
          .from("meetings")
          .select(selectFields)
          .eq("user_id", userId)
          .neq("status", "archived")
          .gte("meeting_date", startOfToday.toISOString())
          .order("meeting_date", { ascending: true })
          .limit(20),
        supabase
          .from("meetings")
          .select(selectFields)
          .eq("user_id", userId)
          .neq("status", "archived")
          .lt("meeting_date", startOfToday.toISOString())
          .gte("meeting_date", thirtyDaysAgo.toISOString())
          .order("meeting_date", { ascending: false })
          .limit(10),
        supabase
          .from("meeting_participants")
          .select(`meeting_id, meetings(${selectFields})`)
          .eq("user_id", userId),
        supabase
          .from("meetings")
          .select(selectFields)
          .eq("is_public", true)
          .neq("status", "archived")
          .gte("meeting_date", thirtyDaysAgo.toISOString()),
      ]);

      if (ownUpcomingResult.error) throw ownUpcomingResult.error;
      if (ownPastResult.error) throw ownPastResult.error;
      if (participantResult.error) throw participantResult.error;
      if (publicResult.error) throw publicResult.error;

      const ownUpcoming = ownUpcomingResult.data || [];
      const ownPast = ownPastResult.data || [];
      const participantData = participantResult.data || [];
      const publicMeetings = publicResult.data || [];

      const ownIds = new Set([...ownUpcoming.map(m => m.id), ...ownPast.map(m => m.id)]);
      const participantMeetings = participantData
        .filter((p: any) => p.meetings && !ownIds.has(p.meetings.id) && p.meetings.status !== 'archived')
        .map((p: any) => p.meetings as Meeting);

      const allIds = new Set([...ownIds, ...participantMeetings.map(m => m.id)]);
      const publicExtra = publicMeetings.filter(m => !allIds.has(m.id));
      const allMeetings: Meeting[] = [...ownUpcoming, ...ownPast, ...participantMeetings, ...publicExtra];

      const seenIds = new Set<string>();
      const deduped = allMeetings.filter(m => {
        if (seenIds.has(m.id)) return false;
        seenIds.add(m.id);
        return true;
      });

      const upcoming = deduped
        .filter(m => getMeetingTimestamp(m) >= now.getTime())
        .sort((a, b) => getMeetingTimestamp(a) - getMeetingTimestamp(b))
        .slice(0, 20);

      const past = deduped
        .filter(m => getMeetingTimestamp(m) < now.getTime())
        .sort((a, b) => getMeetingTimestamp(b) - getMeetingTimestamp(a))
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
  }, [getMeetingTimestamp, userId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  useEffect(() => {
    const allMeetingIds = [...upcomingMeetings, ...pastMeetings].map(m => m.id);
    void loadParticipantsForMeetings(allMeetingIds);
  }, [upcomingMeetings, pastMeetings, loadParticipantsForMeetings]);

  return {
    upcomingMeetings,
    pastMeetings,
    meetingParticipants,
    loading,
  };
}
