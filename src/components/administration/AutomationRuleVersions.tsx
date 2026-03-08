import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RotateCcw, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface VersionRow {
  id: string;
  version_number: number;
  name: string;
  description: string | null;
  module: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  conditions: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
  enabled: boolean;
  created_at: string;
}

interface AutomationRuleVersionsProps {
  ruleId: string;
  ruleName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: () => void;
}

export function AutomationRuleVersions({
  ruleId,
  ruleName,
  open,
  onOpenChange,
  onRestore,
}: AutomationRuleVersionsProps) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (open && ruleId) loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ruleId]);

  const loadVersions = async () => {
    if (!currentTenant) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("automation_rule_versions" as any)
      .select("*")
      .eq("rule_id", ruleId)
      .eq("tenant_id", currentTenant.id)
      .order("version_number", { ascending: false });

    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      setVersions((data || []) as unknown as VersionRow[]);
    }
    setLoading(false);
  };

  const restoreVersion = async (version: VersionRow) => {
    setRestoring(version.id);
    const { error } = await supabase
      .from("automation_rules")
      .update({
        name: version.name,
        description: version.description,
        module: version.module,
        trigger_type: version.trigger_type,
        trigger_config: version.trigger_config,
        conditions: version.conditions,
        actions: version.actions,
        enabled: version.enabled,
      } as any)
      .eq("id", ruleId);

    setRestoring(null);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Version ${version.version_number} wiederhergestellt` });
    onRestore();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Versionen: {ruleName}
          </DialogTitle>
          <DialogDescription>
            Jede Änderung an der Regel wird automatisch versioniert.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Noch keine Versionen vorhanden. Versionen werden beim Speichern automatisch erstellt.
          </p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3 pr-3">
              {versions.map((v) => (
                <div key={v.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">v{v.version_number}</Badge>
                      <span className="text-sm font-medium">{v.name}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={restoring === v.id}
                      onClick={() => restoreVersion(v)}
                    >
                      {restoring === v.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <RotateCcw className="h-3 w-3 mr-1" />
                      )}
                      Wiederherstellen
                    </Button>
                  </div>
                  <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
                    <span>{v.module}</span>
                    <span>·</span>
                    <span>{v.trigger_type}</span>
                    <span>·</span>
                    <span>{v.enabled ? "Aktiv" : "Deaktiviert"}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(v.created_at), { addSuffix: true, locale: de })}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
