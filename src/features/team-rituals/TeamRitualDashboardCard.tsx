import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useRitualAction } from "./actions";
import { WeeklyParticipation } from "./WeeklyParticipation";
import { useAlerts } from "@/features/appointments/change-alerts/AppointmentChangeAlerts";
import { useWorkspaceView } from "@/contexts/WorkspaceViewContext";
import { isValidWeeklyAnswer, ritualDashboardState, weeklyQuestionDaysLeft, weeklyQuestionIsCompact } from "./logic";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { useTeamRituals } from "./data";
/** Discovery is always visible; feature activation and personal participation remain explicit. */
export function TeamRitualDashboardCard() {
  const { data, error, isPending, tenantId, userId } = useTeamRituals();
  const { isAdmin } = useResolvedUserRole();
  const { isDeputyView } = useWorkspaceView();
  const alerts = useAlerts();
  const alertIds = isDeputyView ? (alerts.data ?? []).filter(alert => !alert.acknowledged_at).map(alert => alert.id).sort() : [];
  const alertKey = alertIds.join(',');
  const [openedAlertKey, setOpenedAlertKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { setOpenedAlertKey(null); }, [alertKey, tenantId, userId]);
  const daysLeft = weeklyQuestionDaysLeft(now);
  const hasAnswered = !!data?.answers.some(answer => answer.user_id === userId);
  const compact = weeklyQuestionIsCompact(alertIds, openedAlertKey);
  const state = ritualDashboardState(
    isPending,
    !!error,
    !!data?.enabled,
    !!data?.own?.opted_in,
  );
  return (
    <section className="animate-rise border-t border-border pt-3" aria-label="Team-Rituale" style={{ animationDelay: "120ms" }}>
      <h2 className={compact ? undefined : "mb-0.5"}>
        {compact ? <button type="button" onClick={() => setOpenedAlertKey(alertKey)} aria-expanded={false}
          className="inline-flex items-center gap-1.5 rounded-sm text-[11px] font-semibold uppercase tracking-wider text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          FRAGE DER WOCHE · {hasAnswered ? 'beantwortet' : 'noch offen'}<ArrowRight className="h-3 w-3" aria-hidden="true" />
        </button> : <Link to="/employee?tab=rituals" aria-label="Frage der Woche – Team-Rituale öffnen"
          className="inline-flex items-center gap-1.5 rounded-sm text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          FRAGE DER WOCHE{data?.week ? ` · noch ${daysLeft} ${daysLeft === 1 ? "Tag" : "Tage"}` : ""}
          <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
        </Link>}
      </h2>
      <div className="space-y-2" hidden={compact} inert={compact}>
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
              key={`answer:${tenantId}:${userId}:${data.week.id}`}
              tenantId={tenantId}
              weekId={data.week.id}
            />}
            {data?.week && tenantId && <WeeklyParticipation key={`participation:${tenantId}:${userId}:${data.week.id}`} tenantId={tenantId} weekId={data.week.id} answers={data.answers} userId={userId} suspended={compact} />}
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
  return <form className="flex items-center gap-2 rounded-2xl border border-border p-1.5" onSubmit={event => {
    event.preventDefault();
    if (busy || !isValidWeeklyAnswer(answer)) return;
    void run(() => supabase.rpc('upsert_weekly_answer', { p_tenant: tenantId, p_week: weekId, p_answer: answer }));
  }}>
    <label htmlFor={id} className="sr-only">Deine Antwort</label>
    <Input className="h-9 min-w-0 border-0 bg-transparent px-2 text-xs shadow-none focus-visible:ring-0" id={id}
      placeholder="Deine Antwort …" maxLength={280} value={answer} onChange={event => setAnswer(event.target.value)} disabled={busy} />
    <Button size="sm" className="h-9 shrink-0 rounded-xl bg-[#397d16] px-3 text-xs text-white hover:bg-[#326e13]" type="submit"
      disabled={busy || !isValidWeeklyAnswer(answer)}>{busy ? 'Sendet…' : 'Senden'}</Button>
  </form>;
}
