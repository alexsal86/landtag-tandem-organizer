import { useMemo, useState } from "react";
import { TenantUserSelect } from "./TenantUserSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Check, Clock, Filter, Loader2, Play, Save, Zap } from "lucide-react";

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

const STATUS_TABLE_OPTIONS = ["tasks", "decisions", "knowledge_documents", "casefiles"] as const;
const TASK_PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;

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

export const RULE_TEMPLATES = [
  {
    id: "tasks-overdue",
    name: "Überfällige Aufgaben erinnern",
    description: "Wenn Aufgaben überfällig sind, Benachrichtigung an zuständige Person.",
    module: "tasks",
    triggerType: "record_changed",
    triggerField: "status",
    triggerValue: "overdue",
    conditionField: "priority",
    conditionOperator: "equals",
    conditionValue: "high",
    actionType: "create_notification",
    actionTargetUserId: "",
    actionTitle: "Überfällige Aufgabe",
    actionMessage: "Eine priorisierte Aufgabe ist überfällig.",
    actionTable: "tasks",
    actionRecordId: "",
    actionStatus: "",
  },
  {
    id: "knowledge-review",
    name: "Wissensartikel Review anstoßen",
    description: "Markiert alte Wissensartikel zur Überprüfung.",
    module: "knowledge",
    triggerType: "schedule",
    triggerField: "updated_at",
    triggerValue: "90_days",
    conditionField: "status",
    conditionOperator: "equals",
    conditionValue: "published",
    actionType: "update_record_status",
    actionTargetUserId: "",
    actionTitle: "",
    actionMessage: "",
    actionTable: "knowledge_documents",
    actionRecordId: "",
    actionStatus: "review",
  },
] as const;

export type WizardForm = {
  name: string;
  description: string;
  module: string;
  triggerType: string;
  triggerField: string;
  triggerValue: string;
  conditionField: string;
  conditionOperator: string;
  conditionValue: string;
  actionType: string;
  actionTargetUserId: string;
  actionTitle: string;
  actionMessage: string;
  actionTaskPriority: string;
  actionTaskCategory: string;
  actionTaskDueDate: string;
  actionTaskAssignees: string;
  actionTable: string;
  actionRecordId: string;
  actionStatus: string;
  enabled: boolean;
};

export const DEFAULT_FORM: WizardForm = {
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
  actionTargetUserId: "",
  actionTitle: "",
  actionMessage: "",
  actionTaskPriority: "medium",
  actionTaskCategory: "personal",
  actionTaskDueDate: "",
  actionTaskAssignees: "",
  actionTable: "tasks",
  actionRecordId: "",
  actionStatus: "",
  enabled: true,
};

const STEPS = [
  { label: "Grundlagen", icon: Zap },
  { label: "Trigger", icon: Clock },
  { label: "Bedingungen", icon: Filter },
  { label: "Aktionen", icon: Play },
] as const;

interface AutomationRuleWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: WizardForm;
  setForm: React.Dispatch<React.SetStateAction<WizardForm>>;
  onSave: () => Promise<void>;
  onDryRun: () => void;
  editingRuleId: string | null;
  saving: boolean;
  runningDryRun: boolean;
}

export function AutomationRuleWizard({
  open,
  onOpenChange,
  form,
  setForm,
  onSave,
  onDryRun,
  editingRuleId,
  saving,
  runningDryRun,
}: AutomationRuleWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const fieldOptions = useMemo(
    () => FIELD_OPTIONS_BY_MODULE[form.module] ?? FIELD_OPTIONS_BY_MODULE.tasks,
    [form.module]
  );

  const isNotificationAction = form.actionType === "create_notification" || form.actionType === "send_push_notification";
  const isStatusAction = form.actionType === "update_record_status";
  const isCreateTaskAction = form.actionType === "create_task";

  // Per-step validation
  const stepValid = useMemo(() => {
    switch (currentStep) {
      case 0:
        return form.name.trim().length >= 3;
      case 1:
        return form.triggerType === "schedule" || form.triggerType === "manual" || form.triggerValue.trim().length > 0;
      case 2:
        return form.conditionValue.trim().length > 0;
      case 3: {
        if (isNotificationAction) return form.actionTargetUserId.trim().length > 0;
        if (isStatusAction) return form.actionRecordId.trim().length > 0 && form.actionStatus.trim().length > 0;
        if (isCreateTaskAction) return form.actionTitle.trim().length > 0;
        return true;
      }
      default:
        return true;
    }
  }, [currentStep, form, isNotificationAction, isStatusAction, isCreateTaskAction]);

  const applyTemplate = (templateId: string) => {
    const template = RULE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setForm((prev) => ({ ...prev, ...template, enabled: true }));
  };

  const handleSave = async () => {
    await onSave();
    setCurrentStep(0);
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) setCurrentStep(0);
    onOpenChange(val);
  };

  // Summary for step 4
  const summaryLine = useMemo(() => {
    const mod = MODULE_OPTIONS.find((m) => m.value === form.module)?.label || form.module;
    const trigger = TRIGGER_TYPES.find((t) => t.value === form.triggerType)?.label || form.triggerType;
    const op = CONDITION_OPERATORS.find((o) => o.value === form.conditionOperator)?.label || form.conditionOperator;
    const action = ACTION_TYPES.find((a) => a.value === form.actionType)?.label || form.actionType;
    return { mod, trigger, op, action };
  }, [form]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingRuleId ? "Regel bearbeiten" : "Neue Regel erstellen"}</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1 mb-2">
          {STEPS.map((step, i) => {
            const StepIcon = step.icon;
            const isActive = i === currentStep;
            const isDone = i < currentStep;
            return (
              <div key={step.label} className="flex items-center gap-1 flex-1">
                <button
                  type="button"
                  onClick={() => i <= currentStep && setCurrentStep(i)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors w-full",
                    isActive && "bg-primary text-primary-foreground",
                    isDone && "bg-primary/10 text-primary",
                    !isActive && !isDone && "text-muted-foreground"
                  )}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn("h-px w-4 shrink-0", i < currentStep ? "bg-primary" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Step 1: Grundlagen */}
        {currentStep === 0 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Template laden (optional)</Label>
              <Select onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Vorlage wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Regelname *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="z. B. Überfällige Aufgaben erinnern"
              />
              {form.name.length > 0 && form.name.length < 3 && (
                <p className="text-xs text-destructive">Mindestens 3 Zeichen</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Kurz erklären, wann und warum die Regel läuft"
              />
            </div>
            <div className="space-y-2">
              <Label>Modul</Label>
              <Select
                value={form.module}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, module: v, triggerField: "status", conditionField: "status" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODULE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Regel aktiv</p>
                <p className="text-xs text-muted-foreground">Inaktive Regeln werden nicht ausgeführt.</p>
              </div>
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, enabled: checked }))}
              />
            </div>
          </div>
        )}

        {/* Step 2: Trigger */}
        {currentStep === 1 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Trigger-Typ</Label>
              <Select
                value={form.triggerType}
                onValueChange={(v) => setForm((prev) => ({ ...prev, triggerType: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.triggerType === "schedule" && (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                <Clock className="inline h-4 w-4 mr-1" />
                Zeitgesteuerte Regeln werden automatisch alle 5 Minuten vom Scheduler geprüft.
              </div>
            )}

            {form.triggerType === "manual" && (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                <Zap className="inline h-4 w-4 mr-1" />
                Manuelle Regeln werden per Button in der Regel-Liste ausgelöst.
              </div>
            )}

            <div className="space-y-2">
              <Label>Trigger-Feld</Label>
              <Select
                value={form.triggerField}
                onValueChange={(v) => setForm((prev) => ({ ...prev, triggerField: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fieldOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.triggerType === "record_changed" && (
              <div className="space-y-2">
                <Label>Trigger-Wert *</Label>
                <Input
                  value={form.triggerValue}
                  onChange={(e) => setForm((prev) => ({ ...prev, triggerValue: e.target.value }))}
                  placeholder="z. B. overdue"
                />
              </div>
            )}

            {form.triggerType !== "record_changed" && (
              <div className="space-y-2">
                <Label>Trigger-Wert</Label>
                <Input
                  value={form.triggerValue}
                  onChange={(e) => setForm((prev) => ({ ...prev, triggerValue: e.target.value }))}
                  placeholder="z. B. 90_days"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 3: Bedingungen */}
        {currentStep === 2 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Bedingungsfeld</Label>
              <Select
                value={form.conditionField}
                onValueChange={(v) => setForm((prev) => ({ ...prev, conditionField: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fieldOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operator</Label>
              <Select
                value={form.conditionOperator}
                onValueChange={(v) => setForm((prev) => ({ ...prev, conditionOperator: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPERATORS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bedingungswert *</Label>
              <Input
                value={form.conditionValue}
                onChange={(e) => setForm((prev) => ({ ...prev, conditionValue: e.target.value }))}
                placeholder="z. B. high"
              />
            </div>
          </div>
        )}

        {/* Step 4: Aktionen + Testlauf */}
        {currentStep === 3 && (
          <div className="space-y-4 py-2">
            {/* Summary card */}
            <div className="rounded-md border bg-muted/30 p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Zusammenfassung</p>
              <p className="text-sm">
                <Badge variant="outline" className="mr-1">{summaryLine.mod}</Badge>
                Wenn <span className="font-medium">{form.triggerField}</span> = „{form.triggerValue || "—"}"
                {" "}UND <span className="font-medium">{form.conditionField}</span>{" "}
                {summaryLine.op} „{form.conditionValue || "—"}"
              </p>
              <p className="text-sm">
                → <span className="font-medium">{summaryLine.action}</span>
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Aktion</Label>
              <Select
                value={form.actionType}
                onValueChange={(v) => setForm((prev) => ({ ...prev, actionType: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isNotificationAction && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Ziel-User-ID *</Label>
                  <Input
                    value={form.actionTargetUserId}
                    onChange={(e) => setForm((prev) => ({ ...prev, actionTargetUserId: e.target.value }))}
                    placeholder="UUID der Empfänger:in"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Titel</Label>
                  <Input
                    value={form.actionTitle}
                    onChange={(e) => setForm((prev) => ({ ...prev, actionTitle: e.target.value }))}
                    placeholder="Notification-Titel"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nachricht</Label>
                  <Input
                    value={form.actionMessage}
                    onChange={(e) => setForm((prev) => ({ ...prev, actionMessage: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
              </div>
            )}

            {isStatusAction && (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Tabelle</Label>
                  <Select
                    value={form.actionTable}
                    onValueChange={(v) => setForm((prev) => ({ ...prev, actionTable: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_TABLE_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Record-ID *</Label>
                  <Input
                    value={form.actionRecordId}
                    onChange={(e) => setForm((prev) => ({ ...prev, actionRecordId: e.target.value }))}
                    placeholder="record_id"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Zielstatus *</Label>
                  <Input
                    value={form.actionStatus}
                    onChange={(e) => setForm((prev) => ({ ...prev, actionStatus: e.target.value }))}
                    placeholder="status"
                  />
                </div>
              </div>
            )}

            {isCreateTaskAction && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Aufgaben-Titel *</Label>
                  <Input
                    value={form.actionTitle}
                    onChange={(e) => setForm((prev) => ({ ...prev, actionTitle: e.target.value }))}
                    placeholder="Titel der zu erstellenden Aufgabe"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Priorität</Label>
                    <Select
                      value={form.actionTaskPriority}
                      onValueChange={(v) => setForm((prev) => ({ ...prev, actionTaskPriority: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Kategorie</Label>
                    <Input
                      value={form.actionTaskCategory}
                      onChange={(e) => setForm((prev) => ({ ...prev, actionTaskCategory: e.target.value }))}
                      placeholder="personal"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Beschreibung</Label>
                  <Input
                    value={form.actionMessage}
                    onChange={(e) => setForm((prev) => ({ ...prev, actionMessage: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Fällig am</Label>
                    <Input
                      value={form.actionTaskDueDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, actionTaskDueDate: e.target.value }))}
                      placeholder="2026-03-01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Assigned_to</Label>
                    <Input
                      value={form.actionTaskAssignees}
                      onChange={(e) => setForm((prev) => ({ ...prev, actionTaskAssignees: e.target.value }))}
                      placeholder="UUID, UUID"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentStep((s) => s - 1)}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Zurück
          </Button>

          <div className="flex gap-2">
            {currentStep === 3 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDryRun}
                  disabled={!stepValid || runningDryRun}
                >
                  {runningDryRun ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  Dry-Run
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!stepValid || saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  {editingRuleId ? "Speichern" : "Erstellen"}
                </Button>
              </>
            )}

            {currentStep < 3 && (
              <Button size="sm" onClick={() => setCurrentStep((s) => s + 1)} disabled={!stepValid}>
                Weiter <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
