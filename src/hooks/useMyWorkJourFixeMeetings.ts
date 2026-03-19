import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  is_public?: boolean | null;
  user_id?: string;
}

interface MeetingParticipantMeetingRow {
  meeting_id: string;
  meetings: Meeting | Meeting[] | null;
}

const MEETING_SELECT = "id, title, meeting_date, meeting_time, status, description, is_public, user_id";

const extractMeeting = (row: MeetingParticipantMeetingRow): Meeting | null => {
  if (!row.meetings) return null;
  return Array.isArray(row.meetings) ? row.meetings[0] ?? null : row.meetings;
};

const getMeetingTimestamp = (meeting: Pick<Meeting, "meeting_date" | "meeting_time">) => {
  const time = meeting.meeting_time?.slice(0, 5);
  const meetingDateTime = time ? `${meeting.meeting_date}T${time}:00` : `${meeting.meeting_date}T23:59:59`;
  const parsed = new Date(meetingDateTime);
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
};

const fetchMeetings = async (userId: string) => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [ownUpcomingResult, ownPastResult, participantResult, publicResult] = await Promise.all([
    supabase
      .from("meetings")
      .select(MEETING_SELECT)
      .eq("user_id", userId)
      .neq("status", "archived")
      .gte("meeting_date", startOfToday.toISOString())
      .order("meeting_date", { ascending: true })
      .limit(20),
    supabase
      .from("meetings")
      .select(MEETING_SELECT)
      .eq("user_id", userId)
      .neq("status", "archived")
      .lt("meeting_date", startOfToday.toISOString())
      .gte("meeting_date", thirtyDaysAgo.toISOString())
      .order("meeting_date", { ascending: false })
      .limit(10),
    supabase
      .from("meeting_participants")
      .select(`meeting_id, meetings(${MEETING_SELECT})`)
      .eq("user_id", userId),
    supabase
      .from("meetings")
      .select(MEETING_SELECT)
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
    .map((row) => extractMeeting(row as MeetingParticipantMeetingRow))
    .filter((meeting): meeting is Meeting => Boolean(meeting && !ownIds.has(meeting.id) && meeting.status !== 'archived'));

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

  return { upcoming, past };
};

const fetchParticipants = async (meetingIds: string[]) => {
  if (meetingIds.length === 0) return {};

  const { data: participants, error: participantsError } = await supabase
    .from('meeting_participants')
    .select('meeting_id, user_id')
    .in('meeting_id', meetingIds);

  if (participantsError || !participants || participants.length === 0) return {};

  const userIds = [...new Set(participants.map(p => p.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url')
    .in('user_id', userIds);

  if (profilesError) return {};

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

  return participantsByMeeting;
};

export function useMyWorkJourFixeMeetings(userId?: string) {
  const queryClient = useQueryClient();

  const { data: meetingsData, isLoading: meetingsLoading } = useQuery({
    queryKey: ['my-work-jour-fixe-meetings', userId],
    queryFn: () => fetchMeetings(userId!),
    enabled: !!userId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const upcomingMeetings = meetingsData?.upcoming ?? [];
  const pastMeetings = meetingsData?.past ?? [];

  const allMeetingIds = useMemo(
    () => [...upcomingMeetings, ...pastMeetings].map(m => m.id),
    [upcomingMeetings, pastMeetings]
  );

  const { data: meetingParticipants = {} } = useQuery({
    queryKey: ['my-work-jour-fixe-participants', allMeetingIds],
    queryFn: () => fetchParticipants(allMeetingIds),
    enabled: allMeetingIds.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Realtime subscription with user_id filter where possible
  useEffect(() => {
    if (!userId) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        queryClient.invalidateQueries({ queryKey: ['my-work-jour-fixe-meetings', userId] });
      }, 300);
    };

    const channel = supabase
      .channel(`my-work-jour-fixe-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings", filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_participants", filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return {
    upcomingMeetings,
    pastMeetings,
    meetingParticipants,
    loading: meetingsLoading,
  };
}
