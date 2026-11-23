import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useRitualAction } from "./actions";
import { WeeklyAnswers } from "./WeeklyAnswers";
import { isValidWeeklyAnswer, ritualDashboardState } from "./logic";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
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
    <section className="animate-rise space-y-2" aria-label="Team-Rituale" style={{ animationDelay: "120ms" }}>
      <h2>
        <Link to="/employee?tab=rituals" aria-label="Frage der Woche – Team-Rituale öffnen"
          className="inline-flex items-center gap-1.5 rounded-sm text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          FRAGE DER WOCHE
          <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
        </Link>
      </h2>
      <div className="space-y-2">
        {state === "loading" ? (
          <p className="text-xs text-muted-foreground">Team-Rituale werden geladen …</p>
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
            <p className="text-xs font-medium text-foreground leading-snug">
              {data?.week?.question ?? "Zurzeit ist keine Frage aktiv."}
            </p>
            {data?.week && tenantId && !data.answers.some(answer => answer.user_id === userId) && <DashboardAnswer
              key={`${tenantId}:${userId}:${data.week.id}`}
              tenantId={tenantId}
              weekId={data.week.id}
            />}
            {data && <WeeklyAnswers answers={data.answers} userId={userId} compact />}
          </>
        )}

      </div>
    </section>
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
    <Label className="text-xs text-muted-foreground" htmlFor={id}>Deine Antwort</Label>
    <Textarea className="min-h-16 text-xs" rows={2} id={id} placeholder="Schreibe deine Antwort …" maxLength={280} value={answer} onChange={event => setAnswer(event.target.value)} disabled={busy} />
    <Button size="sm" className="h-7 text-xs" type="submit" disabled={busy || !isValidWeeklyAnswer(answer)}>{busy ? 'Wird gesendet …' : 'Antwort absenden'}</Button>
  </form>;
}
