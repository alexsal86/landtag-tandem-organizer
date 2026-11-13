import { useState } from "react";
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
            {data?.week && tenantId && <DashboardAnswer
              key={`${tenantId}:${userId}:${data.week.id}`}
              tenantId={tenantId}
              weekId={data.week.id}
              ownAnswer={data.answers.find(answer => answer.user_id === userId)?.answer ?? ""}
            />}
            {data && <WeeklyAnswers answers={data.answers} userId={userId} />}
          </>
        )}
        <Link to="/employee?tab=rituals" aria-label="Team-Rituale öffnen" title="Team-Rituale öffnen" className="inline-flex rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2">
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

function DashboardAnswer({ tenantId, weekId, ownAnswer }: { tenantId: string; weekId: string; ownAnswer: string }) {
  const [answer, setAnswer] = useState(ownAnswer);
  const { busy, run } = useRitualAction(tenantId);
  const id = `dashboard-answer-${weekId}`;
  return <form className="space-y-2" onSubmit={event => {
    event.preventDefault();
    if (busy || !isValidWeeklyAnswer(answer)) return;
    void run(() => supabase.rpc('upsert_weekly_answer', { p_tenant: tenantId, p_week: weekId, p_answer: answer }));
  }}>
    <Label htmlFor={id}>Deine Antwort</Label>
    <Textarea id={id} placeholder="Schreibe deine Antwort …" maxLength={280} value={answer} onChange={event => setAnswer(event.target.value)} disabled={busy} />
    <Button size="sm" type="submit" disabled={busy || !isValidWeeklyAnswer(answer)}>{busy ? 'Wird gesendet …' : ownAnswer ? 'Antwort aktualisieren' : 'Antwort absenden'}</Button>
  </form>;
}
