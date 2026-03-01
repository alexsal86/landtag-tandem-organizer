import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Play, Plus, Save, Trash2, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

type RuleRow = {
  id: string;
  name: string;
  description: string | null;
  module: string;
  trigger_type: "record_changed" | "schedule" | "manual";
  trigger_config: Record<string, string>;
  conditions: { all?: Array<{ field: string; operator: string; value: string }> };
  actions: Array<{ type: string; payload?: Record<string, string> }>;
  enabled: boolean;
  updated_at: string;
};

type RunRow = {
  id: string;
  rule_id: string;
  status: string;
  dry_run?: boolean;
  trigger_source: string;
  started_at: string;
  error_message: string | null;
};

const MODULE_OPTIONS = [
  { value: "tasks", label: "Aufgaben" },
  { value: "meetings", label: "Meetings" },
  { value: "decisions", label: "Entscheidungen" },
  { value: "knowledge", label: "Wissen" },
  { value: "casefiles", label: "Fallakten" },
] as const;

const CONDITION_OPERATORS = [
  { value: "equals", label: "ist gleich" },
  { value: "not_equals", label: "ist nicht gleich" },
  { value: "contains", label: "enthält" },
  { value: "gt", label: "größer als" },
  { value: "lt", label: "kleiner als" },
] as const;

const ACTION_TYPES = [
  { value: "create_notification", label: "Benachrichtigung erzeugen" },
  { value: "create_task", label: "Aufgabe erzeugen" },
  { value: "update_record_status", label: "Status aktualisieren" },
  { value: "send_push_notification", label: "Push senden" },
] as const;

const TRIGGER_TYPES = [
  { value: "record_changed", label: "Bei Datenänderung" },
  { value: "schedule", label: "Zeitgesteuert" },
  { value: "manual", label: "Manuell (Button)" },
] as const;

const FIELD_OPTIONS_BY_MODULE: Record<string, Array<{ value: string; label: string }>> = {
  tasks: [
    { value: "status", label: "Status" },
    { value: "priority", label: "Priorität" },
    { value: "due_date", label: "Fälligkeitsdatum" },
  ],
  meetings: [
    { value: "status", label: "Status" },
    { value: "meeting_date", label: "Termin" },
    { value: "preparation_status", label: "Vorbereitungsstatus" },
  ],
  decisions: [
    { value: "status", label: "Status" },
    { value: "deadline", label: "Deadline" },
  ],
  knowledge: [
    { value: "status", label: "Publikationsstatus" },
    { value: "updated_at", label: "Aktualisiert am" },
  ],
  casefiles: [
    { value: "status", label: "Status" },
    { value: "priority", label: "Priorität" },
  ],
};

const DEFAULT_FORM = {
  name: "",
  description: "",
  module: "tasks",
  triggerType: "record_changed",
  triggerField: "status",
  triggerValue: "",
  conditionField: "status",
  conditionOperator: "equals",
  conditionValue: "",
  actionType: "create_notification",
  actionTarget: "owner",
  actionMessage: "",
  enabled: true,
};

export function AutomationRulesManager() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const fieldOptions = useMemo(() => FIELD_OPTIONS_BY_MODULE[form.module] ?? FIELD_OPTIONS_BY_MODULE.tasks, [form.module]);

  const loadData = async () => {
    if (!currentTenant) return;

    setLoading(true);
    const [{ data: rulesData, error: rulesError }, { data: runData, error: runsError }] = await Promise.all([
      supabase
        .from("automation_rules" as any)
        .select("id, name, description, module, trigger_type, trigger_config, conditions, actions, enabled, updated_at")
        .eq("tenant_id", currentTenant.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("automation_rule_runs" as any)
        .select("id, rule_id, status, dry_run, trigger_source, started_at, error_message")
        .eq("tenant_id", currentTenant.id)
        .order("started_at", { ascending: false })
        .limit(30),
    ]);

    if (rulesError || runsError) {
      toast({
        title: "Fehler beim Laden",
        description: rulesError?.message || runsError?.message || "Automations konnten nicht geladen werden.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setRules((rulesData || []) as RuleRow[]);
    setRuns((runData || []) as RunRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant?.id]);

  const resetForm = () => {
    setEditingRuleId(null);
    setForm(DEFAULT_FORM);
  };

  const startEdit = (rule: RuleRow) => {
    const condition = rule.conditions?.all?.[0];
    const action = rule.actions?.[0];
    setEditingRuleId(rule.id);
    setForm({
      name: rule.name,
      description: rule.description || "",
      module: rule.module,
      triggerType: rule.trigger_type,
      triggerField: (rule.trigger_config?.field as string) || "status",
      triggerValue: (rule.trigger_config?.value as string) || "",
      conditionField: condition?.field || "status",
      conditionOperator: condition?.operator || "equals",
      conditionValue: condition?.value || "",
      actionType: action?.type || "create_notification",
      actionTarget: (action?.payload?.target as string) || "owner",
      actionMessage: (action?.payload?.message as string) || "",
      enabled: rule.enabled,
    });
  };

  const upsertRule = async () => {
    if (!currentTenant || !user || !form.name.trim()) {
      toast({ title: "Fehlende Angaben", description: "Bitte Regelname ausfüllen.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      tenant_id: currentTenant.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      module: form.module,
      trigger_type: form.triggerType,
      trigger_config: {
        field: form.triggerField,
        value: form.triggerValue,
      },
      conditions: {
        all: [
          {
            field: form.conditionField,
            operator: form.conditionOperator,
            value: form.conditionValue,
          },
        ],
      },
      actions: [
        {
          type: form.actionType,
          payload: {
            target: form.actionTarget,
            message: form.actionMessage,
          },
        },
      ],
      enabled: form.enabled,
    };

    const query = editingRuleId
      ? supabase.from("automation_rules" as any).update(payload).eq("id", editingRuleId)
      : supabase.from("automation_rules" as any).insert({ ...payload, created_by: user.id });

    const { error } = await query;

    setSaving(false);
    if (error) {
      toast({ title: "Speichern fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: editingRuleId ? "Regel aktualisiert" : "Regel erstellt" });
    resetForm();
    loadData();
  };

  const deleteRule = async (ruleId: string) => {
    const { error } = await supabase.from("automation_rules" as any).delete().eq("id", ruleId);
    if (error) {
      toast({ title: "Löschen fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Regel gelöscht" });
    if (editingRuleId === ruleId) resetForm();
    loadData();
  };

  const triggerDryRun = async (rule: RuleRow) => {
    if (!currentTenant || !user) return;
    setRunningRuleId(rule.id);

    const idempotencyKey = crypto.randomUUID();
    const { error } = await supabase.functions.invoke("run-automation-rule", {
      body: {
        ruleId: rule.id,
        dryRun: true,
        idempotencyKey,
        sourcePayload: {
          status: "overdue",
          priority: "high",
          rule_name: rule.name,
          module: rule.module,
        },
      },
    });

    setRunningRuleId(null);
    if (error) {
      toast({ title: "Dry-Run fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Dry-Run erstellt", description: "Ausführung wurde in der Historie protokolliert." });
    loadData();
  };

  const triggerRunNow = async (rule: RuleRow) => {
    if (!currentTenant || !user) return;
    setRunningRuleId(rule.id);

    const idempotencyKey = crypto.randomUUID();
    const { error } = await supabase.functions.invoke("run-automation-rule", {
      body: {
        ruleId: rule.id,
        dryRun: false,
        idempotencyKey,
        sourcePayload: {
          status: "overdue",
          priority: "high",
          rule_name: rule.name,
          module: rule.module,
        },
      },
    });

    setRunningRuleId(null);
    if (error) {
      toast({ title: "Ausführung fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Regel ausgeführt", description: "Die Ausführung wurde protokolliert." });
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Automations werden geladen …
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>No-Code Regel-Builder</CardTitle>
          <CardDescription>
            Erstelle tenant-spezifische Automations mit Trigger, Bedingung und Aktion ohne Code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Regelname</Label>
              <Input
                id="rule-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="z. B. Überfällige Aufgaben erinnern"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="module">Modul</Label>
              <Select value={form.module} onValueChange={(value) => setForm((prev) => ({ ...prev, module: value, triggerField: "status", conditionField: "status" }))}>
                <SelectTrigger id="module"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODULE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Kurz erklären, wann und warum die Regel läuft"
            />
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select value={form.triggerType} onValueChange={(value) => setForm((prev) => ({ ...prev, triggerType: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Trigger-Feld</Label>
              <Select value={form.triggerField} onValueChange={(value) => setForm((prev) => ({ ...prev, triggerField: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {fieldOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Trigger-Wert</Label>
              <Input value={form.triggerValue} onChange={(e) => setForm((prev) => ({ ...prev, triggerValue: e.target.value }))} placeholder="z. B. overdue" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Bedingungsfeld</Label>
              <Select value={form.conditionField} onValueChange={(value) => setForm((prev) => ({ ...prev, conditionField: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {fieldOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operator</Label>
              <Select value={form.conditionOperator} onValueChange={(value) => setForm((prev) => ({ ...prev, conditionOperator: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITION_OPERATORS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bedingungswert</Label>
              <Input value={form.conditionValue} onChange={(e) => setForm((prev) => ({ ...prev, conditionValue: e.target.value }))} placeholder="z. B. offen" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Aktion</Label>
              <Select value={form.actionType} onValueChange={(value) => setForm((prev) => ({ ...prev, actionType: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ziel</Label>
              <Input value={form.actionTarget} onChange={(e) => setForm((prev) => ({ ...prev, actionTarget: e.target.value }))} placeholder="owner, teamlead, role:..." />
            </div>
            <div className="space-y-2">
              <Label>Nachricht/Parameter</Label>
              <Input value={form.actionMessage} onChange={(e) => setForm((prev) => ({ ...prev, actionMessage: e.target.value }))} placeholder="Optional" />
            </div>
          </div>

          <div className="flex items-center justify-between border rounded-md p-3">
            <div>
              <p className="text-sm font-medium">Regel aktiv</p>
              <p className="text-xs text-muted-foreground">Inaktive Regeln werden nicht ausgeführt.</p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, enabled: checked }))} />
          </div>

          <div className="flex gap-2">
            <Button onClick={upsertRule} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {editingRuleId ? "Regel speichern" : "Regel erstellen"}
            </Button>
            <Button variant="outline" onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" /> Neue Regel
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aktive Regeln</CardTitle>
          <CardDescription>{rules.length} Regeln im Tenant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Regeln vorhanden.</p>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-medium">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">{rule.description || "Keine Beschreibung"}</p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline">{rule.module}</Badge>
                      <Badge variant="outline">{rule.trigger_type}</Badge>
                      <Badge variant={rule.enabled ? "default" : "secondary"}>{rule.enabled ? "Aktiv" : "Inaktiv"}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(rule)}>Bearbeiten</Button>
                    <Button size="sm" variant="outline" onClick={() => triggerDryRun(rule)} disabled={runningRuleId === rule.id}>
                      {runningRuleId === rule.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" onClick={() => triggerRunNow(rule)} disabled={runningRuleId === rule.id}>
                      <Zap className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteRule(rule.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Aktualisiert {formatDistanceToNow(new Date(rule.updated_at), { addSuffix: true, locale: de })}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Run-Historie (inkl. Dry-Run)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Ausführungen protokolliert.</p>
          ) : (
            runs.map((run) => (
              <div key={run.id} className="flex items-center justify-between border rounded-md p-2">
                <div>
                  <p className="text-sm font-medium">Regel: {rules.find((rule) => rule.id === run.rule_id)?.name || `${run.rule_id.slice(0, 8)}…`}</p>
                  <p className="text-xs text-muted-foreground">
                    {run.trigger_source} · {formatDistanceToNow(new Date(run.started_at), { addSuffix: true, locale: de })}
                  </p>
                </div>
                <Badge variant={run.status === "failed" ? "destructive" : "outline"}>{run.dry_run ? "dry_run" : run.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
