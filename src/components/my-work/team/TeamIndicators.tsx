import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { TeamMemberViewModel } from "@/components/my-work/hooks/useMyWorkTeamData";

const indicatorClasses: Record<TeamMemberViewModel["workIndicatorVariant"], string> = {
  empty: "bg-muted-foreground/30",
  critical: "bg-destructive",
  warning: "bg-orange-500",
  progress: "bg-yellow-500",
  good: "bg-green-500",
  overtime: "bg-blue-500",
};

export function TeamIndicators({ member }: { member: TeamMemberViewModel }) {
  const today = format(new Date(), "EEEE", { locale: de });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "h-4 w-4 flex-shrink-0 cursor-help rounded-full",
            indicatorClasses[member.workIndicatorVariant],
          )}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-medium">
          Diese Woche: {member.workedHoursLabel} von {member.targetHoursLabel}h
        </p>
        <p className="text-muted-foreground">
          {member.workIndicatorLabel} (Stand: {today})
        </p>
        {member.lastTimeEntryDate && (
          <p className="text-muted-foreground">
            Letzter Eintrag: {format(new Date(member.lastTimeEntryDate), "dd.MM.yyyy", { locale: de })}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
