import { Users, AlertTriangle, CalendarClock, MessageSquareMore } from "lucide-react";
import type { TeamOverviewMetrics } from "@/components/my-work/hooks/useMyWorkTeamData";

interface TeamOverviewHeaderProps {
  overview: TeamOverviewMetrics;
}

const items = [
  {
    key: "totalMembers",
    label: "Teammitglieder",
    icon: Users,
  },
  {
    key: "pendingMeetingRequests",
    label: "Offene Anfragen",
    icon: MessageSquareMore,
  },
  {
    key: "overdueMeetings",
    label: "Gespräche fällig",
    icon: CalendarClock,
  },
  {
    key: "membersWithoutRecentEntries",
    label: "Zeiterfassung prüfen",
    icon: AlertTriangle,
  },
] as const;

export function TeamOverviewHeader({ overview }: TeamOverviewHeaderProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.key} className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </div>
            <div className="mt-2 text-2xl font-semibold">{overview[item.key]}</div>
          </div>
        );
      })}
    </div>
  );
}
