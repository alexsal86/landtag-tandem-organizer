import { useEffect, useRef, useState } from "react";
import { BellRing, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { canNudgeDecision, DECISION_NUDGE_WINDOW_MS, decisionNudgeSecondsRemaining, decisionNudgeTime } from "./dashboardNudges";
import { useDeputyDashboardDecisions, type DeputyDashboardDecision } from "./useDeputyDashboardDecisions";

export function DeputyWaitingCard() {
  const query = useDeputyDashboardDecisions();
  const { isEmployee } = useResolvedUserRole();
  return (
    <Card className="dashboard-motion-card animate-rise" style={{ animationDelay: "120ms" }}>
      <CardHeader className="flex min-h-[52px] flex-row flex-wrap items-center justify-between gap-2 space-y-0 px-space-md py-space-sm">
        <CardTitle className="inline-flex items-center gap-2 text-base font-medium leading-6">
          <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />Beim Abgeordneten
        </CardTitle>
      </CardHeader>
      <CardContent className="px-space-md pb-space-md pt-0">
        {query.isPending ? <p role="status" className="text-sm text-muted-foreground">Entscheidungen werden geladen…</p>
          : query.isError ? <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">Die Entscheidungen beim Abgeordneten konnten nicht geladen werden.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>Erneut laden</Button>
          </div>
          : !query.data?.length ? <p className="text-sm text-muted-foreground">Beim Abgeordneten stehen keine Entscheidungen aus.</p>
          : <div className="divide-y divide-border">{query.data.map(decision =>
            <NudgeRow key={decision.decision_id} decision={decision} canSend={isEmployee} />)}</div>}
      </CardContent>
    </Card>
  );
}

function NudgeRow({ decision, canSend }: { decision: DeputyDashboardDecision; canSend: boolean }) {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(10);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const input = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);
  const sendRef = useRef<() => Promise<void>>(async () => {});
  const lastNudge = [sentAt, decision.nudged_at]
    .filter((value): value is string => !!value)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  const locked = !canNudgeDecision(lastNudge, now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const send = async () => {
    if (inFlight.current || !canSend || locked) return;
    inFlight.current = true;
    setSending(true);
    setPaused(true);
    try {
      const { data, error } = await supabase.rpc("nudge_dashboard_decision", {
        _decision_id: decision.decision_id, _note: note.trim() || undefined,
      });
      if (error) throw error;
      if (!data) throw new Error("Das Anstupsen konnte nicht bestätigt werden.");
      setSentAt(data);
      setEditing(false);
      setNote("");
      notify.success("Abgeordneten angestupst");
      await qc.invalidateQueries({ queryKey: ["deputy-dashboard-decisions", currentTenant?.id] });
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Bitte erneut versuchen.";
      notify.error("Anstupsen fehlgeschlagen", { description: message });
      void qc.invalidateQueries({ queryKey: ["deputy-dashboard-decisions", currentTenant?.id] });
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };
  sendRef.current = send;

  useEffect(() => {
    if (!editing || paused || sending || locked) return;
    const deadline = Date.now() + DECISION_NUDGE_WINDOW_MS;
    const tick = window.setInterval(() => setRemaining(decisionNudgeSecondsRemaining(deadline)), 200);
    const timer = window.setTimeout(() => { void sendRef.current(); }, DECISION_NUDGE_WINDOW_MS);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(timer);
    };
  }, [editing, paused, sending, locked]);

  useEffect(() => {
    if (locked) setEditing(false);
  }, [locked]);

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 break-words text-sm font-medium">{decision.title}</p>
        {locked && lastNudge ? <span className="shrink-0 text-xs text-muted-foreground"
          title="Erneutes Anstupsen ist nach 24 Stunden möglich.">Angestupst {decisionNudgeTime(lastNudge)}</span>
          : <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 text-xs"
            disabled={!canSend || editing || sending}
            onClick={() => { setRemaining(10); setPaused(false); setEditing(true); }}>
            <BellRing className="mr-1 h-3.5 w-3.5" />{editing ? "Vorgemerkt" : "Anstupsen"}
          </Button>}
      </div>
      {editing && !locked && (
        <div className="animate-fade-up mt-3 space-y-2 rounded-xl border bg-muted/40 p-3">
          <Textarea ref={input} rows={2} maxLength={500} value={note} disabled={sending}
            aria-label="Kurzer Hinweis für ihn (optional)" placeholder="Kurzer Hinweis für ihn (optional)"
            onFocus={() => setPaused(true)} onChange={event => { setPaused(true); setNote(event.target.value); }} />
          <div className="flex flex-wrap gap-1.5">
            {["Muss bis Montag raus", "Bitte kurz ansehen", "Eilt"].map(preset => (
              <button key={preset} type="button" disabled={sending}
                className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => { setPaused(true); setNote(preset); input.current?.focus(); }}>{preset}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span role="status" className="text-xs text-muted-foreground">
              {sending ? "Wird gesendet…" : paused ? "Automatik pausiert" : `Wird in ${remaining} Sekunden gesendet`}
            </span>
            <Button type="button" size="sm" disabled={sending} onClick={() => void send()}>
              {sending ? "Wird gesendet…" : "Jetzt anstupsen"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
