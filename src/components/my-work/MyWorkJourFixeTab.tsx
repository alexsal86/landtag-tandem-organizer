import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Calendar, Users, ExternalLink, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, isFuture } from "date-fns";
import { de } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  status: string;
  description?: string | null;
}

export function MyWorkJourFixeTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [pastMeetings, setPastMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [pastOpen, setPastOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadMeetings();
    }
  }, [user]);

  const loadMeetings = async () => {
    if (!user) return;
    
    try {
      const now = new Date().toISOString();
      
      // Load upcoming meetings
      const { data: upcoming, error: upcomingError } = await supabase
        .from("meetings")
        .select("id, title, meeting_date, status, description")
        .eq("user_id", user.id)
        .neq("status", "archived")
        .gte("meeting_date", now)
        .order("meeting_date", { ascending: true })
        .limit(20);

      if (upcomingError) throw upcomingError;

      // Load recent past meetings (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: past, error: pastError } = await supabase
        .from("meetings")
        .select("id, title, meeting_date, status, description")
        .eq("user_id", user.id)
        .neq("status", "archived")
        .lt("meeting_date", now)
        .gte("meeting_date", thirtyDaysAgo.toISOString())
        .order("meeting_date", { ascending: false })
        .limit(10);

      if (pastError) throw pastError;

      setUpcomingMeetings(upcoming || []);
      setPastMeetings(past || []);
    } catch (error) {
      console.error("Error loading meetings:", error);
    } finally {
      setLoading(false);
    }
  };

  const getMeetingStatusColor = (meeting: Meeting) => {
    const meetingDate = new Date(meeting.meeting_date);
    if (isToday(meetingDate)) return "text-orange-500";
    if (isPast(meetingDate)) return "text-muted-foreground";
    return "text-foreground";
  };

  const MeetingItem = ({ meeting }: { meeting: Meeting }) => {
    const meetingDate = new Date(meeting.meeting_date);

    return (
      <div 
        className="rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={() => navigate(`/jour-fixe/${meeting.id}`)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("font-medium text-sm truncate", getMeetingStatusColor(meeting))}>
                {meeting.title}
              </span>
              {isToday(meetingDate) && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-orange-100 text-orange-700">
                  Heute
                </Badge>
              )}
            </div>
            {meeting.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {meeting.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <div className={cn("flex items-center gap-1 text-xs", getMeetingStatusColor(meeting))}>
                <Calendar className="h-3 w-3" />
                {format(meetingDate, "dd.MM.yyyy", { locale: de })}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {format(meetingDate, "HH:mm", { locale: de })} Uhr
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/jour-fixe/${meeting.id}`);
            }}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  const totalMeetings = upcomingMeetings.length + pastMeetings.length;

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-4 p-4">
        {totalMeetings === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Keine Jour Fixe Meetings</p>
          </div>
        ) : (
          <>
            {/* Upcoming */}
            <Collapsible open={upcomingOpen} onOpenChange={setUpcomingOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                  <div className="flex items-center gap-2">
                    {upcomingOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-medium">Anstehend</span>
                  </div>
                  <Badge variant="secondary">{upcomingMeetings.length}</Badge>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {upcomingMeetings.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-2">Keine anstehenden Meetings</p>
                ) : (
                  upcomingMeetings.map((meeting) => <MeetingItem key={meeting.id} meeting={meeting} />)
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Past */}
            {pastMeetings.length > 0 && (
              <Collapsible open={pastOpen} onOpenChange={setPastOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                    <div className="flex items-center gap-2">
                      {pastOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="font-medium">Vergangene (30 Tage)</span>
                    </div>
                    <Badge variant="secondary">{pastMeetings.length}</Badge>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {pastMeetings.map((meeting) => <MeetingItem key={meeting.id} meeting={meeting} />)}
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
}
