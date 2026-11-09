import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TeamAnnouncementsManager } from "@/components/announcements/TeamAnnouncementsManager";
import { MyWorkExpenseWidget } from "@/components/my-work/MyWorkExpenseWidget";
import { TEAM_TAB_ACCESS_RULES, useMyWorkTeamData } from "@/components/my-work/hooks/useMyWorkTeamData";
import { TeamMemberRow } from "@/components/my-work/team/TeamMemberRow";
import { MyWorkEmptyState } from "@/components/my-work/MyWorkEmptyState";

export function MyWorkTeamTab() {
  const navigate = useNavigate();
  const { loading, canViewTeam, userRole, teamMembers, reload } = useMyWorkTeamData();

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
        <p className="text-sm">Sichtbar nur für Abgeordnete und Büroleitung.</p>
        <p className="mx-auto mt-2 max-w-xl text-xs">
          Der Tab bündelt Mitarbeitergespräche, offene Anfragen und Hinweise zur Zeiterfassung und ist deshalb auf
          Rollen mit Teamverantwortung begrenzt.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 p-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(340px,1fr)]">
      <section className="min-w-0 overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div>
            <h3 className="text-lg font-semibold">Teammitglieder</h3>
            <p className="text-sm text-muted-foreground">
              {teamMembers.length} von {teamMembers.length} angezeigt · sortiert nach Dringlichkeit
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Sichtbar für {TEAM_TAB_ACCESS_RULES.map((rule) => rule.label).join(" und ")}
          </p>
        </div>
        <div className="hidden grid-cols-[1.15fr_0.9fr_1fr_auto] gap-4 border-b bg-muted/50 px-5 py-3 text-xs uppercase tracking-wide text-muted-foreground md:grid">
          <span>Person</span>
          <span>Mitarbeitergespräch</span>
          <span>Zeiterfassung (diese Woche)</span>
          <span className="w-24" />
        </div>

        {teamMembers.length === 0 ? (
          <MyWorkEmptyState
            icon={Users}
            title="Noch keine Teammitglieder"
            description="Lade Mitarbeitende ein, um Gespräche zu koordinieren und die Zeiterfassung im Blick zu behalten."
            actionLabel="Mitarbeiter verwalten"
            onAction={() => navigate("/employee")}
          />
        ) : (
          <div className="divide-y">
              {teamMembers.map((member) => (
                <TeamMemberRow
                  key={member.userId}
                  member={member}
                  onOpenEmployeeArea={() => navigate("/employee")}
                />
              ))}
          </div>
        )}
      </section>
      <aside className="min-w-0 space-y-5">
        <TeamAnnouncementsManager compact />
        <MyWorkExpenseWidget userRole={userRole} />
        <Button variant="ghost" size="sm" onClick={reload}>Teamdaten aktualisieren</Button>
      </aside>
    </div>
  );
}
