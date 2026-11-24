import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { berlinDateTimeToInstant, berlinDayKey, shiftBerlinDay } from "@/utils/berlinDate";

export interface MeetingParticipant {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  /** Rückmeldung: pending | confirmed | declined | vacation */
  status?: string | null;
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

/**
 * Beginn eines Meetings als Zeitpunkt. `meeting_date` und `meeting_time` sind
 * Berliner Wandzeit – die Umrechnung läuft über die gemeinsame Berliner Logik,
 * damit die Browser-Zeitzone (und die Sommerzeit) keine Rolle spielt.
 */
const getMeetingTimestamp = (meeting: Pick<Meeting, "meeting_date" | "meeting_time">) => {
  const time = meeting.meeting_time?.slice(0, 5);
  const day = meeting.meeting_date.slice(0, 10);
  const parsed = berlinDateTimeToInstant(`${day}T${time || "23:59"}`);
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
};

const fetchMeetings = async (userId: string) => {
  const now = new Date();
  // `meeting_date` ist eine Kalenderspalte: verglichen wird der Berliner Tag,
  // nicht ein UTC-Zeitstempel (der zwischen 00:00 und 02:00 auf den Vortag fällt).
  const today = berlinDayKey(now);
  const thirtyDaysAgo = shiftBerlinDay(today, -30);

  const [ownUpcomingResult, ownPastResult, participantResult, publicResult] = await Promise.all([
    supabase
      .from("meetings")
      .select(MEETING_SELECT)
      .eq("user_id", userId)
      .neq("status", "archived")
      .gte("meeting_date", today)
      .order("meeting_date", { ascending: true })
      .limit(20),
    supabase
      .from("meetings")
      .select(MEETING_SELECT)
      .eq("user_id", userId)
      .neq("status", "archived")
      .lt("meeting_date", today)
      .gte("meeting_date", thirtyDaysAgo)
      .order("meeting_date", { ascending: false })
      .limit(10),
    supabase
      .from("meeting_participants")
      .select(`meeting_id, meetings(${MEETING_SELECT})`)
      .eq("user_id", userId)
      .limit(200),
    supabase
      .from("meetings")
      .select(MEETING_SELECT)
      .eq("is_public", true)
      .neq("status", "archived")
      .gte("meeting_date", thirtyDaysAgo)
      .order("meeting_date", { ascending: true })
      .limit(50),
  ]);

  if (ownUpcomingResult.error) throw ownUpcomingResult.error;
  if (ownPastResult.error) throw ownPastResult.error;
  if (participantResult.error) throw participantResult.error;
  if (publicResult.error) throw publicResult.error;

  const ownUpcoming = ownUpcomingResult.data || [];
  const ownPast = ownPastResult.data || [];
  const participantData = participantResult.data || [];
  const publicMeetings = publicResult.data || [];

  const ownUpcomingTyped = ownUpcoming as unknown as Meeting[];
  const ownPastTyped = ownPast as unknown as Meeting[];
  const participantTyped = participantData as unknown as MeetingParticipantMeetingRow[];
  const publicTyped = publicMeetings as unknown as Meeting[];

  const ownIds = new Set([...ownUpcomingTyped.map(m => m.id), ...ownPastTyped.map(m => m.id)]);
  const participantMeetings = participantTyped
    .map(row => extractMeeting(row))
    .filter((meeting): meeting is Meeting => Boolean(meeting && !ownIds.has(meeting.id) && meeting.status !== 'archived'));

  const allIds = new Set([...ownIds, ...participantMeetings.map(m => m.id)]);
  const publicExtra = publicTyped.filter(m => !allIds.has(m.id));
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
    .select('meeting_id, user_id, status')
    .in('meeting_id', meetingIds)
    .limit(500);

  if (participantsError) throw participantsError;
  if (!participants || participants.length === 0) return {};

  const participantRows = participants as Array<{ user_id: string; meeting_id: string; status: string | null }>;
  const userIds = [...new Set(participantRows.map((participant) => participant.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url')
    .in('user_id', userIds);

  if (profilesError) throw profilesError;

  const profilesByUserId = new Map<string, MeetingProfileRow>(
    ((profiles ?? []) as MeetingProfileRow[]).map((profile) => [profile.user_id, profile])
  );

  return participantRows.reduce<Record<string, MeetingParticipant[]>>((participantsByMeeting, participant) => {
    const profile = profilesByUserId.get(participant.user_id);
    const meetingParticipants = participantsByMeeting[participant.meeting_id] ?? [];

    meetingParticipants.push({
      user_id: participant.user_id,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      status: participant.status,
    });

    participantsByMeeting[participant.meeting_id] = meetingParticipants;
    return participantsByMeeting;
  }, {});
};

// Sichtbarkeit wird für INSERT und UPDATE serverseitig gefiltert (siehe Abos
// weiter unten). Eine zusätzliche Prüfung im Browser wäre doppelt und ist
// entfallen; nur DELETE braucht sie, weil Realtime Delete-Events nicht filtern
// kann (siehe Kommentar an den Delete-Abos).

export function useMyWorkJourFixeMeetings(userId?: string) {
  const queryClient = useQueryClient();

  const { data: meetingsData, isLoading: meetingsLoading, error: meetingsError } = useQuery({
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

  const { data: meetingParticipants = {}, error: participantsError } = useQuery({
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
      const touchedMeetingId = payload.new.id;
      scheduleInvalidation({
        meetings: true,
        participants: Boolean(touchedMeetingId && allMeetingIdSet.has(touchedMeetingId)),
      });
    };

    const handleMeetingDelete = (payload: RealtimePostgresChangesPayload<Meeting>) => {
      // Delete-Events liefern nur den Primärschlüssel und werden von Realtime
      // nicht gefiltert – hier ist die Prüfung Teil der Zustandspflege, nicht
      // eine doppelte Sichtbarkeitsfilterung.
      if (!payload.old.id || !allMeetingIdSet.has(payload.old.id)) return;
      scheduleInvalidation({ meetings: true, participants: true });
    };

    const handleMeetingParticipantChange = (payload: RealtimePostgresChangesPayload<MeetingParticipantRow>) => {
      scheduleInvalidation({
        // Nur eine neue Einladung bringt ein zusätzliches Meeting in die Liste;
        // eine geänderte Rückmeldung betrifft nur die Teilnehmeranzeige.
        meetings: payload.eventType === "INSERT" && payload.new.user_id === userId,
        participants: true,
      });
    };

    const handleMeetingParticipantDelete = () => {
      // Siehe handleMeetingDelete: kein Serverfilter möglich, deshalb werden die
      // Teilnehmenden der sichtbaren Meetings gebündelt neu geladen.
      scheduleInvalidation({ participants: true });
    };

    // INSERT und UPDATE werden serverseitig gefiltert: eigene Meetings,
    // öffentliche Meetings und die geladenen Meeting-IDs (Realtime erlaubt
    // höchstens 100 Werte pro in-Filter). DELETE lässt sich laut Supabase
    // grundsätzlich nicht filtern (nur der Primärschlüssel liegt vor), dafür
    // gibt es unten je Tabelle ein ungefiltertes Abo mit schlanker Prüfung.
    const visibleIds = allMeetingIds.slice(0, 100);
    let channel = supabase
      .channel(`my-work-jour-fixe-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "meetings", filter: `user_id=eq.${userId}` }, handleMeetingChange)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "meetings", filter: `user_id=eq.${userId}` }, handleMeetingChange)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "meetings", filter: "is_public=eq.true" }, handleMeetingChange)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "meetings", filter: "is_public=eq.true" }, handleMeetingChange)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "meetings" }, handleMeetingDelete)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "meeting_participants", filter: `user_id=eq.${userId}` }, handleMeetingParticipantChange)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "meeting_participants", filter: `user_id=eq.${userId}` }, handleMeetingParticipantChange)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "meeting_participants" }, handleMeetingParticipantDelete);

    if (visibleIds.length > 0) {
      const idFilter = `in.(${visibleIds.join(",")})`;
      channel = channel
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "meetings", filter: `id=${idFilter}` }, handleMeetingChange)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "meetings", filter: `id=${idFilter}` }, handleMeetingChange)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "meeting_participants", filter: `meeting_id=${idFilter}` }, handleMeetingParticipantChange)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "meeting_participants", filter: `meeting_id=${idFilter}` }, handleMeetingParticipantChange);
    }

    channel.subscribe();

    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [allMeetingIdSet, allMeetingIds, queryClient, userId]);

  return {
    upcomingMeetings,
    pastMeetings,
    meetingParticipants,
    data: { upcomingMeetings, pastMeetings, meetingParticipants },
    isLoading: meetingsLoading,
    loading: meetingsLoading,
    // Teilnehmerfehler verdecken die Meetings nicht: sie werden als Teilausfall
    // gemeldet, während die Jour fixes sichtbar bleiben.
    error: meetingsError?.message ?? null,
    isError: Boolean(meetingsError),
    failedSources: participantsError ? ['Teilnehmende'] : [],
    refetch: () => {
      void queryClient.refetchQueries({ queryKey: ['my-work-jour-fixe-meetings', userId], exact: true });
      void queryClient.refetchQueries({ queryKey: ['my-work-jour-fixe-participants'] });
    },
  };
}
