import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { berlinDaysSince, berlinDateShort } from "@/utils/berlinDate";

interface OpenDecisionRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
  response_deadline: string | null;
  meeting_id: string | null;
}

/**
 * Offene-Beschlüsse-Cockpit: alles, was beschlossen werden soll, aber noch
 * nicht entschieden ist – mit Alter, Frist und Herkunft aus dem Jour fixe.
 */
export function OpenDecisionsCockpit() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["jour-fixe-open-decisions", tenantId],
    enabled: Boolean(tenantId),
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<OpenDecisionRow[]> => {
      const { data, error } = await supabase
        .from("task_decisions")
        .select("id, title, status, created_at, response_deadline, meeting_id")
        .eq("tenant_id", tenantId!)
        .in("status", ["active", "open"])
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as OpenDecisionRow[];
    },
  });

  const decisions = data ?? [];
  const now = Date.now();
  const overdue = decisions.filter(
    (decision) => decision.response_deadline && Date.parse(decision.response_deadline) < now,
  );
  const oldest = decisions[0];
  const oldestDays = oldest ? berlinDaysSince(oldest.created_at) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardCheck className="size-4" />
          Offene Beschlüsse
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/mywork?tab=decisions")}>
          Alle ansehen
          <ArrowRight className="ml-1 size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="h-12 animate-pulse rounded-md bg-muted" />
        ) : isError ? (
          <p className="text-sm text-muted-foreground">Offene Beschlüsse konnten nicht geladen werden.</p>
        ) : decisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine offenen Beschlüsse. Alles entschieden.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary">{decisions.length} offen</Badge>
              {overdue.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="size-3" />
                  {overdue.length} über Frist
                </Badge>
              )}
              {oldest && <span className="text-muted-foreground">Ältester seit {oldestDays} Tagen</span>}
            </div>
            <ul className="divide-y">
              {decisions.slice(0, 5).map((decision) => {
                const days = berlinDaysSince(decision.created_at);
                const isOverdue = Boolean(decision.response_deadline && Date.parse(decision.response_deadline) < now);
                return (
                  <li key={decision.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="block max-w-full truncate text-left text-sm font-medium hover:underline"
                        onClick={() => navigate(`/mywork?tab=decisions&highlight=${decision.id}`)}
                      >
                        {decision.title}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        seit {days} {days === 1 ? "Tag" : "Tagen"} offen
                        {decision.meeting_id ? " · aus dem Jour fixe" : ""}
                      </p>
                    </div>
                    {decision.response_deadline && (
                      <Badge variant={isOverdue ? "destructive" : "outline"} className="shrink-0 text-[11px]">
                        Frist {berlinDateShort(decision.response_deadline)}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
