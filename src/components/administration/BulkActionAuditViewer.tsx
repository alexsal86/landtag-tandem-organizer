import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, LoadingState } from '@/components/ui-patterns';
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { History, Undo2 } from "lucide-react";
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
  undo_payload: unknown;
}

export function BulkActionAuditViewer() {
  const { currentTenant } = useTenant();
  const [undoing, setUndoing] = useState<string | null>(null);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bulk_action_audit")
      .select("id, actor_id, action, payload, affected_count, created_at, undone_at, undo_payload")
      .eq("tenant_id", currentTenant.id)
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      notify.error("Fehler", { description: error.message
});
      return;
    }
    setRows((data ?? []) as AuditRow[]);
  }, [currentTenant?.id]);

  useEffect(() => { void load(); }, [load]);

  const undo = async (row: AuditRow) => {
    if (undoing || !confirm(`${row.affected_count ?? 0} Kontaktänderungen rückgängig machen?`)) return;
    setUndoing(row.id);
    try {
      const { error } = await supabase.rpc("undo_contact_bulk_action", { _audit_id: row.id });
      if (error) throw error;
      notify.success("Sammelaktion rückgängig gemacht");
      await load();
    } catch {
      notify.error("Rücknahme nicht möglich", { description: "Die Berechtigung fehlt, die Aktion wurde bereits zurückgenommen oder betroffene Kontakte wurden inzwischen verändert." });
    } finally { setUndoing(null); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Sammelaktionen-Verlauf
        </CardTitle>
        <CardDescription>
          Audit-Log von Sammelaktionen der letzten 30 Tage (maximal 200 Einträge). Kontakt-Tags und -Kategorien können mit gespeicherten Rücknahmedaten rückgängig gemacht werden.
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
                  {!r.undone_at && r.action === "contacts.fields_updated" && r.undo_payload != null && <Button size="sm" variant="outline" disabled={undoing !== null} onClick={() => void undo(r)}><Undo2 className="mr-2 h-4 w-4" />{undoing === r.id ? "Wird zurückgenommen…" : "Rückgängig"}</Button>}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
