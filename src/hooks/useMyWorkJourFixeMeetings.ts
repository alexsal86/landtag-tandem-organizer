import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
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

interface MeetingParticipantRow {
  meeting_id: string;
  user_id: string;
}

interface MeetingProfileRow {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
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

  const ownIds = new Set([...ownUpcoming.map((m: Record<string, any>) => m.id), ...ownPast.map((m: Record<string, any>) => m.id)]);
  const participantMeetings = participantData
    .map((row: Record<string, any>) => extractMeeting(row as MeetingParticipantMeetingRow))
    .filter((meeting: Record<string, any>): meeting is Meeting => Boolean(meeting && !ownIds.has(meeting.id) && meeting.status !== 'archived'));

  const allIds = new Set([...ownIds, ...participantMeetings.map((m: Record<string, any>) => m.id)]);
  const publicExtra = publicMeetings.filter((m: Record<string, any>) => !allIds.has(m.id));
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

  const userIds = [...new Set(participants.map((p: Record<string, any>) => p.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url')
    .in('user_id', userIds);

  if (profilesError) return {};

  const profilesByUserId = new Map<string, MeetingProfileRow>(
    (profiles ?? []).map((profile: Record<string, any>) => [profile.user_id, profile])
  );

  return (participants as any[]).reduce<Record<string, MeetingParticipant[]>>((participantsByMeeting, participant) => {
    const profile = profilesByUserId.get(participant.user_id);
    const meetingParticipants = participantsByMeeting[participant.meeting_id] ?? [];

    meetingParticipants.push({
      user_id: participant.user_id,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    });

    participantsByMeeting[participant.meeting_id] = meetingParticipants;
    return participantsByMeeting;
  }, {});
};

const shouldRefreshMeetings = ({
  payload,
  userId,
  visibleMeetingIds,
}: {
  payload: RealtimePostgresChangesPayload<Meeting>;
  userId: string;
  visibleMeetingIds: Set<string>;
}) => {
  const newMeeting = payload.new;
  const oldMeeting = payload.old;
  const touchedMeetingId = newMeeting.id ?? oldMeeting.id;

  const ownedByUser = newMeeting.user_id === userId || oldMeeting.user_id === userId;
  const currentlyVisible = touchedMeetingId ? visibleMeetingIds.has(touchedMeetingId) : false;
  const publicVisibilityChanged = newMeeting.is_public !== oldMeeting.is_public;
  const touchesPublicMeeting = newMeeting.is_public === true || oldMeeting.is_public === true;

  return ownedByUser || currentlyVisible || publicVisibilityChanged || touchesPublicMeeting;
};

const shouldRefreshMeetingParticipants = ({
  payload,
  userId,
  visibleMeetingIds,
}: {
  payload: RealtimePostgresChangesPayload<MeetingParticipantRow>;
  userId: string;
  visibleMeetingIds: Set<string>;
}) => {
  const newParticipant = payload.new;
  const oldParticipant = payload.old;
  const touchedMeetingId = newParticipant.meeting_id ?? oldParticipant.meeting_id;

  return (
    newParticipant.user_id === userId ||
    oldParticipant.user_id === userId ||
    (touchedMeetingId ? visibleMeetingIds.has(touchedMeetingId) : false)
  );
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

  const allMeetingIdSet = useMemo(() => new Set(allMeetingIds), [allMeetingIds]);

  const { data: meetingParticipants = {} } = useQuery({
    queryKey: ['my-work-jour-fixe-participants', allMeetingIds],
    queryFn: () => fetchParticipants(allMeetingIds),
    enabled: allMeetingIds.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!userId) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let refreshMeetings = false;
    let refreshParticipants = false;

    const scheduleInvalidation = (next: { meetings?: boolean; participants?: boolean }) => {
      refreshMeetings = refreshMeetings || Boolean(next.meetings);
      refreshParticipants = refreshParticipants || Boolean(next.participants);

      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (refreshMeetings) {
          queryClient.invalidateQueries({ queryKey: ['my-work-jour-fixe-meetings', userId] });
        }
        if (refreshParticipants && allMeetingIds.length > 0) {
          queryClient.invalidateQueries({ queryKey: ['my-work-jour-fixe-participants'] });
        }

        refreshMeetings = false;
        refreshParticipants = false;
        timeout = null;
      }, 300);
    };

    const handleMeetingChange = (payload: RealtimePostgresChangesPayload<Meeting>) => {
      if (!shouldRefreshMeetings({ payload, userId, visibleMeetingIds: allMeetingIdSet })) return;

      const touchedMeetingId = payload.new.id ?? payload.old.id;
      scheduleInvalidation({
        meetings: true,
        participants: touchedMeetingId ? allMeetingIdSet.has(touchedMeetingId) : false,
      });
    };

    const handleMeetingParticipantChange = (payload: RealtimePostgresChangesPayload<MeetingParticipantRow>) => {
      if (!shouldRefreshMeetingParticipants({ payload, userId, visibleMeetingIds: allMeetingIdSet })) return;

      const touchedMeetingId = payload.new.meeting_id ?? payload.old.meeting_id;
      scheduleInvalidation({
        meetings: payload.new.user_id === userId || payload.old.user_id === userId,
        participants: touchedMeetingId ? allMeetingIdSet.has(touchedMeetingId) : true,
      });
    };

    const channel = supabase
      .channel(`my-work-jour-fixe-${userId}`)
      // Kein Filter auf meetings: Der Tab zeigt eigene, zugewiesene und öffentliche Meetings.
      // Ein DB-Filter auf user_id würde öffentliche Meetings anderer Besitzer übersehen,
      // und ein Filter auf is_public würde Übergänge privat <-> öffentlich nicht zuverlässig abdecken.
      .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, handleMeetingChange)
      // Filter auf meeting_participants nur nach user_id wäre zu eng, weil der Tab auch Avatar-/Teilnehmeränderungen
      // für bereits sichtbare Meetings anderer Nutzer zeigen soll. Deshalb abonnieren wir alle Änderungen und
      // prüfen lokal, ob entweder die eigene Teilnahme oder eines der aktuell sichtbaren Meetings betroffen ist.
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_participants" }, handleMeetingParticipantChange)
      .subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [allMeetingIdSet, allMeetingIds.length, queryClient, userId]);

  return {
    upcomingMeetings,
    pastMeetings,
    meetingParticipants,
    data: { upcomingMeetings, pastMeetings, meetingParticipants },
    isLoading: meetingsLoading,
    loading: meetingsLoading,
    error: null,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['my-work-jour-fixe-meetings', userId] }),
  };
}
