import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TeamAnnouncementsManager } from "@/components/announcements/TeamAnnouncementsManager";
import { MyWorkExpenseWidget } from "@/components/my-work/MyWorkExpenseWidget";
import { useMyWorkTeamData } from "@/components/my-work/hooks/useMyWorkTeamData";
import { TeamMemberRow } from "@/components/my-work/team/TeamMemberRow";
import { TeamOverviewHeader } from "@/components/my-work/team/TeamOverviewHeader";

export function MyWorkTeamTab() {
  const navigate = useNavigate();
  const { loading, canViewTeam, userRole, teamMembers, overview, reload } = useMyWorkTeamData();

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-16 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (!canViewTeam) {
    return (
      <div className="p-4 py-8 text-center text-muted-foreground">
        <Users className="mx-auto mb-2 h-10 w-10 opacity-50" />
        <p>Mitarbeiterbereich</p>
        <p className="text-sm">Nur für Administratoren verfügbar</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0">
          <TeamAnnouncementsManager />
        </div>
        <div className="min-w-0 space-y-4">
          <MyWorkExpenseWidget userRole={userRole} />
          <Button variant="outline" size="sm" onClick={reload}>
            Teamdaten aktualisieren
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Teammitglieder</h3>
          <p className="text-sm text-muted-foreground">
            Überblick über Gesprächsbedarf, offene Meeting-Anfragen und aktuelle Zeiterfassung.
          </p>
        </div>

        <TeamOverviewHeader overview={overview} />

        {teamMembers.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Users className="mx-auto mb-2 h-10 w-10 opacity-50" />
            <p>Keine Mitarbeiter</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[32rem] pr-3">
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <TeamMemberRow
                  key={member.userId}
                  member={member}
                  onOpenEmployeeArea={() => navigate("/employee")}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
