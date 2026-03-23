import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Calendar, Clock, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { WorkStatusIndicator } from "@/components/my-work/team/WorkStatusIndicator";
import type { TeamMemberViewModel } from "@/components/my-work/hooks/useMyWorkTeamData";

interface TeamMemberRowProps {
  member: TeamMemberViewModel;
  onOpenEmployeeArea: () => void;
}

export function TeamMemberRow({ member, onOpenEmployeeArea }: TeamMemberRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50">
      <Avatar className="h-9 w-9">
        <AvatarImage src={member.avatarUrl || undefined} />
        <AvatarFallback>{member.initials}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <WorkStatusIndicator workStatus={member.workStatus} />
          <span className="text-sm font-medium">{member.displayName}</span>

          {member.workStatus.needsAttention && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p>Kein Zeiteintrag seit {member.workStatus.daysWithoutEntry} Werktagen</p>
              </TooltipContent>
            </Tooltip>
          )}

          {member.openMeetingRequests > 0 && (
            <Badge variant="destructive" className="text-xs">
              {member.openMeetingRequests} Anfrage{member.openMeetingRequests > 1 ? "n" : ""}
            </Badge>
          )}

          {member.meetingStatus && (
            <Badge variant={member.meetingStatus.variant} className="text-xs">
              {member.meetingStatus.label}
            </Badge>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {member.hoursPerWeek}h/Woche
          </span>
          {member.lastMeetingDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Letztes Gespräch: {format(new Date(member.lastMeetingDate), "dd.MM.yyyy", { locale: de })}
            </span>
          )}
        </div>
      </div>

      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={onOpenEmployeeArea}>
        <ExternalLink className="h-3 w-3" />
      </Button>
    </div>
  );
}
