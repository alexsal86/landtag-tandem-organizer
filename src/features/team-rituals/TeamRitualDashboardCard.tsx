import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useRitualAction } from "./actions";
import { WeeklyAnswers } from "./WeeklyAnswers";
import { isValidWeeklyAnswer, ritualDashboardState } from "./logic";
import { Link } from "react-router-dom";
import { Users, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { useTeamRituals } from "./data";
/** Discovery is always visible; feature activation and personal participation remain explicit. */
export function TeamRitualDashboardCard() {
  const { data, error, isPending, tenantId, userId } = useTeamRituals();
  const { isAdmin } = useResolvedUserRole();
  const [showLinkLabel, setShowLinkLabel] = useState(true);
  useEffect(() => {
    const timeout = window.setTimeout(() => setShowLinkLabel(false), 3000);
    return () => window.clearTimeout(timeout);
  }, []);
  const state = ritualDashboardState(
    isPending,
    !!error,
    !!data?.enabled,
    !!data?.own?.opted_in,
  );
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5" />
          Team-Rituale
        </CardTitle>
        <Link to="/employee?tab=rituals" aria-label="Team-Rituale öffnen"
          className="group/ritual ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-sm text-foreground transition-colors duration-base ease-standard hover:bg-muted focus-visible:outline-foreground">
          <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className={`overflow-hidden whitespace-nowrap transition-all duration-slow ease-emphasized motion-reduce:transition-none ${showLinkLabel ? "max-w-48 opacity-100" : "max-w-0 opacity-0 group-hover/ritual:max-w-48 group-hover/ritual:opacity-100 group-focus-visible/ritual:max-w-48 group-focus-visible/ritual:opacity-100"}`}>
            Team-Rituale öffnen
          </span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {state === "loading" ? (
          <p className="text-sm">Team-Rituale werden geladen …</p>
        ) : state === "unavailable" ? (
          <p className="text-sm" role="status">
            Team-Rituale sind derzeit nicht verfügbar. Der Mitarbeiterbereich
            bleibt über den Pfeil erreichbar.
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
          <>
            <p className="text-sm font-medium">
              {data?.week?.question ?? "Zurzeit ist keine Frage aktiv."}
            </p>
            {data?.week && tenantId && !data.answers.some(answer => answer.user_id === userId) && <DashboardAnswer
              key={`${tenantId}:${userId}:${data.week.id}`}
              tenantId={tenantId}
              weekId={data.week.id}
            />}
            {data && <WeeklyAnswers answers={data.answers} userId={userId} />}
          </>
        )}

      </CardContent>
    </Card>
  );
}

function DashboardAnswer({ tenantId, weekId }: { tenantId: string; weekId: string }) {
  const [answer, setAnswer] = useState("");
  const { busy, run } = useRitualAction(tenantId);
  const id = `dashboard-answer-${weekId}`;
  return <form className="space-y-2" onSubmit={event => {
    event.preventDefault();
    if (busy || !isValidWeeklyAnswer(answer)) return;
    void run(() => supabase.rpc('upsert_weekly_answer', { p_tenant: tenantId, p_week: weekId, p_answer: answer }));
  }}>
    <Label htmlFor={id}>Deine Antwort</Label>
    <Textarea id={id} placeholder="Schreibe deine Antwort …" maxLength={280} value={answer} onChange={event => setAnswer(event.target.value)} disabled={busy} />
    <Button size="sm" type="submit" disabled={busy || !isValidWeeklyAnswer(answer)}>{busy ? 'Wird gesendet …' : 'Antwort absenden'}</Button>
  </form>;
}
