import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { mentionColors } from "@/utils/mentionColors";
import { getHashedColor } from "@/utils/userColors";
import { cn } from "@/lib/utils";
import type { TeamMemberViewModel } from "@/components/my-work/hooks/useMyWorkTeamData";

interface TeamMemberRowProps {
  member: TeamMemberViewModel;
  onOpenEmployeeArea: () => void;
}

const progressColors = {
  empty: "bg-muted-foreground/30",
  critical: "bg-destructive",
  warning: "bg-palette-orange",
  progress: "bg-palette-yellow",
  good: "bg-palette-green",
  overtime: "bg-palette-blue",
};

export function TeamMemberRow({ member, onOpenEmployeeArea }: TeamMemberRowProps) {
  const color = mentionColors(member.badgeColor || getHashedColor(member.userId));
  const hours = (minutes: number) => (minutes / 60).toLocaleString("de-DE", { maximumFractionDigits: 1 });
  const percentage = member.weeklyTargetMinutes > 0
    ? Math.min(100, (member.weeklyWorkedMinutes / member.weeklyTargetMinutes) * 100) : 0;

  return (
    <div className="grid grid-cols-1 items-center gap-4 px-5 py-5 transition-colors hover:bg-muted/30 md:grid-cols-[1.15fr_0.9fr_1fr_auto]">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-11 w-11 shrink-0">
          <AvatarImage src={member.avatarUrl || undefined} alt={member.displayName} />
          <AvatarFallback style={{ backgroundColor: color.background, color: color.text }} className="font-semibold">
            {member.initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="break-words font-semibold">{member.displayName}</p>
          <p className="text-sm text-muted-foreground">{member.hoursPerWeek.toLocaleString("de-DE")} h/Woche</p>
        </div>
      </div>
      <div className="space-y-1 text-sm">
        <p className="text-xs text-muted-foreground md:hidden">Mitarbeitergespräch</p>
        {!member.lastMeetingDate && <Badge variant="outline" className="border-palette-amber/30 bg-palette-amber/10 text-palette-amber">Erstgespräch offen</Badge>}
        {member.meetingStatus && (
          <Badge variant="secondary" className={cn("border-0", member.meetingStatus.variant === "destructive" && "bg-destructive/10 text-destructive")}>
            {member.meetingStatus.label}
          </Badge>
        )}
        <p className="text-muted-foreground">{member.lastMeetingDate ? `Zuletzt ${format(new Date(member.lastMeetingDate), "dd.MM.yyyy")}` : "Noch kein Gespräch"}</p>
        {member.nextMeetingDue && (
          <p className="text-muted-foreground">{member.meetingStatus?.variant === "destructive" ? "Fällig war" : "Fällig am"} {format(new Date(member.nextMeetingDue), "dd.MM.yyyy")}</p>
        )}
        {member.openMeetingRequests > 0 && <Badge variant="outline" className="border-palette-blue/30 bg-palette-blue/10 text-palette-blue">{member.openMeetingRequests} offene Anfrage{member.openMeetingRequests > 1 ? "n" : ""}</Badge>}
      </div>
      <div className="min-w-0 space-y-2">
        <p className="text-xs text-muted-foreground md:hidden">Zeiterfassung (diese Woche)</p>
        <p className="text-sm"><strong>{hours(member.weeklyWorkedMinutes)}</strong> von {hours(member.weeklyTargetMinutes)} h</p>
        <div role="progressbar" aria-label={`Zeiterfassung ${member.displayName}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percentage)} aria-valuetext={`${hours(member.weeklyWorkedMinutes)} von ${hours(member.weeklyTargetMinutes)} Stunden`} className="h-2 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", progressColors[member.workStatus.indicatorVariant])} style={{ width: `${percentage}%` }} />
        </div>
        {member.workStatus.needsAttention && (
          <span className="inline-block rounded-full bg-palette-amber/10 px-2 py-0.5 text-xs font-medium text-palette-amber">
            {member.workStatus.daysWithoutEntry !== null ? `Kein Eintrag seit ${member.workStatus.daysWithoutEntry} Werktagen` : "Noch kein Zeiteintrag"}
          </span>
        )}
      </div>
      <Button variant="outline" size="sm" className="w-24 gap-2" onClick={onOpenEmployeeArea} aria-label={`Mitarbeiterbereich für ${member.displayName} öffnen`}>
        <ExternalLink className="h-4 w-4" /> Öffnen
      </Button>
    </div>
  );
}
