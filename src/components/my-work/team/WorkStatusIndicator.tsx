import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { TeamWorkStatusViewModel, WorkIndicatorVariant } from "@/components/my-work/hooks/useMyWorkTeamData";

const indicatorClasses: Record<WorkIndicatorVariant, string> = {
  empty: "bg-muted-foreground/30",
  critical: "bg-destructive",
  warning: "bg-orange-500",
  progress: "bg-yellow-500",
  good: "bg-green-500",
  overtime: "bg-blue-500",
};

interface WorkStatusIndicatorProps {
  workStatus: TeamWorkStatusViewModel;
}

export function WorkStatusIndicator({ workStatus }: WorkStatusIndicatorProps) {
  const todayLabel = format(new Date(), "EEEE", { locale: de });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn("h-4 w-4 flex-shrink-0 cursor-help rounded-full", indicatorClasses[workStatus.indicatorVariant])}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-medium">
          Diese Woche: {workStatus.workedHoursLabel} von {workStatus.targetHoursLabel}h
        </p>
        <p className="text-muted-foreground">
          {workStatus.indicatorLabel} (Stand: {todayLabel})
        </p>
        {workStatus.lastTimeEntryDate && (
          <p className="text-muted-foreground">
            Letzter Eintrag: {format(new Date(workStatus.lastTimeEntryDate), "dd.MM.yyyy", { locale: de })}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
