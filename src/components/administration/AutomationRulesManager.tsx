import { useMemo, useState } from "react";
import type { Json } from "@/integrations/supabase/types";
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
import { AutomationRuleWizard, DEFAULT_FORM, DEFAULT_ACTION, RULE_TEMPLATES, sanitizeTriggerValue, type WizardForm, type ActionItem, type ConditionItem, type ConditionGroup } from "./AutomationRuleWizard";

// --- Helpers for nested condition group serialization ---

/** Serialize a ConditionGroup tree into the DB JSON format */
function serializeConditionGroup(group: ConditionGroup): Record<string, Json> {
  const items: Json[] = group.conditions.map((c) => ({
    field: c.field,
    operator: c.operator,
    value: c.value,
  }));
  for (const sub of group.groups) {
    items.push(serializeConditionGroup(sub) as unknown as Json);
  }
  return { [group.logic]: items };
}

/** Parse DB JSON format back into a ConditionGroup tree */
function parseConditionGroup(raw: unknown): ConditionGroup {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== "object") {
    return { logic: "all", conditions: [{ field: "status", operator: "equals", value: "" }], groups: [] };
  }
  const logic: "all" | "any" = r.any ? "any" : "all";
  const items: unknown[] = (r[logic] as unknown[]) || [];
  const conditions: ConditionItem[] = [];
  const groups: ConditionGroup[] = [];

  for (const item of items) {
    if (item && typeof item === "object" && ("all" in (item as Record<string, unknown>) || "any" in (item as Record<string, unknown>))) {
      groups.push(parseConditionGroup(item));
    } else if (item && typeof item === "object" && "field" in (item as Record<string, unknown>)) {
      const c = item as Record<string, string>;
      conditions.push({ field: c.field || "status", operator: c.operator || "equals", value: c.value || "" });
    }
  }
  if (conditions.length === 0 && groups.length === 0) {
    conditions.push({ field: "status", operator: "equals", value: "" });
  }
  return { logic, conditions, groups };
}

/** Flatten a ConditionGroup tree into a flat list (for legacy compat) */
function flattenConditions(group: ConditionGroup): ConditionItem[] {
  const result = [...group.conditions];
  for (const sub of group.groups) {
    result.push(...flattenConditions(sub));
  }
  return result.length > 0 ? result : [{ field: "status", operator: "equals", value: "" }];
}
import { AutomationTemplateGallery } from "./AutomationTemplateGallery";
import { AutomationRuleVersions } from "./AutomationRuleVersions";
import { AutomationRuleExportDialog, AutomationRuleImportDialog } from "./AutomationRuleImportExport";
import { AutomationErrorDashboard } from "./AutomationErrorDashboard";
import { logAuditEvent, AuditActions } from "@/hooks/useAuditLog";
import { useAutomationAdminMutations, useAutomationMembershipRole, useAutomationPauseState, useAutomationRules, useAutomationRunSteps, useAutomationRuns } from "./hooks/useAutomationAdminData";
import type { AutomationRuleRecordView as RuleRow, AutomationRunRecordView as RunRow } from "./automationShared";

export function AutomationRulesManager() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [form, setForm] = useState<WizardForm>(DEFAULT_FORM);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [runStatusFilter, setRunStatusFilter] = useState<string>("all");
  const [runModuleFilter, setRunModuleFilter] = useState<string>("all");
  const [runOwnerFilter, setRunOwnerFilter] = useState<string>("all");
  const [runRuleFilter, setRunRuleFilter] = useState<string>("all");
  const [runTimeFilter, setRunTimeFilter] = useState<string>("all");
  const [versionsRuleId, setVersionsRuleId] = useState<string | null>(null);
  const [versionsRuleName, setVersionsRuleName] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const tenantId = currentTenant?.id;
  const { data: userRole } = useAutomationMembershipRole(tenantId, user?.id);
  const { data: automationsPaused = false, isLoading: pauseLoading, error: pauseError } = useAutomationPauseState(tenantId);
  const { data: rules = [], isLoading: rulesLoading, error: rulesError } = useAutomationRules(tenantId);
  const { data: runs = [], isLoading: runsLoading, error: runsError } = useAutomationRuns(tenantId);
  const { data: expandedRunSteps = [], isLoading: runStepsLoading, isError: runStepsError, error: runStepsQueryError, refetch: refetchRunSteps } = useAutomationRunSteps(expandedRunId || undefined);
  const { togglePause, upsertRule: upsertRuleMutation, deleteRule: deleteRuleMutation, toggleRuleEnabled: toggleRuleEnabledMutation, runRule, refreshAll } = useAutomationAdminMutations(tenantId, user?.id);

  const loading = pauseLoading || rulesLoading || runsLoading;
  const saving = upsertRuleMutation.isPending;
  const togglingPause = togglePause.isPending;

  const isAdmin = userRole === "abgeordneter";
  const canEdit = isAdmin;
  const canToggle = isAdmin || userRole === "mitarbeiter";

  const filteredRuns = useMemo(() => {
    return runs.filter((run: Record<string, any>) => {
      const statusMatch = runStatusFilter === "all"
        ? true
        : runStatusFilter === "dry_run"
          ? !!run.dry_run
          : run.status === runStatusFilter && !run.dry_run;

      const moduleValue = String((run.result_payload?.module ?? run.input_payload?.module ?? "unknown"));
      const ownerValue = String((run.result_payload?.owner_id ?? run.input_payload?.owner_id ?? "unassigned"));
      const ruleMatch = runRuleFilter === "all" ? true : run.rule_id === runRuleFilter;
      const moduleMatch = runModuleFilter === "all" ? true : moduleValue === runModuleFilter;
      const ownerMatch = runOwnerFilter === "all" ? true : ownerValue === runOwnerFilter;

      const now = Date.now();
      const started = new Date(run.started_at).getTime();
      const timeMatch = runTimeFilter === "all"
        ? true
        : runTimeFilter === "24h"
          ? now - started <= 24 * 60 * 60 * 1000
          : runTimeFilter === "7d"
            ? now - started <= 7 * 24 * 60 * 60 * 1000
            : now - started <= 30 * 24 * 60 * 60 * 1000;

      return statusMatch && moduleMatch && ownerMatch && ruleMatch && timeMatch;
    });
  }, [runs, runStatusFilter, runModuleFilter, runOwnerFilter, runRuleFilter, runTimeFilter]);

  const runModules = useMemo(
    () => Array.from(new Set(runs.map((run: { result_payload?: { module?: string; owner_id?: string }; input_payload?: { module?: string; owner_id?: string } }) => String(run.result_payload?.module ?? run.input_payload?.module ?? "unknown")))) as string[],
    [runs],
  );
  const runOwners = useMemo(
    () => Array.from(new Set(runs.map((run: { result_payload?: { owner_id?: string }; input_payload?: { owner_id?: string } }) => String(run.result_payload?.owner_id ?? run.input_payload?.owner_id ?? "unassigned")))) as string[],
    [runs],
  );

  // --- Feature: Rule statistics (success rate, avg duration) ---
  const ruleStats = useMemo(() => {
    const statsMap: Record<string, { total: number; success: number; totalDurationMs: number; withDuration: number }> = {};
    for (const run of runs) {
      if (run.dry_run) continue;
      if (!statsMap[run.rule_id]) {
        statsMap[run.rule_id] = { total: 0, success: 0, totalDurationMs: 0, withDuration: 0 };
      }
      const s = statsMap[run.rule_id];
      s.total += 1;
      if (run.status === "success") s.success += 1;
      if (run.finished_at && run.started_at) {
        const dur = new Date(run.finished_at).getTime() - new Date(run.started_at).getTime();
        if (dur > 0) {
          s.totalDurationMs += dur;
          s.withDuration += 1;
        }
      }
    }
    return statsMap;
  }, [runs]);

  // --- Feature: Next scheduled run time ---
  const getNextRunTime = (rule: RuleRow): Date | null => {
    if (rule.trigger_type !== "schedule") return null;
    const interval = Number(rule.trigger_config?.minutes_interval);
    if (!interval || interval <= 0) return null;
    const ruleRuns = runs.filter((r: Record<string, any>) => r.rule_id === rule.id && !r.dry_run);
    const lastRun = ruleRuns[0]; // already sorted desc by started_at
    const base = lastRun ? new Date(lastRun.started_at) : new Date();
    return addMinutes(base, interval);
  };

  // --- Feature: Duplicate rule ---
  const duplicateRule = (rule: RuleRow) => {
    startEdit(rule);
    setEditingRuleId(null);
    setForm((prev) => ({ ...prev, name: `${prev.name} (Kopie)` }));
  };

  const toggleAutomationsPaused = async () => {
    if (!tenantId) return;
    const newVal = !automationsPaused;

    try {
      await togglePause.mutateAsync(newVal);
      toast({ title: newVal ? "Alle Automations pausiert" : "Automations reaktiviert" });
      logAuditEvent({
        action: AuditActions.SETTINGS_CHANGED,
        details: { type: "automation_kill_switch", paused: newVal, tenant_id: tenantId },
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Automations konnten nicht umgeschaltet werden.",
        variant: "destructive",
      });
    }
  };

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
    const conditions = template.conditions.map((c) => ({ ...c }));
    setForm((prev) => ({
      ...prev,
      name: template.name,
      description: template.description,
      module: template.module,
      triggerType: template.triggerType,
      triggerField: template.triggerField,
      triggerValue: template.triggerValue,
      conditionLogic: "all",
      conditions,
      conditionGroup: { logic: "all", conditions, groups: [] },
      actions: template.actions.map((a) => ({ ...a })),
      enabled: true,
    }));
    setWizardOpen(true);
  };

  const startEdit = (rule: RuleRow) => {
    // Parse nested condition group from stored format
    const conditionGroup = parseConditionGroup(rule.conditions);

    // Legacy flat fields for backward compat
    const flatConditions = flattenConditions(conditionGroup);
    const conditionLogic = conditionGroup.logic;

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
      approvalPolicy: (a.payload?.approval_policy as string) || "single",
      approvalDueInHours: (a.payload?.approval_due_in_hours as string) || "24",
      approvalMinimumApprovers: (a.payload?.approval_minimum_approvers as string) || "1",
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
      conditions: flatConditions,
      conditionGroup,
      actions,
      enabled: rule.enabled,
      samplePayload: "",
    });
    setWizardOpen(true);
  };

  const toggleRunDetails = async (runId: string) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(runId);
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

    const conditionsPayload = serializeConditionGroup(form.conditionGroup);

    const payload = {
      tenant_id: currentTenant.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      module: form.module,
      trigger_type: form.triggerType as RuleRow["trigger_type"],
      trigger_config: { field: form.triggerField, value: sanitizeTriggerValue(form.triggerType, form.triggerValue) },
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
          approval_policy: a.approvalPolicy,
          approval_due_in_hours: a.approvalDueInHours,
          approval_minimum_approvers: a.approvalMinimumApprovers,
        },
      })),
      enabled: form.enabled,
    };

    try {
      await upsertRuleMutation.mutateAsync({ editingRuleId, payload });
    } catch (error) {
      toast({
        title: "Speichern fehlgeschlagen",
        description: error instanceof Error ? error.message : "Regel konnte nicht gespeichert werden.",
        variant: "destructive",
      });
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
  };

  const deleteRule = async (ruleId: string) => {
    if (!canEdit) {
      toast({ title: "Keine Berechtigung", description: "Nur Abgeordnete dürfen Regeln löschen.", variant: "destructive" });
      return;
    }

    const ruleName = rules.find((r: Record<string, any>) => r.id === ruleId)?.name || ruleId;
    try {
      await deleteRuleMutation.mutateAsync(ruleId);
    } catch (error) {
      toast({
        title: "Löschen fehlgeschlagen",
        description: error instanceof Error ? error.message : "Regel konnte nicht gelöscht werden.",
        variant: "destructive",
      });
      return;
    }

    logAuditEvent({
      action: "automation.rule_deleted",
      details: { rule_id: ruleId, rule_name: ruleName },
    });

    toast({ title: "Regel gelöscht" });
    if (editingRuleId === ruleId) resetForm();
  };

  const toggleRuleEnabled = async (rule: RuleRow, checked: boolean) => {
    if (!canToggle) {
      toast({ title: "Keine Berechtigung", variant: "destructive" });
      return;
    }

    try {
      await toggleRuleEnabledMutation.mutateAsync({ ruleId: rule.id, enabled: checked });
      toast({ title: checked ? "Regel aktiviert" : "Regel deaktiviert" });
      logAuditEvent({
        action: checked ? "automation.rule_enabled" : "automation.rule_disabled",
        details: { rule_id: rule.id, rule_name: rule.name },
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Regel konnte nicht umgeschaltet werden.",
        variant: "destructive",
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
    const targetRule = rule || (editingRuleId ? rules.find((r: Record<string, any>) => r.id === editingRuleId) : null);
    if (!currentTenant || !user || !targetRule) return;
    setRunningRuleId(targetRule.id);

    try {
      await runRule.mutateAsync({
        ruleId: targetRule.id,
        dryRun: true,
        sourcePayload: buildSourcePayloadFromRule(targetRule),
      });
    } catch (error) {
      toast({
        title: "Dry-Run fehlgeschlagen",
        description: error instanceof Error ? error.message : "Dry-Run konnte nicht gestartet werden.",
        variant: "destructive",
      });
    } finally {
      setRunningRuleId(null);
    }
  };

  const triggerRunNow = async (rule: RuleRow) => {
    if (!currentTenant || !user) return;
    setRunningRuleId(rule.id);

    try {
      await runRule.mutateAsync({
        ruleId: rule.id,
        dryRun: false,
        sourcePayload: buildSourcePayloadFromRule(rule),
      });
    } catch (error) {
      toast({
        title: "Ausführung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Regel konnte nicht ausgeführt werden.",
        variant: "destructive",
      });
    } finally {
      setRunningRuleId(null);
    }
  };

  const handleWizardDryRun = () => {
    if (editingRuleId) {
      const rule = rules.find((r: Record<string, any>) => r.id === editingRuleId);
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
  const failedRunCount = runs.filter((r: Record<string, any>) => r.status === "failed").length;
  const loadError = pauseError || rulesError || runsError;

  return (
    <div className="space-y-6">
      {loadError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Automations konnten nicht vollständig geladen werden</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{loadError instanceof Error ? loadError.message : "Bitte erneut versuchen."}</span>
            <Button size="sm" variant="outline" onClick={() => void refreshAll()}>Neu laden</Button>
          </AlertDescription>
        </Alert>
      )}

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
      <AutomationErrorDashboard onRetrigger={refreshAll} />

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
            rules.map((rule: RuleRow) => {
              const stats = ruleStats[rule.id];
              const successRate = stats && stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : null;
              const avgDuration = stats && stats.withDuration > 0 ? Math.round(stats.totalDurationMs / stats.withDuration / 1000) : null;
              const nextRun = getNextRunTime(rule);

              return (
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
                        {successRate !== null && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant={successRate >= 80 ? "default" : successRate >= 50 ? "secondary" : "destructive"} className="text-[10px]">
                                  {successRate}% Erfolg
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                {stats.success}/{stats.total} Runs erfolgreich
                                {avgDuration !== null && ` · Ø ${avgDuration}s`}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {nextRun && rule.enabled && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Clock className="h-3 w-3" />
                            Nächster Run: {formatDistanceToNow(nextRun, { addSuffix: true, locale: de })}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => startEdit(rule)} disabled={!canEdit}>
                      Bearbeiten
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => duplicateRule(rule)} disabled={!canEdit} title="Regel duplizieren">
                      <Copy className="h-4 w-4" />
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
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Run history */}
      <Card>
        <CardHeader>
          <div className="space-y-3">
            <CardTitle>Run-Historie (inkl. Dry-Run)</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={runStatusFilter} onValueChange={setRunStatusFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Status: Alle</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="dry_run">Dry-Run</SelectItem>
                </SelectContent>
              </Select>
              <Select value={runModuleFilter} onValueChange={setRunModuleFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Modul" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Modul: Alle</SelectItem>
                  {runModules.map((module) => (<SelectItem key={module} value={module}>{module}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={runOwnerFilter} onValueChange={setRunOwnerFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Owner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Owner: Alle</SelectItem>
                  {runOwners.map((owner) => (<SelectItem key={owner} value={owner}>{owner}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={runRuleFilter} onValueChange={setRunRuleFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Regel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Regel: Alle</SelectItem>
                  {rules.map((rule: RuleRow) => (<SelectItem key={rule.id} value={rule.id}>{rule.name}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={runTimeFilter} onValueChange={setRunTimeFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Zeit" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Zeit: Alle</SelectItem>
                  <SelectItem value="24h">Letzte 24h</SelectItem>
                  <SelectItem value="7d">Letzte 7 Tage</SelectItem>
                  <SelectItem value="30d">Letzte 30 Tage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Ausführungen protokolliert.</p>
          ) : (
            filteredRuns.map((run: Record<string, any>) => (
              <div key={run.id} className="border rounded-md p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      Regel: {rules.find((rule: Record<string, any>) => rule.id === run.rule_id)?.name || `${run.rule_id.slice(0, 8)}…`}
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
                    {!!run.result_payload?.explainability && (
                      <div className="text-xs space-y-1 rounded border bg-background p-2">
                        <p><span className="font-medium">Warum ausgelöst?</span> {String((run.result_payload?.explainability as Record<string, unknown> | undefined)?.why_triggered ?? "—")}</p>
                        <p><span className="font-medium">Warum nicht?</span> {String((run.result_payload?.explainability as Record<string, unknown> | undefined)?.why_not_triggered ?? "—")}</p>
                        <p className="text-muted-foreground">run_id: {String(run.result_payload?.run_id ?? run.id)} · workflow_version: {String(run.result_payload?.workflow_version ?? "v1")} · entity_id: {String(run.result_payload?.entity_id ?? "unknown")}</p>
                      </div>
                    )}
                    {runStepsLoading && expandedRunId === run.id ? (
                      <p className="text-xs text-muted-foreground">Schritte werden geladen…</p>
                    ) : runStepsError && expandedRunId === run.id ? (
                      <div className="space-y-2">
                        <p className="text-xs text-destructive">Fehler: {runStepsQueryError instanceof Error ? runStepsQueryError.message : "Schritte konnten nicht geladen werden."}</p>
                        <Button size="sm" variant="outline" onClick={() => void refetchRunSteps()}>Erneut versuchen</Button>
                      </div>
                    ) : expandedRunSteps.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Keine Step-Logs vorhanden.</p>
                    ) : (
                      expandedRunSteps.map((step: Record<string, any>) => (
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
          onRestore={refreshAll}
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
        onImported={refreshAll}
      />
    </div>
  );
}
