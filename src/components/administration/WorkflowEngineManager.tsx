import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, LoadingState } from '@/components/ui-patterns';
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Workflow, Plus, Play, Trash2, Edit, History, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { notify } from "@/lib/notify";

interface Condition { field: string; op: string; value: string }
interface Action { type: string; config: Record<string, string> }

interface WorkflowDef {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  conditions: Condition[];
  actions: Action[];
  is_active: boolean;
  created_at: string;
}

interface RunRow {
  id: string;
  workflow_id: string;
  trigger_type: string;
  status: string;
  is_dry_run: boolean;
  started_at: string;
  finished_at: string | null;
  error: string | null;
}

const TRIGGER_OPTIONS = [
  { value: "case_created", label: "Vorgang erstellt" },
  { value: "task_created", label: "Aufgabe erstellt" },
  { value: "manual", label: "Manuell" },
];

const OP_OPTIONS = [
  { value: "eq", label: "ist gleich" },
  { value: "neq", label: "ist nicht" },
  { value: "contains", label: "enthält" },
  { value: "exists", label: "vorhanden" },
  { value: "missing", label: "leer" },
];

const ACTION_OPTIONS = [
  { value: "create_notification", label: "Benachrichtigung erstellen", fields: ["user_id", "title", "body"] },
  { value: "set_case_priority", label: "Vorgang-Priorität setzen", fields: ["priority"] },
  { value: "assign_case_owner", label: "Vorgang-Owner setzen", fields: ["user_id"] },
  { value: "create_task", label: "Aufgabe erstellen", fields: ["title", "assigned_to", "description"] },
  { value: "webhook", label: "Webhook aufrufen", fields: ["url", "payload_template"] },
];

const EMPTY_DEF: Omit<WorkflowDef, "id" | "tenant_id" | "created_at"> = {
  name: "",
  description: "",
  trigger_type: "case_created",
  trigger_config: {},
  conditions: [],
  actions: [],
  is_active: true,
};

export function WorkflowEngineManager() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const [defs, setDefs] = useState<WorkflowDef[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<WorkflowDef | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const [defRes, runRes] = await Promise.all([
      supabase.from("workflow_definitions")
        .select("*").eq("tenant_id", currentTenant.id).order("created_at", { ascending: false }),
      supabase.from("workflow_runs")
        .select("id, workflow_id, trigger_type, status, is_dry_run, started_at, finished_at, error")
        .eq("tenant_id", currentTenant.id).order("started_at", { ascending: false }).limit(100),
    ]);
    if (defRes.error) notify.error("Fehler", { description: defRes.error.message
});
    setDefs((defRes.data ?? []) as WorkflowDef[]);
    setRuns((runRes.data ?? []) as RunRow[]);
    setLoading(false);
  }, [currentTenant?.id, toast]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!editing || !currentTenant?.id) return;
    const payload = {
      tenant_id: currentTenant.id,
      name: editing.name,
      description: editing.description,
      trigger_type: editing.trigger_type,
      trigger_config: editing.trigger_config,
      conditions: editing.conditions,
      actions: editing.actions,
      is_active: editing.is_active,
      created_by: user?.id,
    };
    const { error } = editing.id
      ? await supabase.from("workflow_definitions").update(payload).eq("id", editing.id)
      : await supabase.from("workflow_definitions").insert(payload);
    if (error) {
      notify.error("Speichern fehlgeschlagen", { description: error.message
});
      return;
    }
    notify.success("Workflow gespeichert");
    setEditing(null);
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("Diesen Workflow wirklich löschen?")) return;
    const { error } = await supabase.from("workflow_definitions").delete().eq("id", id);
    if (error) {
      notify.error("Fehler", { description: error.message
});
      return;
    }
    void load();
  };

  const toggleActive = async (def: WorkflowDef) => {
    await supabase.from("workflow_definitions").update({ is_active: !def.is_active }).eq("id", def.id);
    void load();
  };

  const dryRun = async (def: WorkflowDef) => {
    const { data, error } = await supabase.functions.invoke("workflow-dispatcher", {
      body: {
        trigger_type: def.trigger_type,
        tenant_id: def.tenant_id,
        entity_id: "00000000-0000-0000-0000-000000000000",
        payload: { _dry: true },
        dry_run: true,
        workflow_id: def.id,
      },
    });
    if (error) {
      notify.error("Dry-Run fehlgeschlagen", { description: error.message
});
      return;
    }
    notify.success("Dry-Run abgeschlossen", { description: JSON.stringify(data) 
});
    void load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" /> Workflow-Engine
          </CardTitle>
          <CardDescription>
            Trigger → Bedingungen → Aktionen. {defs.length} Definitionen, {runs.length} Runs.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowHistory(true)}>
            <History className="h-4 w-4 mr-2" /> Verlauf
          </Button>
          <Button size="sm" onClick={() => setEditing({ ...EMPTY_DEF, id: "", tenant_id: currentTenant?.id ?? "", created_at: "" })}>
            <Plus className="h-4 w-4 mr-2" /> Neu
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <LoadingState variant="list" rows={3} /> : defs.length === 0 ? (
          <EmptyState title="Noch keine Workflows" description='Klicke auf „Neu", um zu starten.' />
        ) : (
          <div className="space-y-2">
            {defs.map(def => (
              <div key={def.id} className="flex items-center gap-3 p-3 rounded-md border bg-card">
                <Switch checked={def.is_active} onCheckedChange={() => toggleActive(def)} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {def.name}
                    <Badge variant="outline" className="text-xs">
                      {TRIGGER_OPTIONS.find(t => t.value === def.trigger_type)?.label ?? def.trigger_type}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">{def.actions.length} Aktionen</Badge>
                  </div>
                  {def.description && <p className="text-xs text-muted-foreground truncate">{def.description}</p>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => dryRun(def)} title="Dry-Run">
                  <Play className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(def)}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(def.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {editing && (
        <WorkflowEditor
          def={editing}
          onChange={setEditing}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Workflow-Verlauf</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-1 pr-4">
              {runs.map(r => {
                const def = defs.find(d => d.id === r.workflow_id);
                return (
                  <div key={r.id} className="flex items-center gap-3 p-2 border rounded-md text-sm">
                    <Badge variant={r.status === "success" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>
                      {r.status}
                    </Badge>
                    {r.is_dry_run && <Badge variant="outline">Dry-Run</Badge>}
                    <span className="flex-1 truncate">{def?.name ?? r.workflow_id} · {r.trigger_type}</span>
                    <span className="text-xs text-muted-foreground">{new Date(r.started_at).toLocaleString("de-DE")}</span>
                  </div>
                );
              })}
              {runs.length === 0 && <EmptyState size="sm" title="Noch keine Läufe" />}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function WorkflowEditor({
  def, onChange, onSave, onClose,
}: { def: WorkflowDef; onChange: (d: WorkflowDef) => void; onSave: () => void; onClose: () => void }) {
  const update = <K extends keyof WorkflowDef>(k: K, v: WorkflowDef[K]) => onChange({ ...def, [k]: v });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{def.id ? "Workflow bearbeiten" : "Neuen Workflow erstellen"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 pr-4">
            <div>
              <Label>Name</Label>
              <Input value={def.name} onChange={e => update("name", e.target.value)} />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea value={def.description ?? ""} onChange={e => update("description", e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Trigger</Label>
              <Select value={def.trigger_type} onValueChange={(v) => update("trigger_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGER_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Bedingungen */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Bedingungen (alle müssen zutreffen)</Label>
                <Button size="sm" variant="outline" onClick={() => update("conditions", [...def.conditions, { field: "", op: "eq", value: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Bedingung
                </Button>
              </div>
              <div className="space-y-2">
                {def.conditions.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="Feld (z.B. priority)" value={c.field}
                      onChange={e => {
                        const arr = [...def.conditions]; arr[i] = { ...c, field: e.target.value }; update("conditions", arr);
                      }} className="flex-1" />
                    <Select value={c.op} onValueChange={(v) => {
                      const arr = [...def.conditions]; arr[i] = { ...c, op: v }; update("conditions", arr);
                    }}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {!["exists", "missing"].includes(c.op) && (
                      <Input placeholder="Wert" value={c.value} onChange={e => {
                        const arr = [...def.conditions]; arr[i] = { ...c, value: e.target.value }; update("conditions", arr);
                      }} className="flex-1" />
                    )}
                    <Button size="sm" variant="ghost" onClick={() => update("conditions", def.conditions.filter((_, j) => j !== i))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Aktionen */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Aktionen (in Reihenfolge)</Label>
                <Button size="sm" variant="outline" onClick={() => update("actions", [...def.actions, { type: "create_notification", config: {} }])}>
                  <Plus className="h-3 w-3 mr-1" /> Aktion
                </Button>
              </div>
              <div className="space-y-3">
                {def.actions.map((a, i) => {
                  const meta = ACTION_OPTIONS.find(o => o.value === a.type);
                  return (
                    <div key={i} className="border rounded-md p-3 space-y-2 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Select value={a.type} onValueChange={(v) => {
                          const arr = [...def.actions]; arr[i] = { type: v, config: {} }; update("actions", arr);
                        }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ACTION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" onClick={() => update("actions", def.actions.filter((_, j) => j !== i))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      {meta?.fields.map(f => (
                        <Input key={f} placeholder={f} value={a.config[f] ?? ""} onChange={e => {
                          const arr = [...def.actions];
                          arr[i] = { ...a, config: { ...a.config, [f]: e.target.value } };
                          update("actions", arr);
                        }} />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={def.is_active} onCheckedChange={(v) => update("is_active", v)} />
              <Label>Aktiv</Label>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button onClick={onSave} disabled={!def.name.trim()}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
