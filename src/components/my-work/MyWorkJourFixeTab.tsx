import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useMyWorkJourFixeMeetings } from "@/hooks/useMyWorkJourFixeMeetings";
import { JourFixeMeetingAgenda } from "@/components/my-work/jour-fixe/JourFixeMeetingAgenda";
import { JourFixeMeetingCard } from "@/components/my-work/jour-fixe/JourFixeMeetingCard";
import { JourFixeMeetingList } from "@/components/my-work/jour-fixe/JourFixeMeetingList";
import { useJourFixeAgenda } from "@/components/my-work/hooks/useJourFixeAgenda";
import { StandaloneMeetingCreator } from "@/components/meetings/StandaloneMeetingCreator";

export function MyWorkJourFixeTab() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { upcomingMeetings, pastMeetings, meetingParticipants, loading, refetch } = useMyWorkJourFixeMeetings(user?.id);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [pastOpen, setPastOpen] = useState(false);
  const { expandedMeetingId, toggleMeeting, getAgendaData, systemDataMaps } = useJourFixeAgenda(user?.id, currentTenant?.id);
  const [isCreateMeetingOpen, setIsCreateMeetingOpen] = useState(false);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "create-meeting") {
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
      setIsCreateMeetingOpen(true);
    }
  }, [searchParams, setSearchParams]);

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-16 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  const totalMeetings = upcomingMeetings.length + pastMeetings.length;

  return (
    <section className="space-y-4 p-4">
      <h3 className="text-sm font-semibold text-foreground">Meeting-Übersicht</h3>
      {totalMeetings === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Keine Jour Fixe Meetings</p>
        </div>
      ) : (
        <>
          <JourFixeMeetingList
            title="Anstehend"
            meetings={upcomingMeetings}
            emptyText="Keine anstehenden Meetings"
            open={upcomingOpen}
            setOpen={setUpcomingOpen}
          >
            {upcomingMeetings.map((meeting) => (
              <JourFixeMeetingCard
                key={meeting.id}
                meeting={meeting}
                participants={meetingParticipants[meeting.id] || []}
                currentUserId={user?.id}
                isExpanded={expandedMeetingId === meeting.id}
                onToggleExpand={() => toggleMeeting(meeting.id, meeting.meeting_date)}
                onNavigate={() => navigate(`/meetings?id=${meeting.id}`)}
                agendaContent={
                  <JourFixeMeetingAgenda
                    agenda={getAgendaData(meeting.id)}
                    systemData={systemDataMaps}
                  />
                }
              />
            ))}
          </JourFixeMeetingList>

          {pastMeetings.length > 0 && (
            <JourFixeMeetingList
              title="Vergangene (30 Tage)"
              meetings={pastMeetings}
              emptyText="Keine vergangenen Meetings"
              open={pastOpen}
              setOpen={setPastOpen}
            >
              {pastMeetings.map((meeting) => (
                <JourFixeMeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  participants={meetingParticipants[meeting.id] || []}
                  currentUserId={user?.id}
                  isExpanded={expandedMeetingId === meeting.id}
                  onToggleExpand={() => toggleMeeting(meeting.id, meeting.meeting_date)}
                  onNavigate={() => navigate(`/meetings?id=${meeting.id}`)}
                  agendaContent={
                    <JourFixeMeetingAgenda
                      agenda={getAgendaData(meeting.id)}
                      systemData={systemDataMaps}
                    />
                  }
                />
              ))}
            </JourFixeMeetingList>
          )}
        </>
      )}

      <StandaloneMeetingCreator
        open={isCreateMeetingOpen}
        onOpenChange={setIsCreateMeetingOpen}
        onMeetingCreated={() => refetch?.()}
      />
    </section>
  );
}
