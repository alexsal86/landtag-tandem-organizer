import { ritualDashboardState } from "./logic";
import { Link } from "react-router-dom";
import { Users, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { useTeamRituals } from "./data";
/** Discovery is always visible; feature activation and personal participation remain explicit. */
export function TeamRitualDashboardCard() {
  const { data, error, isPending } = useTeamRituals();
  const { isAdmin } = useResolvedUserRole();
  const state = ritualDashboardState(
    isPending,
    !!error,
    !!data?.enabled,
    !!data?.own?.opted_in,
  );
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5" />
          Team-Rituale
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Frage der Woche · Zwei Wahrheiten, eine Lüge · Mandats-Bingo ·
          gemeinsame Anlässe
        </p>
        {state === "loading" ? (
          <p className="text-sm">Team-Rituale werden geladen …</p>
        ) : state === "unavailable" ? (
          <p className="text-sm" role="status">
            Team-Rituale sind derzeit nicht verfügbar. Der Mitarbeiterbereich
            bleibt über den Button erreichbar.
          </p>
        ) : state === "disabled" ? (
          <p className="text-sm">
            Für dieses Büro noch ausgeschaltet.
            {isAdmin
              ? " Du kannst die Team-Rituale im Mitarbeiterbereich freigeben."
              : ""}{" "}
            Die Teilnahme bleibt freiwillig.
          </p>
        ) : state === "join" ? (
          <p className="text-sm">
            Team-Rituale sind verfügbar. Entscheide selbst, ob du teilnehmen
            möchtest.
          </p>
        ) : (
          <p className="text-sm font-medium">
            {data?.week?.question ??
              "Entdecke die aktuellen Team-Rituale im Mitarbeiterbereich."}
          </p>
        )}
        <Button asChild variant="outline">
          <Link to="/employee?tab=rituals">
            {isAdmin && !data?.enabled
              ? "Team-Rituale öffnen und einrichten"
              : "Team-Rituale öffnen"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
