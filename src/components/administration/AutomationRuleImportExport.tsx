import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Upload, Loader2, FileJson } from "lucide-react";

interface ExportableRule {
  id: string;
  name: string;
  module: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  conditions: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
  enabled: boolean;
}

interface ImportRule {
  name: string;
  description?: string | null;
  module: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  conditions: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
  enabled: boolean;
}

interface ImportPayload {
  version: string;
  exported_at: string;
  rules: ImportRule[];
}

/* ─── Export Dialog ─── */

interface ExportDialogProps {
  rules: ExportableRule[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutomationRuleExportDialog({ rules, open, onOpenChange }: ExportDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleAll = () => {
    if (selected.size === rules.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rules.map((r) => r.id)));
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const doExport = () => {
    const exportRules = rules
      .filter((r) => selected.has(r.id))
      .map(({ name, description, module, trigger_type, trigger_config, conditions, actions, enabled }) => ({
        name,
        description,
        module,
        trigger_type,
        trigger_config,
        conditions,
        actions,
        enabled,
      }));

    const payload = {
      version: "1.0",
      exported_at: new Date().toISOString(),
      rules: exportRules,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `automation-rules-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" /> Regeln exportieren
          </DialogTitle>
          <DialogDescription>Wähle die Regeln aus, die du als JSON exportieren möchtest.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[300px]">
          <div className="space-y-2 pr-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Checkbox
                checked={selected.size === rules.length && rules.length > 0}
                onCheckedChange={toggleAll}
              />
              <span className="text-sm font-medium">Alle auswählen</span>
            </div>
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-2">
                <Checkbox checked={selected.has(rule.id)} onCheckedChange={() => toggle(rule.id)} />
                <span className="text-sm">{rule.name}</span>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {rule.module}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button disabled={selected.size === 0} onClick={doExport}>
            <Download className="h-4 w-4 mr-2" />
            {selected.size} Regel{selected.size !== 1 ? "n" : ""} exportieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Import Dialog ─── */

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function AutomationRuleImportDialog({ open, onOpenChange, onImported }: ImportDialogProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ImportPayload | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError(null);
    setParsed(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text) as ImportPayload;

      if (!json.version || !Array.isArray(json.rules) || json.rules.length === 0) {
        throw new Error("Ungültiges Format: 'version' und 'rules' Array erforderlich.");
      }

      for (const r of json.rules) {
        if (!r.name || !r.module || !r.trigger_type) {
          throw new Error(`Regel fehlt Pflichtfelder (name, module, trigger_type): "${r.name || "?"}"`);
        }
      }

      setParsed(json);
    } catch (err: unknown) {
      setParseError((err instanceof Error ? err.message : null) || "Datei konnte nicht gelesen werden.");
    }
  };

  const doImport = async () => {
    if (!parsed || !currentTenant || !user) return;
    setImporting(true);

    const rows = parsed.rules.map((r) => ({
      tenant_id: currentTenant.id,
      created_by: user.id,
      name: r.name,
      description: r.description || null,
      module: r.module,
      trigger_type: r.trigger_type,
      trigger_config: r.trigger_config || {},
      conditions: r.conditions || {},
      actions: r.actions || [],
      enabled: r.enabled ?? false,
    }));

    const { error } = await supabase.from("automation_rules").insert(rows as any);
    setImporting(false);

    if (error) {
      toast({ title: "Import fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: `${rows.length} Regel${rows.length > 1 ? "n" : ""} importiert` });
    setParsed(null);
    onImported();
    onOpenChange(false);
  };

  const reset = () => {
    setParsed(null);
    setParseError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Regeln importieren
          </DialogTitle>
          <DialogDescription>Lade eine zuvor exportierte JSON-Datei hoch.</DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <div className="space-y-3">
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileJson className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">JSON-Datei auswählen</p>
            </div>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
            {parseError && <p className="text-sm text-destructive">{parseError}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{parsed.rules.length}</strong> Regel{parsed.rules.length > 1 ? "n" : ""} gefunden
              {parsed.exported_at && (
                <span className="text-muted-foreground">
                  {" "}(exportiert: {new Date(parsed.exported_at).toLocaleDateString("de-DE")})
                </span>
              )}
            </p>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1 pr-3">
                {parsed.rules.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm border rounded p-2">
                    <span>{r.name}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {r.module}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="gap-2">
          {parsed && (
            <Button variant="outline" onClick={reset}>
              Andere Datei
            </Button>
          )}
          <Button disabled={!parsed || importing} onClick={doImport}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Importieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
