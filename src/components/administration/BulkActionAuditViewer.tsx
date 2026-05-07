import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, LoadingState } from '@/components/ui-patterns';
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { History, Loader2, Undo2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { notify } from "@/lib/notify";

interface AuditRow {
  id: string;
  actor_id: string;
  action: string;
  payload: unknown;
  affected_count: number | null;
  created_at: string;
  undone_at: string | null;
}

export function BulkActionAuditViewer() {
  const { currentTenant } = useTenant();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bulk_action_audit")
      .select("id, actor_id, action, payload, affected_count, created_at, undone_at")
      .eq("tenant_id", currentTenant.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      notify.error("Fehler", { description: error.message
});
      return;
    }
    setRows((data ?? []) as AuditRow[]);
  }, [currentTenant?.id, toast]);

  useEffect(() => { void load(); }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Sammelaktionen-Verlauf
        </CardTitle>
        <CardDescription>
          Audit-Log von Sammelaktionen der letzten 30 Tage (mit Undo-Daten, falls verfügbar).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingState variant="list" rows={3} />
        ) : rows.length === 0 ? (
          <EmptyState size="sm" title="Noch keine Sammelaktionen" />
        ) : (
          <ScrollArea className="h-[60vh]">
            <div className="space-y-2 pr-4">
              {rows.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-md border bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{r.action}</span>
                      {r.affected_count != null && (
                        <Badge variant="secondary">{r.affected_count} Datensätze</Badge>
                      )}
                      {r.undone_at && <Badge variant="outline">rückgängig</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: de })}
                    </div>
                  </div>
                  {!r.undone_at && (
                    <Button size="sm" variant="ghost" disabled title="Undo via Edge Function (kommt)">
                      <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
