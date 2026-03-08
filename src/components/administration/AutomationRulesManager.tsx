import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { AlertTriangle, Clock, Copy, Download, Loader2, Pause, Play, Plus, ShieldAlert, Trash2, Upload, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow, addMinutes } from "date-fns";
import { de } from "date-fns/locale";
import { AutomationRuleWizard, DEFAULT_FORM, DEFAULT_ACTION, RULE_TEMPLATES, type WizardForm, type ActionItem, type ConditionItem } from "./AutomationRuleWizard";
import { AutomationTemplateGallery } from "./AutomationTemplateGallery";
import { AutomationRuleVersions } from "./AutomationRuleVersions";
import { AutomationRuleExportDialog, AutomationRuleImportDialog } from "./AutomationRuleImportExport";
import { AutomationErrorDashboard } from "./AutomationErrorDashboard";
import { logAuditEvent, AuditActions } from "@/hooks/useAuditLog";

type RuleRow = {
  id: string;
  name: string;
  description: string | null;
  module: string;
  trigger_type: "record_changed" | "schedule" | "manual" | "webhook";
  trigger_config: Record<string, string>;
  conditions: { all?: Array<{ field: string; operator: string; value: string }>; any?: Array<{ field: string; operator: string; value: string }> };
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

type RunStepRow = {
  id: string;
  run_id: string;
  step_order: number;
  step_type: string;
  status: string;
  result_payload: Record<string, unknown> | null;
  error_message: string | null;
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
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [runStepsByRunId, setRunStepsByRunId] = useState<Record<string, RunStepRow[]>>({});
  const [form, setForm] = useState<WizardForm>(DEFAULT_FORM);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [runStatusFilter, setRunStatusFilter] = useState<string>("all");
  const [automationsPaused, setAutomationsPaused] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);
  const [versionsRuleId, setVersionsRuleId] = useState<string | null>(null);
  const [versionsRuleName, setVersionsRuleName] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const isAdmin = userRole === "abgeordneter";
  const canEdit = isAdmin;
  const canToggle = isAdmin || userRole === "mitarbeiter";

  const filteredRuns = useMemo(() => {
    if (runStatusFilter === "all") return runs;
    if (runStatusFilter === "dry_run") return runs.filter((run) => run.dry_run);
    return runs.filter((run) => run.status === runStatusFilter && !run.dry_run);
  }, [runs, runStatusFilter]);

  const toggleAutomationsPaused = async () => {
    if (!currentTenant) return;
    setTogglingPause(true);
    const newVal = !automationsPaused;
    const { error } = await supabase
      .from("tenants")
      .update({ automations_paused: newVal } as any)
      .eq("id", currentTenant.id);
    setTogglingPause(false);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    setAutomationsPaused(newVal);
    toast({ title: newVal ? "Alle Automations pausiert" : "Automations reaktiviert" });

    logAuditEvent({
      action: AuditActions.SETTINGS_CHANGED,
      details: { type: "automation_kill_switch", paused: newVal, tenant_id: currentTenant.id },
    });
  };

  const loadData = async () => {
    if (!currentTenant) return;

    setLoading(true);

    // Load user role
    if (user) {
      const { data: membership } = await supabase
        .from("user_tenant_memberships")
        .select("role")
        .eq("user_id", user.id)
        .eq("tenant_id", currentTenant.id)
        .eq("is_active", true)
        .maybeSingle();
      setUserRole(membership?.role || null);
    }

    // Load pause state from tenant
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("automations_paused")
      .eq("id", currentTenant.id)
      .maybeSingle();
    if (tenantData) {
      setAutomationsPaused(!!(tenantData as any).automations_paused);
    }

    const [{ data: rulesData, error: rulesError }, { data: runData, error: runsError }] = await Promise.all([
      supabase
        .from("automation_rules")
        .select("id, name, description, module, trigger_type, trigger_config, conditions, actions, enabled, updated_at")
        .eq("tenant_id", currentTenant.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("automation_rule_runs")
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

    setRules((rulesData || []) as unknown as RuleRow[]);
    setRuns((runData || []) as unknown as RunRow[]);
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

  const openNewWizard = () => {
    resetForm();
    setWizardOpen(true);
  };

  const useTemplate = (templateId: string) => {
    const template = RULE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    resetForm();
    setForm((prev) => ({
      ...prev,
      name: template.name,
      description: template.description,
      module: template.module,
      triggerType: template.triggerType,
      triggerField: template.triggerField,
      triggerValue: template.triggerValue,
      conditionLogic: "all",
      conditions: template.conditions.map((c) => ({ ...c })),
      actions: template.actions.map((a) => ({ ...a })),
      enabled: true,
    }));
    setWizardOpen(true);
  };

  const startEdit = (rule: RuleRow) => {
    // Detect condition logic from stored format
    const hasAny = !!(rule.conditions?.any);
    const conditionLogic: "all" | "any" = hasAny ? "any" : "all";
    const rawConditions = hasAny ? (rule.conditions?.any || []) : (rule.conditions?.all || []);

    const conditions: ConditionItem[] = rawConditions.map((c) => ({
      field: c.field || "status",
      operator: c.operator || "equals",
      value: c.value || "",
    }));
    if (conditions.length === 0) conditions.push({ field: "status", operator: "equals", value: "" });

    const actions: ActionItem[] = (rule.actions || []).map((a) => ({
      type: a.type || "create_notification",
      targetUserId: (a.payload?.target_user_id as string) || "",
      title: (a.payload?.title as string) || "",
      message: (a.payload?.message as string) || "",
      taskPriority: (a.payload?.priority as string) || "medium",
      taskCategory: (a.payload?.category as string) || "personal",
      taskDueDate: (a.payload?.due_date as string) || "",
      taskAssignees: (a.payload?.assigned_to as string) || "",
      table: (a.payload?.table as string) || "tasks",
      recordId: (a.payload?.record_id as string) || "",
      status: (a.payload?.status as string) || "",
      emailTemplateId: (a.payload?.template_id as string) || "",
      emailRecipient: (a.payload?.recipient_email as string) || "",
      emailRecipientName: (a.payload?.recipient_name as string) || "",
    }));
    if (actions.length === 0) actions.push({ ...DEFAULT_ACTION });

    setEditingRuleId(rule.id);
    setForm({
      name: rule.name,
      description: rule.description || "",
      module: rule.module,
      triggerType: rule.trigger_type,
      triggerField: (rule.trigger_config?.field as string) || "status",
      triggerValue: (rule.trigger_config?.value as string) || "",
      conditionLogic,
      conditions,
      actions,
      enabled: rule.enabled,
    });
    setWizardOpen(true);
  };

  const loadRunSteps = async (runId: string) => {
    const { data, error } = await supabase
      .from("automation_rule_run_steps")
      .select("id, run_id, step_order, step_type, status, result_payload, error_message")
      .eq("run_id", runId)
      .order("step_order", { ascending: true });

    if (error) {
      toast({ title: "Schritte konnten nicht geladen werden", description: error.message, variant: "destructive" });
      return;
    }

    setRunStepsByRunId((prev) => ({ ...prev, [runId]: (data || []) as unknown as RunStepRow[] }));
  };

  const toggleRunDetails = async (runId: string) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(runId);
    if (!runStepsByRunId[runId]) {
      await loadRunSteps(runId);
    }
  };

  const upsertRule = async () => {
    if (!currentTenant || !user || !form.name.trim()) {
      toast({ title: "Fehlende Angaben", description: "Bitte Regelname ausfüllen.", variant: "destructive" });
      return;
    }

    if (!canEdit) {
      toast({ title: "Keine Berechtigung", description: "Nur Abgeordnete dürfen Regeln erstellen/ändern.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const conditionsPayload = form.conditionLogic === "any"
      ? { any: form.conditions.map((c) => ({ field: c.field, operator: c.operator, value: c.value })) }
      : { all: form.conditions.map((c) => ({ field: c.field, operator: c.operator, value: c.value })) };

    const payload = {
      tenant_id: currentTenant.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      module: form.module,
      trigger_type: form.triggerType,
      trigger_config: { field: form.triggerField, value: form.triggerValue },
      conditions: conditionsPayload,
      actions: form.actions.map((a) => ({
        type: a.type,
        payload: {
          target_user_id: a.targetUserId,
          title: a.title,
          message: a.message,
          priority: a.taskPriority,
          category: a.taskCategory,
          due_date: a.taskDueDate,
          assigned_to: a.taskAssignees,
          table: a.table,
          record_id: a.recordId,
          status: a.status,
          template_id: a.emailTemplateId,
          recipient_email: a.emailRecipient,
          recipient_name: a.emailRecipientName,
        },
      })),
      enabled: form.enabled,
    };

    const query = editingRuleId
      ? supabase.from("automation_rules").update(payload).eq("id", editingRuleId)
      : supabase.from("automation_rules").insert([{ ...payload, created_by: user.id }]);

    const { error } = await query;
    setSaving(false);

    if (error) {
      toast({ title: "Speichern fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }

    // Audit trail
    logAuditEvent({
      action: editingRuleId ? "automation.rule_updated" : "automation.rule_created",
      details: { rule_name: form.name, module: form.module, rule_id: editingRuleId || "new" },
    });

    toast({ title: editingRuleId ? "Regel aktualisiert" : "Regel erstellt" });
    resetForm();
    setWizardOpen(false);
    loadData();
  };

  const deleteRule = async (ruleId: string) => {
    if (!canEdit) {
      toast({ title: "Keine Berechtigung", description: "Nur Abgeordnete dürfen Regeln löschen.", variant: "destructive" });
      return;
    }

    const ruleName = rules.find((r) => r.id === ruleId)?.name || ruleId;
    const { error } = await supabase.from("automation_rules").delete().eq("id", ruleId);
    if (error) {
      toast({ title: "Löschen fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }

    logAuditEvent({
      action: "automation.rule_deleted",
      details: { rule_id: ruleId, rule_name: ruleName },
    });

    toast({ title: "Regel gelöscht" });
    if (editingRuleId === ruleId) resetForm();
    loadData();
  };

  const toggleRuleEnabled = async (rule: RuleRow, checked: boolean) => {
    if (!canToggle) {
      toast({ title: "Keine Berechtigung", variant: "destructive" });
      return;
    }

    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, enabled: checked } : r))
    );
    const { error } = await supabase
      .from("automation_rules")
      .update({ enabled: checked })
      .eq("id", rule.id);
    if (error) {
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: !checked } : r))
      );
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: checked ? "Regel aktiviert" : "Regel deaktiviert" });
      logAuditEvent({
        action: checked ? "automation.rule_enabled" : "automation.rule_disabled",
        details: { rule_id: rule.id, rule_name: rule.name },
      });
    }
  };

  /** Build sourcePayload from the **stored** rule config, not the wizard form */
  const buildSourcePayloadFromRule = (rule: RuleRow): Record<string, string> => {
    const triggerField = rule.trigger_config?.field ?? "status";
    const triggerValue = rule.trigger_config?.value ?? "triggered";
    const conditions = rule.conditions?.all ?? rule.conditions?.any ?? [];
    const firstCondition = conditions[0];
    return {
      [triggerField]: triggerValue || "triggered",
      ...(firstCondition ? { [firstCondition.field]: firstCondition.value || "condition-match" } : {}),
      rule_name: rule.name,
      module: rule.module,
    };
  };

  const triggerDryRun = async (rule?: RuleRow) => {
    const targetRule = rule || (editingRuleId ? rules.find((r) => r.id === editingRuleId) : null);
    if (!currentTenant || !user || !targetRule) return;
    setRunningRuleId(targetRule.id);

    const idempotencyKey = crypto.randomUUID();
    const { error } = await supabase.functions.invoke("run-automation-rule", {
      body: {
        ruleId: targetRule.id,
        dryRun: true,
        idempotencyKey,
        sourcePayload: buildSourcePayloadFromRule(targetRule),
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
        sourcePayload: buildSourcePayloadFromRule(rule),
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

  const handleWizardDryRun = () => {
    if (editingRuleId) {
      const rule = rules.find((r) => r.id === editingRuleId);
      if (rule) triggerDryRun(rule);
    } else {
      toast({
        title: "Regel zuerst speichern",
        description: "Bitte erstelle die Regel zuerst, bevor du einen Dry-Run startest.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Automations werden geladen …
      </div>
    );
  }

    const failedRunCount = runs.filter((r) => r.status === "failed").length;

    return (
    <div className="space-y-6">
      {/* Role hint for non-admins */}
      {!canEdit && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Eingeschränkte Rechte</AlertTitle>
          <AlertDescription>
            Du kannst Regeln aktivieren/deaktivieren, aber nur Abgeordnete dürfen Regeln erstellen, bearbeiten oder löschen.
          </AlertDescription>
        </Alert>
      )}

      {/* Kill-Switch */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Pause className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Kill-Switch: Alle Automations pausieren</p>
              <p className="text-xs text-muted-foreground">
                {automationsPaused
                  ? "Alle Regeln sind aktuell pausiert – keine automatischen Ausführungen."
                  : "Automations sind aktiv und werden planmäßig ausgeführt."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {automationsPaused && <Badge variant="destructive">Pausiert</Badge>}
            <Switch
              checked={automationsPaused}
              onCheckedChange={toggleAutomationsPaused}
              disabled={togglingPause || !canEdit}
              aria-label="Automations pausieren"
            />
          </div>
        </CardContent>
      </Card>

      {/* Failed runs alert banner */}
      {failedRunCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Fehlgeschlagene Runs</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{failedRunCount} Automation-Run{failedRunCount > 1 ? "s" : ""} fehlgeschlagen.</span>
            <Button
              variant="outline"
              size="sm"
              className="ml-4 border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => setRunStatusFilter("failed")}
            >
              Fehler anzeigen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Wizard Dialog */}
      <AutomationRuleWizard
        open={wizardOpen}
        onOpenChange={(open) => {
          setWizardOpen(open);
          if (!open) resetForm();
        }}
        form={form}
        setForm={setForm}
        onSave={upsertRule}
        onDryRun={handleWizardDryRun}
        editingRuleId={editingRuleId}
        saving={saving}
        runningDryRun={runningRuleId !== null}
      />

      {/* Template Gallery */}
      <AutomationTemplateGallery onUseTemplate={useTemplate} />

      {/* Error Dashboard */}
      <AutomationErrorDashboard onRetrigger={loadData} />

      {/* Rules list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Automations-Regeln</CardTitle>
              <CardDescription>{rules.length} Regeln im Tenant</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setExportOpen(true)}>
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)} disabled={!canEdit}>
                <Upload className="h-4 w-4 mr-2" /> Import
              </Button>
              <Button onClick={openNewWizard} disabled={!canEdit}>
                <Plus className="h-4 w-4 mr-2" /> Neue Regel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Regeln vorhanden.</p>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(checked) => toggleRuleEnabled(rule, checked)}
                      disabled={!canToggle}
                      aria-label={`Regel ${rule.name} ${rule.enabled ? "deaktivieren" : "aktivieren"}`}
                    />
                    <div className="space-y-1">
                      <p className="font-medium">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">{rule.description || "Keine Beschreibung"}</p>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline">{rule.module}</Badge>
                        <Badge variant="outline">{rule.trigger_type}</Badge>
                        {rule.conditions?.any && (
                          <Badge variant="secondary" className="text-[10px]">ODER</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => startEdit(rule)} disabled={!canEdit}>
                      Bearbeiten
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setVersionsRuleId(rule.id);
                        setVersionsRuleName(rule.name);
                      }}
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => triggerDryRun(rule)}
                      disabled={runningRuleId === rule.id}
                    >
                      {runningRuleId === rule.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => triggerRunNow(rule)}
                      disabled={runningRuleId === rule.id || !rule.enabled}
                    >
                      <Zap className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteRule(rule.id)} disabled={!canEdit}>
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

      {/* Run history */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Run-Historie (inkl. Dry-Run)</CardTitle>
            <Select value={runStatusFilter} onValueChange={setRunStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="dry_run">Dry-Run</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Ausführungen protokolliert.</p>
          ) : (
            filteredRuns.map((run) => (
              <div key={run.id} className="border rounded-md p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      Regel: {rules.find((rule) => rule.id === run.rule_id)?.name || `${run.rule_id.slice(0, 8)}…`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {run.trigger_source} · {formatDistanceToNow(new Date(run.started_at), { addSuffix: true, locale: de })}
                    </p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge variant={run.status === "failed" ? "destructive" : "outline"}>
                      {run.dry_run ? "dry_run" : run.status}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => toggleRunDetails(run.id)}>
                      Details
                    </Button>
                  </div>
                </div>
                {expandedRunId === run.id ? (
                  <div className="rounded bg-muted/50 p-2 space-y-1">
                    {run.error_message ? (
                      <p className="text-xs text-destructive">Fehler: {run.error_message}</p>
                    ) : null}
                    {(runStepsByRunId[run.id] || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">Keine Step-Logs vorhanden.</p>
                    ) : (
                      (runStepsByRunId[run.id] || []).map((step) => (
                        <div key={step.id} className="text-xs border-b last:border-b-0 py-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span>
                              #{step.step_order} · {step.step_type}
                            </span>
                            <span className={step.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
                              {step.status}
                            </span>
                          </div>
                          {step.error_message ? <p className="text-destructive">Fehler: {step.error_message}</p> : null}
                          {step.result_payload ? (
                            <pre className="bg-background rounded p-2 overflow-x-auto text-[11px] whitespace-pre-wrap">
                              {JSON.stringify(step.result_payload, null, 2)}
                            </pre>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Version History Dialog */}
      {versionsRuleId && (
        <AutomationRuleVersions
          ruleId={versionsRuleId}
          ruleName={versionsRuleName}
          open={!!versionsRuleId}
          onOpenChange={(open) => { if (!open) setVersionsRuleId(null); }}
          onRestore={loadData}
        />
      )}

      {/* Export Dialog */}
      <AutomationRuleExportDialog
        rules={rules}
        open={exportOpen}
        onOpenChange={setExportOpen}
      />

      {/* Import Dialog */}
      <AutomationRuleImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={loadData}
      />
    </div>
  );
}
