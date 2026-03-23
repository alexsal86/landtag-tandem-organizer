import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown, ChevronRight, Clock, ExternalLink, Globe, Users } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Meeting, MeetingParticipant } from "@/hooks/useMyWorkJourFixeMeetings";
import { getInitials } from "./utils";

interface JourFixeMeetingCardProps {
  meeting: Meeting;
  participants: MeetingParticipant[];
  currentUserId?: string;
  isExpanded: boolean;
  onToggleExpand: () => void | Promise<void>;
  onNavigate: () => void;
  agendaContent?: ReactNode;
}

const getMeetingStatusColor = (meeting: Meeting) => {
  const meetingDate = new Date(meeting.meeting_date);
  if (isToday(meetingDate)) return "text-orange-500";
  if (isPast(meetingDate)) return "text-muted-foreground";
  return "text-foreground";
};

export function JourFixeMeetingCard({
  meeting,
  participants,
  currentUserId,
  isExpanded,
  onToggleExpand,
  onNavigate,
  agendaContent,
}: JourFixeMeetingCardProps) {
  const meetingDate = new Date(meeting.meeting_date);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="p-3 hover:bg-muted/50 transition-colors cursor-pointer" onClick={onToggleExpand}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              )}
              <span className={cn("font-semibold text-base truncate", getMeetingStatusColor(meeting))}>{meeting.title}</span>
              {meeting.is_public && meeting.user_id !== currentUserId && (
                <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}
              {isToday(meetingDate) && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-orange-100 text-orange-700">
                  Heute
                </Badge>
              )}
            </div>
            {meeting.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 ml-6">{meeting.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5 ml-6">
              <div className={cn("flex items-center gap-1 text-xs", getMeetingStatusColor(meeting))}>
                <Calendar className="h-3 w-3" />
                {format(meetingDate, "dd.MM.yyyy", { locale: de })}
              </div>
              {meeting.meeting_time && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {meeting.meeting_time.substring(0, 5)} Uhr
                </div>
              )}
              {participants.length > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <div className="flex -space-x-1">
                    {participants.slice(0, 3).map((participant) => (
                      <Avatar key={participant.user_id} className="h-5 w-5 border border-background">
                        <AvatarImage src={participant.avatar_url || undefined} />
                        <AvatarFallback className="text-[8px]">{getInitials(participant.display_name)}</AvatarFallback>
                      </Avatar>
                    ))}
                    {participants.length > 3 && (
                      <span className="text-xs text-muted-foreground ml-1">+{participants.length - 3}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={(event) => {
              event.stopPropagation();
              onNavigate();
            }}
            title="Zum Jour Fixe"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {isExpanded && agendaContent}
    </div>
  );
}
