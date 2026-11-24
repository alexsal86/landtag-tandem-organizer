import { HrReminderPanel } from "@/features/onboarding-hr/HrWorkspace";
import { AlertTriangle, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TeamAnnouncementsManager } from "@/components/announcements/TeamAnnouncementsManager";
import { MyWorkExpenseWidget } from "@/components/my-work/MyWorkExpenseWidget";
import { Button } from "@/components/ui/button";
import { TEAM_TAB_ACCESS_RULES, describeTeamDataIssues, useMyWorkTeamData } from "@/components/my-work/hooks/useMyWorkTeamData";
import { TeamMemberRow } from "@/components/my-work/team/TeamMemberRow";
import { MyWorkEmptyState } from "@/components/my-work/MyWorkEmptyState";

export function MyWorkTeamTab() {
  const navigate = useNavigate();
  const { loading, canViewTeam, userRole, teamMembers, issues, error, reload } = useMyWorkTeamData();

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
        {error ? (
          <>
            <p>Teamdaten konnten nicht geladen werden.</p>
            <p className="text-sm">{error.message}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void reload()}>
              Erneut laden
            </Button>
          </>
        ) : (
          <>
            <p>Mitarbeiterbereich</p>
            <p className="text-sm">Sichtbar nur für Abgeordnete und Büroleitung.</p>
            <p className="mx-auto mt-2 max-w-xl text-xs">
              Der Tab bündelt Mitarbeitergespräche, offene Anfragen und Hinweise zur Zeiterfassung und ist deshalb auf
              Rollen mit Teamverantwortung begrenzt.
            </p>
          </>
        )}
      </div>
    );
  }

  const problemMessages = [...(error ? [error.message] : []), ...describeTeamDataIssues(issues)];

  return (
    <div className="space-y-4 p-4">
      {problemMessages.length > 0 && (
        <div role="alert" className="flex flex-wrap items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium text-destructive">Teamdaten nicht vollständig geladen</p>
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              {problemMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Fehlende Werte werden nicht als 0 oder „Unbekannt“ angezeigt.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            Erneut laden
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(340px,1fr)]">
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
                  dataIssues={issues}
                  onOpenEmployeeArea={() => navigate(`/employee?employee=${encodeURIComponent(member.userId)}`)}
                />
              ))}
            </div>
          )}
        </section>
        <aside className="min-w-0 space-y-5">
          <HrReminderPanel />
          <TeamAnnouncementsManager compact />
          <MyWorkExpenseWidget userRole={userRole ?? ""} />
        </aside>
      </div>
    </div>
  );
}
