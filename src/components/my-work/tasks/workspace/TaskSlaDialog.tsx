import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { slaLevel } from "@/features/tasks/stafette";

interface SlaItem {
  task_id: string;
  title: string;
  days: number;
  assignee_id: string | null;
}

interface SlaReport {
  waiting?: { count?: number; over_seven_days?: number; median_days?: number; items?: SlaItem[] };
  completed_90d?: { count?: number; median_days?: number };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId?: string;
  nameOf: (id: string | null | undefined) => string | undefined;
  onOpenTask: (taskId: string) => void;
}

const levelClass = {
  ok: "bg-success/15 text-success",
  warn: "bg-palette-amber/20 text-palette-amber",
  critical: "bg-destructive/15 text-destructive",
} as const;

const dayText = (days: number) => (days === 1 ? "1 Tag" : `${days} Tage`);

/** Engpass-Report: wie lange der Ball bei Abgeordnete/r liegt. */
export function TaskSlaDialog({ open, onOpenChange, tenantId, nameOf, onOpenTask }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["task-approval-sla", tenantId],
    enabled: open && !!tenantId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("task_approval_sla", { _tenant_id: tenantId! });
      if (error) throw error;
      return (data ?? {}) as SlaReport;
    },
  });

  const waiting = data?.waiting ?? {};
  const items = waiting.items ?? [];
  const completed = data?.completed_90d ?? {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Freigabe-SLA</DialogTitle>
          <DialogDescription>
            Wartezeit des Balls bei Abgeordnete/r – der typische Engpass im Tandem. Zahlen aus den offenen Aufgaben dieses Büros.
          </DialogDescription>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground">Lädt …</p>}
        {error && <p className="text-sm text-destructive">Kennzahlen konnten nicht geladen werden.</p>}

        {!isLoading && !error && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border p-3">
                <div className="text-2xl font-semibold tabular-nums">{waiting.count ?? 0}</div>
                <div className="text-xs text-muted-foreground">liegen zur Freigabe</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-2xl font-semibold tabular-nums">{waiting.median_days ?? 0}</div>
                <div className="text-xs text-muted-foreground">Tage im Median</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-2xl font-semibold tabular-nums">{waiting.over_seven_days ?? 0}</div>
                <div className="text-xs text-muted-foreground">über 7 Tage</div>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aktuell liegt nichts zur Freigabe.</p>
            ) : (
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.task_id} className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted">
                    <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => onOpenTask(item.task_id)}>{item.title}</button>
                    <span className="text-xs text-muted-foreground">{nameOf(item.assignee_id) ?? "Abgeordnete/r"}</span>
                    <Badge className={levelClass[slaLevel(item.days)]} variant="secondary">{dayText(item.days)}</Badge>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-xs text-muted-foreground">
              Freigaben der letzten 90 Tage: {completed.count ?? 0} abgeschlossen
              {typeof completed.median_days === "number" ? `, im Median nach ${dayText(Math.round(completed.median_days)).replace("Tage", "Tagen")}` : ""}.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
