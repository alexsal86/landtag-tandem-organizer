import { lazy, Suspense, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { automationTabFromParams } from "./automationNavigation";
import type { Json } from "@/integrations/supabase/types";
import { EmptyState, LoadingState } from '@/components/ui-patterns';
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2, Pause, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  if (conditions.length === 0 && groups.length === 0 && !Array.isArray(r.all) && !Array.isArray(r.any)) {
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
import { AutomationRulesList } from "./AutomationRulesList";
import styles from "./AutomationRulesWorkspace.module.css";
import { AutomationTemplateGallery } from "./AutomationTemplateGallery";
import { AutomationRuleVersions } from "./AutomationRuleVersions";
import { AutomationRuleExportDialog, AutomationRuleImportDialog } from "./AutomationRuleImportExport";
import { AutomationErrorDashboard } from "./AutomationErrorDashboard";
import { logAuditEvent, AuditActions } from "@/hooks/useAuditLog";
import { useAutomationAdminMutations, useAutomationMembershipRole, useAutomationPauseState, useAutomationRules, useAutomationRunSteps, useAutomationRuns } from "./hooks/useAutomationAdminData";
import type { AutomationRuleRecordView as RuleRow, AutomationRunRecordView as RunRow } from "./automationShared";
import { notify } from "@/lib/notify";
import { AnnualRoutinesOverview } from "./AnnualRoutinesOverview";
import { annualRoutineAction, validateAnnualRoutine } from "@/features/automation/annualRoutines";
import { isCalendarSchedule, nextCalendarOccurrence, validateCalendarSchedule } from "@/features/automation/calendarSchedule";

const WorkflowEngineManager = lazy(() => import("./WorkflowEngineManager").then(module => ({ default: module.WorkflowEngineManager })));

export function AutomationRulesManager() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = automationTabFromParams(new URLSearchParams(location.search));
  const changeTab = (value: string) => {
    const params = new URLSearchParams(location.search);
    params.set("automationTab", value === "history" || value === "dispatcher" || value === "annual" ? value : "rules");
    navigate({ pathname: location.pathname, search: params.toString() });
  };

  const showHistory = (ruleId?: string, status?: string) => {
    const params = new URLSearchParams(location.search);
    params.set("automationTab", "history");
    if (params.get("adminSection") === "automation") params.set("adminSubSection", "rules");
    if (ruleId) params.set("automationRuleId", ruleId); else params.delete("automationRuleId");
    if (status) params.set("automationRunStatus", status); else params.delete("automationRunStatus");
    navigate({ pathname: location.pathname, search: params.toString() });
  };

  return (
    <Tabs value={tab} onValueChange={changeTab} className={`${styles.workspace} space-y-5`}>
      <div className={styles.head}>
        <TabsList aria-label="Regeln und Workflows" className={styles.tabs}>
          <TabsTrigger value="rules" className={styles.tab}>Regeln</TabsTrigger>
          <TabsTrigger value="annual" className={styles.tab}>Jahresroutinen</TabsTrigger>
          <TabsTrigger value="history" className={styles.tab}>Ausführungshistorie</TabsTrigger>
          <TabsTrigger value="dispatcher" className={styles.tab}>Dispatcher</TabsTrigger>
        </TabsList>
        <AutomationKillSwitch />
      </div>
      <AutomationStatusLine />
      <TabsContent value="rules"><AutomationRulesContent view="rules" onShowHistory={showHistory} /></TabsContent>
      <TabsContent value="history"><AutomationRulesContent view="history" onShowHistory={showHistory} /></TabsContent>
      <TabsContent value="annual"><AutomationRulesContent view="annual" onShowHistory={showHistory} /></TabsContent>
      <TabsContent value="dispatcher">
        <Suspense fallback={<LoadingState variant="list" rows={3} />}><WorkflowEngineManager /></Suspense>
      </TabsContent>
    </Tabs>
  );
}

function AutomationKillSwitch() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const { data: userRole } = useAutomationMembershipRole(tenantId, user?.id);
  const { data: automationsPaused = false, isLoading, error } = useAutomationPauseState(tenantId);
  const { togglePause } = useAutomationAdminMutations(tenantId, user?.id);
  const canEdit = userRole === "abgeordneter" || userRole === "bueroleitung";

  const toggleAutomationsPaused = async () => {
    if (!tenantId) return;
    const newVal = !automationsPaused;

    try {
      await togglePause.mutateAsync(newVal);
      notify.success(newVal ? "Alle Automations pausiert" : "Automations reaktiviert");
      logAuditEvent({
        action: AuditActions.SETTINGS_CHANGED,
        details: { type: "automation_kill_switch", paused: newVal, tenant_id: tenantId },
      });
    } catch (error) {
      notify.error("Fehler", {
        description: error instanceof Error ? error.message : "Automations konnten nicht umgeschaltet werden."
      });
    }
  };

  return (
    <div
      className="flex w-fit shrink-0 items-center gap-2.5 py-1"
      title={error ? "Status konnte nicht geladen werden." : automationsPaused
        ? "Alle Regeln sind aktuell pausiert – keine automatischen Ausführungen."
        : "Automationen sind aktiviert und folgen den Auslösern der aktiven Regeln."}
    >
      <Pause className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <label htmlFor="automation-kill-switch" className="text-sm font-medium">Alle Automationen pausieren</label>
      {automationsPaused && <Badge variant="destructive">Pausiert</Badge>}
      <Switch
        id="automation-kill-switch"
        className="data-[state=checked]:bg-destructive"
        checked={automationsPaused}
        onCheckedChange={toggleAutomationsPaused}
        disabled={isLoading || !!error || togglePause.isPending || !canEdit || !tenantId}
        aria-label="Alle Automationen pausieren"
      />
    </div>
  );
}

function AutomationStatusLine() {
  const { currentTenant } = useTenant();
  const { data: paused, isLoading, error } = useAutomationPauseState(currentTenant?.id);
  if (isLoading) return <p className={styles.status} role="status"><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />Automationsstatus wird geladen…</p>;
  if (error || !currentTenant || paused === undefined) return <p className={styles.status} role="status"><AlertTriangle className="h-4 w-4" aria-hidden="true" />Automationsstatus ist nicht verfügbar.</p>;
  return <p className={`${styles.status} ${paused ? styles.paused : ''}`} role="status" aria-live="polite"><span className={styles.dot} aria-hidden="true" />{paused ? 'Alle Automationen sind pausiert. Automatische Ausführungen und laufende Routinen ruhen.' : 'Automationen sind aktiviert. Aktive Regeln werden gemäß ihren Auslösern ausgeführt.'}</p>;
}

function AutomationRulesContent({ view, onShowHistory }: { view: "rules" | "history" | "annual"; onShowHistory: (ruleId?: string, status?: string) => void }) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [form, setForm] = useState<WizardForm>(DEFAULT_FORM);
  const [wizardOpen, setWizardOpen] = useState(false);
  const location = useLocation();
  const historyParams = new URLSearchParams(location.search);
  const [runStatusFilter, setRunStatusFilter] = useState<string>(() => historyParams.get("automationRunStatus") || "all");
  const [runModuleFilter, setRunModuleFilter] = useState<string>("all");
  const [runOwnerFilter, setRunOwnerFilter] = useState<string>("all");
  const [runRuleFilter, setRunRuleFilter] = useState<string>(() => historyParams.get("automationRuleId") || "all");
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
  const { upsertRule: upsertRuleMutation, deleteRule: deleteRuleMutation, toggleRuleEnabled: toggleRuleEnabledMutation, runRule, refreshAll } = useAutomationAdminMutations(tenantId, user?.id);

  const loading = pauseLoading || rulesLoading || runsLoading;
  const saving = upsertRuleMutation.isPending;

  const isAdmin = userRole === "abgeordneter" || userRole === "bueroleitung";
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
    if (isCalendarSchedule(rule.trigger_config)) return nextCalendarOccurrence(rule.trigger_config, new Date());
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
    setForm((prev) => ({ ...prev, name: `${prev.name} (Kopie)`, actions: prev.actions.map(action => action.type === "run_annual_routine" ? { ...action, annualTaskId: "", systemFunction: "" } : action) }));
  };

  const resetForm = () => {
    setEditingRuleId(null);
    setForm(DEFAULT_FORM);
  };

  const openNewWizard = () => {
    resetForm();
    if (view === "annual") setForm({ ...DEFAULT_FORM, triggerType: "schedule", triggerField: "scheduled_date", schedule: { schedule_kind: "annual", month: "4", day: "1", hour: "9", month_end: "false", timezone: "Europe/Berlin", minutes_interval: "60" }, conditions: [], conditionGroup: { logic: "all", conditions: [], groups: [] }, actions: [{ ...DEFAULT_ACTION, type: "run_annual_routine", routineCategory: "admin" }] });
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
      schedule: "schedule" in template ? { ...template.schedule } : DEFAULT_FORM.schedule,
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
      originalType: a.type,
      originalPayload: a.payload ? { ...a.payload } : undefined,
      annualTaskId: a.payload?.annual_task_id || "",
      systemFunction: a.payload?.system_function || "",
      routineCategory: a.payload?.routine_category || "admin",
      officeTemplateId: a.payload?.office_template_id || "",
      routineDeadlineMonth: a.payload?.routine_deadline_month || "",
      routineDeadlineDay: a.payload?.routine_deadline_day || "",
      routineSteps: a.payload?.routine_steps_text || "",
      routineStepKinds: a.payload?.routine_step_kinds || "",
      routineStepSettings: a.payload?.routine_step_settings || "",
      routineRequiresConfirmation: a.payload?.routine_requires_confirmation === "true",
      routineConfirmedYear: a.payload?.routine_confirmed_year || "",
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
      webhookSecret: typeof rule.trigger_config?.webhook_secret === "string" ? rule.trigger_config.webhook_secret : "",
      schedule: { schedule_kind: rule.trigger_config.schedule_kind || "interval", month: rule.trigger_config.month || "4", day: rule.trigger_config.day || "1", hour: rule.trigger_config.hour || "9", month_end: rule.trigger_config.month_end || "false", timezone: rule.trigger_config.timezone || "Europe/Berlin", minutes_interval: rule.trigger_config.minutes_interval || "60" },
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
      notify.error("Fehlende Angaben", { description: "Bitte Regelname ausfüllen."
});
      return;
    }

    if (!canEdit) {
      notify.error("Keine Berechtigung", { description: "Nur Abgeordnete und Büroleitung dürfen Regeln erstellen/ändern."
});
      return;
    }

    if (form.triggerType === "webhook" && (form.webhookSecret ?? "").length < 16) {
      notify.error("Webhook-Geheimnis fehlt", { description: "Bitte mindestens 16 Zeichen eingeben." });
      return;
    }

    const routineError = validateAnnualRoutine(form.triggerType, form.schedule, form.actions);
    if (routineError) { notify.error(routineError); return; }
    const conditionsPayload = serializeConditionGroup(form.conditionGroup);
    if (form.triggerType === "schedule" && form.schedule) {
      const error = isCalendarSchedule(form.schedule) ? validateCalendarSchedule(form.schedule)
        : !Number.isFinite(Number(form.schedule.minutes_interval)) || Number(form.schedule.minutes_interval) < 60 ? "Das Intervall muss mindestens 60 Minuten betragen." : null;
      if (error) { notify.error(error); return; }
    }

    const payload = {
      tenant_id: currentTenant.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      module: form.module,
      trigger_type: form.triggerType as RuleRow["trigger_type"],
      trigger_config: { field: form.triggerField, value: sanitizeTriggerValue(form.triggerType, form.triggerValue), ...((form.triggerType === "schedule" || form.actions.some(a => a.type === "run_annual_routine")) ? form.schedule : {}), ...(form.triggerType === "webhook" ? { webhook_secret: form.webhookSecret } : {}) },
      conditions: conditionsPayload,
      actions: form.actions.map((a) => ({
        type: a.type,
        payload: {
          ...(a.originalType === a.type ? a.originalPayload : {}),
          annual_task_id: a.annualTaskId || "",
          system_function: a.systemFunction || "",
          routine_category: a.routineCategory || "admin",
          office_template_id: a.officeTemplateId || "",
          routine_deadline_month: a.routineDeadlineMonth || "",
          routine_deadline_day: a.routineDeadlineDay || "",
          routine_steps_text: a.routineSteps || "",
          routine_step_kinds: a.routineStepKinds || "",
          routine_step_settings: a.routineStepSettings || "",
          routine_requires_confirmation: String(Boolean(a.routineRequiresConfirmation)),
          routine_confirmed_year: a.routineConfirmedYear || "",
          target_user_id: a.targetUserId,
          title: a.title,
          message: a.message,
          description: a.message,
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
      notify.error("Speichern fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Regel konnte nicht gespeichert werden."
});
      return;
    }

    // Audit trail
    logAuditEvent({
      action: editingRuleId ? "automation.rule_updated" : "automation.rule_created",
      details: { rule_name: form.name, module: form.module, rule_id: editingRuleId || "new" },
    });

    notify.success(editingRuleId ? "Regel aktualisiert" : "Regel erstellt");
    resetForm();
    setWizardOpen(false);
  };

  const deleteRule = async (ruleId: string) => {
    if (!canEdit) {
      notify.error("Keine Berechtigung", { description: "Nur Abgeordnete und Büroleitung dürfen Regeln löschen."
});
      return;
    }

    if (rules.some(rule => rule.id === ruleId && annualRoutineAction(rule)?.payload?.system_function)) { notify.error("System-Routinen können pausiert, aber nicht gelöscht werden."); return; }
    const ruleName = rules.find((r: Record<string, any>) => r.id === ruleId)?.name || ruleId;
    try {
      await deleteRuleMutation.mutateAsync(ruleId);
    } catch (error) {
      notify.error("Löschen fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Regel konnte nicht gelöscht werden."
});
      return;
    }

    logAuditEvent({
      action: "automation.rule_deleted",
      details: { rule_id: ruleId, rule_name: ruleName },
    });

    notify.success("Regel gelöscht");
    if (editingRuleId === ruleId) resetForm();
  };

  const toggleRuleEnabled = async (rule: RuleRow, checked: boolean) => {
    if (!canToggle) {
      notify.error("Keine Berechtigung");
      return;
    }

    try {
      await toggleRuleEnabledMutation.mutateAsync({ ruleId: rule.id, enabled: checked });
      notify.success(checked ? "Regel aktiviert" : "Regel deaktiviert");
      logAuditEvent({
        action: checked ? "automation.rule_enabled" : "automation.rule_disabled",
        details: { rule_id: rule.id, rule_name: rule.name },
      });
    } catch (error) {
      notify.error("Fehler", {
        description: error instanceof Error ? error.message : "Regel konnte nicht umgeschaltet werden."
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

  const triggerDryRun = async (rule?: RuleRow, sample?: Record<string, unknown>) => {
    const targetRule = rule || (editingRuleId ? rules.find((r: Record<string, any>) => r.id === editingRuleId) : null);
    if (!currentTenant || !user || !targetRule) return;
    setRunningRuleId(targetRule.id);

    try {
      await runRule.mutateAsync({
        ruleId: targetRule.id,
        dryRun: true,
        sourcePayload: sample ?? buildSourcePayloadFromRule(targetRule),
      });
    } catch (error) {
      notify.error("Dry-Run fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Dry-Run konnte nicht gestartet werden."
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
      notify.error("Ausführung fehlgeschlagen", {
        description: error instanceof Error ? error.message : "Regel konnte nicht ausgeführt werden."
});
    } finally {
      setRunningRuleId(null);
    }
  };

  const handleWizardDryRun = (sample?: Record<string, unknown>) => {
    if (editingRuleId) {
      const rule = rules.find((r: Record<string, any>) => r.id === editingRuleId);
      if (rule) triggerDryRun(rule, sample);
    } else {
      notify.error("Regel zuerst speichern", {
        description: "Bitte erstelle die Regel zuerst, bevor du einen Dry-Run startest."
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
            Du kannst Regeln aktivieren/deaktivieren, aber nur Abgeordnete und Büroleitung dürfen Regeln erstellen, bearbeiten oder löschen.
          </AlertDescription>
        </Alert>
      )}

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
              onClick={() => { setRunStatusFilter("failed"); onShowHistory(undefined, "failed"); }}
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

      {view === "annual" && <AnnualRoutinesOverview onUseTemplate={useTemplate} rules={rules} onEdit={startEdit} onRun={rule => void triggerRunNow(rule)} onNew={month => { openNewWizard(); if (month) setForm(previous => previous.schedule ? ({ ...previous, schedule: { ...previous.schedule, month: String(month) } }) : previous); }} canEdit={canEdit} runningRuleId={runningRuleId} />}

      {/* Template Gallery */}
      {view === "rules" && <AutomationTemplateGallery onUseTemplate={useTemplate} canEdit={canEdit} />}

      {/* Error Dashboard */}
      {view === "history" && <AutomationErrorDashboard onRetrigger={refreshAll} />}

      {view === "rules" && <AutomationRulesList
        rules={rules} stats={ruleStats} canEdit={canEdit} canToggle={canToggle}
        paused={automationsPaused} pauseUnknown={!!pauseError} runningRuleId={runningRuleId}
        toggling={toggleRuleEnabledMutation.isPending} deleting={deleteRuleMutation.isPending}
        getNextRun={getNextRunTime} onEdit={startEdit} onDuplicate={duplicateRule}
        onVersions={rule => { setVersionsRuleId(rule.id); setVersionsRuleName(rule.name); }}
        onHistory={ruleId => onShowHistory(ruleId)} onDryRun={rule => void triggerDryRun(rule)}
        onRun={rule => void triggerRunNow(rule)} onDelete={ruleId => void deleteRule(ruleId)}
        onToggle={(rule, checked) => void toggleRuleEnabled(rule, checked)}
        onExport={() => setExportOpen(true)} onImport={() => setImportOpen(true)} onNew={openNewWizard}
      />}

      {/* Run history */}
      {view === "history" && <Card>
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
            <EmptyState size="sm" title="Noch keine Ausführungen" description="Hier erscheinen Läufe, sobald deine Regeln triggern." />
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
      </Card>}

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
