import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Copy } from "lucide-react";
import type { SeedReport } from "./TenantProvisioningWizard";
import { SeedReportView } from "./TenantProvisioningWizard";

interface TenantOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetTenant: TenantOption | null;
  availableSources: TenantOption[];
  onDone?: () => void;
}

export function CloneDataDrawer({ open, onOpenChange, targetTenant, availableSources, onDone }: Props): React.JSX.Element {
  const { toast } = useToast();
  const [sourceId, setSourceId] = useState<string>("");
  const [running, setRunning] = useState<boolean>(false);
  const [report, setReport] = useState<SeedReport | null>(null);

  const reset = () => {
    setSourceId("");
    setReport(null);
    setRunning(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleClone = async () => {
    if (!targetTenant || !sourceId) return;
    setRunning(true);
    setReport(null);
    try {
      const { data, error } = await supabase.functions.invoke("manage-tenant-user", {
        body: { action: "cloneTenantData", sourceTenantId: sourceId, targetTenantId: targetTenant.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Klonen fehlgeschlagen");
      setReport(data.report);
      toast({ title: "Daten geklont", description: `Konfiguration von Quelle übernommen.` });
      onDone?.();
    } catch (err) {
      toast({
        title: "Fehler",
        description: err instanceof Error ? err.message : "Klonen fehlgeschlagen",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const sources = availableSources.filter((s) => s.id !== targetTenant?.id);

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Daten nachladen
          </SheetTitle>
          <SheetDescription>
            Kopiert Templates, Kategorien und Notification-Typen von einem anderen Tenant nach{" "}
            <strong>{targetTenant?.name}</strong>. Bestehende Datensätze bleiben unangetastet.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-6">
          <div className="space-y-2">
            <Label>Quell-Tenant</Label>
            <Select value={sourceId} onValueChange={setSourceId} disabled={running}>
              <SelectTrigger>
                <SelectValue placeholder="Tenant auswählen" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {report && (
            <Alert>
              <AlertDescription>
                <SeedReportView report={report} />
              </AlertDescription>
            </Alert>
          )}
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={running}>
            {report ? "Schließen" : "Abbrechen"}
          </Button>
          {!report && (
            <Button onClick={handleClone} disabled={!sourceId || running}>
              {running && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Daten klonen
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
