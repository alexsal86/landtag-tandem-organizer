import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
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
import { ArrowLeft, ArrowRight, Check, Clock, Filter, FolderPlus, Loader2, Play, Plus, Save, ShieldCheck, Trash2, TriangleAlert, WandSparkles, Zap } from "lucide-react";

import {
  MODULE_OPTIONS,
  CONDITION_OPERATORS,
  ACTION_TYPES,
  MODULE_TO_TABLE,
  STATUS_TABLE_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  TRIGGER_TYPES,
  FIELD_OPTIONS_BY_MODULE,
  FIELD_SPEC_BY_MODULE,
  RULE_TEMPLATES,
  DEFAULT_ACTION,
  DEFAULT_CONDITION,
  DEFAULT_CONDITION_GROUP,
  DEFAULT_FORM,
} from "./automationRule/constants";
import {
  validateConditionGroup,
  countConditions,
  collectSemanticIssues,
  sanitizeTriggerValue,
  evaluateCondition,
} from "./automationRule/logic";
import type {
  ActionItem,
  ConditionItem,
  ConditionGroup,
  FieldType,
  FieldSpec,
  WizardForm,
} from "./automationRule/types";

// Re-exports for backwards compatibility with external consumers
export {
  MODULE_TO_TABLE,
  RULE_TEMPLATES,
  DEFAULT_ACTION,
  DEFAULT_CONDITION,
  DEFAULT_FORM,
  validateConditionGroup,
  countConditions,
  sanitizeTriggerValue,
};
export type { ActionItem, ConditionItem, ConditionGroup, WizardForm };

const STEPS = [
  { label: "Trigger wählen", icon: Clock },
  { label: "Bedingungen", icon: Filter },
  { label: "Aktionen/Approvals", icon: ShieldCheck },
  { label: "Simulation", icon: Play },
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

// --- Sub-components for conditions / actions ---

function ConditionCard({
  condition,
  index,
  fieldOptions,
  onChange,
  onRemove,
  canRemove,
}: {
  condition: ConditionItem;
  index: number;
  fieldOptions: Array<{ value: string; label: string }>;
  onChange: (index: number, patch: Partial<ConditionItem>) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Bedingung {index + 1}
        </span>
        {canRemove && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onRemove(index)}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Feld</Label>
          <Select value={condition.field} onValueChange={(v) => onChange(index, { field: v })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fieldOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Operator</Label>
          <Select value={condition.operator} onValueChange={(v) => onChange(index, { operator: v })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_OPERATORS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Wert</Label>
          <Input
            className="h-8 text-xs"
            value={condition.value}
            onChange={(e) => onChange(index, { value: e.target.value })}
            placeholder="z. B. high"
          />
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  action,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  action: ActionItem;
  index: number;
  onChange: (index: number, patch: Partial<ActionItem>) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}) {
  const isNotification = action.type === "create_notification" || action.type === "send_push_notification";
  const isStatus = action.type === "update_record_status";
  const isTask = action.type === "create_task";
  const isEmail = action.type === "send_email_template";
  const isApproval = action.type === "create_approval_request";

  const { currentTenant } = useTenant();
  const [emailTemplates, setEmailTemplates] = useState<Array<{ id: string; name: string; subject: string }>>([]);

  useEffect(() => {
    if (!isEmail || !currentTenant?.id) return;
    supabase
      .from("email_templates")
      .select("id, name, subject")
      .eq("tenant_id", currentTenant.id)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        if (data) setEmailTemplates(data);
      });
  }, [isEmail, currentTenant?.id]);

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Aktion {index + 1}
        </span>
        {canRemove && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onRemove(index)}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Aktionstyp</Label>
        <Select value={action.type} onValueChange={(v) => onChange(index, { type: v })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_TYPES.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isNotification && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Empfänger:in *</Label>
            <TenantUserSelect
              value={action.targetUserId}
              onValueChange={(v) => onChange(index, { targetUserId: v })}
              placeholder="Empfänger:in auswählen…"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Titel</Label>
              <Input className="h-8 text-xs" value={action.title} onChange={(e) => onChange(index, { title: e.target.value })} placeholder="Notification-Titel" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nachricht</Label>
              <Input className="h-8 text-xs" value={action.message} onChange={(e) => onChange(index, { message: e.target.value })} placeholder="Optional" />
            </div>
          </div>
        </div>
      )}

      {isStatus && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Tabelle</Label>
            <Select value={action.table} onValueChange={(v) => onChange(index, { table: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_TABLE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Record-ID *</Label>
            <Input className="h-8 text-xs" value={action.recordId} onChange={(e) => onChange(index, { recordId: e.target.value })} placeholder="record_id" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Zielstatus *</Label>
            <Input className="h-8 text-xs" value={action.status} onChange={(e) => onChange(index, { status: e.target.value })} placeholder="status" />
          </div>
        </div>
      )}

      {isTask && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Aufgaben-Titel *</Label>
            <Input className="h-8 text-xs" value={action.title} onChange={(e) => onChange(index, { title: e.target.value })} placeholder="Titel der zu erstellenden Aufgabe" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Priorität</Label>
              <Select value={action.taskPriority} onValueChange={(v) => onChange(index, { taskPriority: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kategorie</Label>
              <Input className="h-8 text-xs" value={action.taskCategory} onChange={(e) => onChange(index, { taskCategory: e.target.value })} placeholder="personal" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Beschreibung</Label>
            <Input className="h-8 text-xs" value={action.message} onChange={(e) => onChange(index, { message: e.target.value })} placeholder="Optional" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Fällig am</Label>
              <Input className="h-8 text-xs" value={action.taskDueDate} onChange={(e) => onChange(index, { taskDueDate: e.target.value })} placeholder="2026-03-01" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Zuweisen an</Label>
              <TenantUserSelect
                value={action.taskAssignees}
                onValueChange={(v) => onChange(index, { taskAssignees: v })}
                placeholder="Nutzer:in zuweisen…"
              />
            </div>
          </div>
        </div>
      )}

      {isEmail && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">E-Mail-Template *</Label>
            {emailTemplates.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Keine aktiven Templates vorhanden. Erstelle Templates unter E-Mail → Vorlagen.</p>
            ) : (
              <Select value={action.emailTemplateId} onValueChange={(v) => onChange(index, { emailTemplateId: v })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Template wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {emailTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} — {t.subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Empfänger-E-Mail *</Label>
              <Input className="h-8 text-xs" value={action.emailRecipient} onChange={(e) => onChange(index, { emailRecipient: e.target.value })} placeholder="empfaenger@example.com" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Empfänger-Name</Label>
              <Input className="h-8 text-xs" value={action.emailRecipientName} onChange={(e) => onChange(index, { emailRecipientName: e.target.value })} placeholder="Optional" />
            </div>
          </div>
        </div>
      )}

      {isApproval && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Approver *</Label>
            <TenantUserSelect
              value={action.targetUserId}
              onValueChange={(v) => onChange(index, { targetUserId: v })}
              placeholder="Freigebende Person auswählen…"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Policy</Label>
              <Select value={action.approvalPolicy} onValueChange={(v) => onChange(index, { approvalPolicy: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single Approval</SelectItem>
                  <SelectItem value="four_eyes">4-Augen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mindest-Approver</Label>
              <Input className="h-8 text-xs" value={action.approvalMinimumApprovers} onChange={(e) => onChange(index, { approvalMinimumApprovers: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fällig in Stunden</Label>
              <Input className="h-8 text-xs" value={action.approvalDueInHours} onChange={(e) => onChange(index, { approvalDueInHours: e.target.value })} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Recursive ConditionGroup UI ---

function ConditionGroupEditor({
  group,
  onChange,
  onRemove,
  fieldOptions,
  depth = 0,
  canRemove = false,
}: {
  group: ConditionGroup;
  onChange: (updated: ConditionGroup) => void;
  onRemove?: () => void;
  fieldOptions: Array<{ value: string; label: string }>;
  depth?: number;
  canRemove?: boolean;
}) {
  const updateCondition = (index: number, patch: Partial<ConditionItem>) => {
    const next = [...group.conditions];
    next[index] = { ...next[index], ...patch };
    onChange({ ...group, conditions: next });
  };

  const addCondition = () => {
    onChange({
      ...group,
      conditions: [...group.conditions, { ...DEFAULT_CONDITION, field: fieldOptions[0]?.value || "status" }],
    });
  };

  const removeCondition = (index: number) => {
    const next = group.conditions.filter((_, i) => i !== index);
    onChange({ ...group, conditions: next });
  };

  const addSubGroup = () => {
    onChange({
      ...group,
      groups: [
        ...group.groups,
        { logic: group.logic === "all" ? "any" : "all", conditions: [{ ...DEFAULT_CONDITION, field: fieldOptions[0]?.value || "status" }], groups: [] },
      ],
    });
  };

  const updateSubGroup = (index: number, updated: ConditionGroup) => {
    const next = [...group.groups];
    next[index] = updated;
    onChange({ ...group, groups: next });
  };

  const removeSubGroup = (index: number) => {
    onChange({ ...group, groups: group.groups.filter((_, i) => i !== index) });
  };

  const toggleLogic = () => {
    onChange({ ...group, logic: group.logic === "all" ? "any" : "all" });
  };

  const borderColor = depth === 0 ? "border-border" : group.logic === "all" ? "border-primary/30" : "border-accent/50";
  const bgColor = depth === 0 ? "" : group.logic === "all" ? "bg-primary/5" : "bg-accent/10";

  return (
    <div className={cn("rounded-lg border p-3 space-y-2", borderColor, bgColor)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Logic toggle */}
          <div className="flex rounded-md border overflow-hidden">
            <button
              type="button"
              onClick={toggleLogic}
              className={cn(
                "px-2.5 py-1 text-[11px] font-semibold transition-colors",
                group.logic === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              UND
            </button>
            <button
              type="button"
              onClick={toggleLogic}
              className={cn(
                "px-2.5 py-1 text-[11px] font-semibold transition-colors",
                group.logic === "any"
                  ? "bg-accent text-accent-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              ODER
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {group.logic === "all" ? "Alle müssen zutreffen" : "Mindestens eine"}
          </span>
          {depth > 0 && (
            <Badge variant="outline" className="text-[9px]">Gruppe Ebene {depth + 1}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {depth < 2 && (
            <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1" onClick={addSubGroup}>
              <FolderPlus className="h-3 w-3" /> Untergruppe
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1" onClick={addCondition}>
            <Plus className="h-3 w-3" /> Bedingung
          </Button>
          {canRemove && onRemove && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onRemove}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {/* Conditions in this group */}
      {group.conditions.map((condition, i) => (
        <div key={`c-${i}`}>
          {i > 0 && (
            <div className="flex items-center justify-center py-0.5">
              <Badge variant="secondary" className="text-[9px]">
                {group.logic === "all" ? "UND" : "ODER"}
              </Badge>
            </div>
          )}
          <ConditionCard
            condition={condition}
            index={i}
            fieldOptions={fieldOptions}
            onChange={updateCondition}
            onRemove={removeCondition}
            canRemove={group.conditions.length + group.groups.length > 1}
          />
        </div>
      ))}

      {/* Sub-groups */}
      {group.groups.map((sub, i) => (
        <div key={`g-${i}`}>
          {(group.conditions.length > 0 || i > 0) && (
            <div className="flex items-center justify-center py-0.5">
              <Badge variant="secondary" className="text-[9px]">
                {group.logic === "all" ? "UND" : "ODER"}
              </Badge>
            </div>
          )}
          <ConditionGroupEditor
            group={sub}
            onChange={(updated) => updateSubGroup(i, updated)}
            onRemove={() => removeSubGroup(i)}
            fieldOptions={fieldOptions}
            depth={depth + 1}
            canRemove
          />
        </div>
      ))}
    </div>
  );
}

// --- Main Wizard ---

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

  const updateConditionGroup = (updated: ConditionGroup) => {
    setForm((prev) => ({ ...prev, conditionGroup: updated }));
  };

  const updateAction = (index: number, patch: Partial<ActionItem>) => {
    setForm((prev) => {
      const next = [...prev.actions];
      next[index] = { ...next[index], ...patch };
      return { ...prev, actions: next };
    });
  };

  const addAction = () => {
    setForm((prev) => ({
      ...prev,
      actions: [...prev.actions, { ...DEFAULT_ACTION }],
    }));
  };

  const removeAction = (index: number) => {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  };

  const parsedSamplePayload = useMemo(() => {
    if (!form.samplePayload.trim()) return null;
    try {
      const parsed = JSON.parse(form.samplePayload);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }, [form.samplePayload]);

  const samplePayloadParseError = useMemo(() => {
    if (!form.samplePayload.trim()) return null;
    try {
      JSON.parse(form.samplePayload);
      return null;
    } catch {
      return "Testdaten sind kein gültiges JSON.";
    }
  }, [form.samplePayload]);

  const semanticIssues = useMemo(
    () => collectSemanticIssues(form, parsedSamplePayload),
    [form, parsedSamplePayload],
  );

  const matchingConditionCount = useMemo(() => {
    if (!parsedSamplePayload) return null;
    const specs = FIELD_SPEC_BY_MODULE[form.module] ?? {};
    const flat: ConditionItem[] = [];
    const walk = (group: ConditionGroup) => {
      flat.push(...group.conditions);
      group.groups.forEach(walk);
    };
    walk(form.conditionGroup);
    return flat.filter((condition) => {
      const fieldType = specs[condition.field]?.type ?? "string";
      return evaluateCondition(condition, fieldType, parsedSamplePayload[condition.field]);
    }).length;
  }, [form.conditionGroup, form.module, parsedSamplePayload]);

  const stepValid = useMemo(() => {
    switch (currentStep) {
      case 0:
        return !!form.module && !!form.triggerType && !!form.triggerField && (form.triggerType !== "record_changed" || form.triggerValue.trim().length > 0);
      case 1:
        return validateConditionGroup(form.conditionGroup);
      case 2:
        return form.actions.length > 0 && form.actions.every((a) => {
          const isNotif = a.type === "create_notification" || a.type === "send_push_notification";
          const isStat = a.type === "update_record_status";
          const isTask = a.type === "create_task";
          const isEmail = a.type === "send_email_template";
          const isApproval = a.type === "create_approval_request";
          if (isNotif) return a.targetUserId.trim().length > 0;
          if (isStat) return a.recordId.trim().length > 0 && a.status.trim().length > 0;
          if (isTask) return a.title.trim().length > 0;
          if (isEmail) return a.emailTemplateId.trim().length > 0 && a.emailRecipient.trim().length > 0;
          if (isApproval) return a.targetUserId.trim().length > 0 && Number(a.approvalMinimumApprovers) >= 1;
          return true;
        });
      case 3: {
        const hasErrors = semanticIssues.some((issue) => issue.level === "error");
        return !samplePayloadParseError && !hasErrors;
      }
      default:
        return true;
    }
  }, [currentStep, form]);

  const applyTemplate = (templateId: string) => {
    const template = RULE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
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
      samplePayload: "",
    }));
  };

  const handleSave = async () => {
    await onSave();
    setCurrentStep(0);
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) setCurrentStep(0);
    onOpenChange(val);
  };

  const summaryLine = useMemo(() => {
    const mod = MODULE_OPTIONS.find((m) => m.value === form.module)?.label || form.module;
    return { mod };
  }, [form.module]);

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

        {/* Step 1: Trigger wählen */}
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
              <Label>Fachdomäne/Modul</Label>
              <Select
                value={form.module}
                onValueChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    module: v,
                    triggerField: "status",
                    conditions: prev.conditions.map((c) => ({ ...c, field: "status" })),
                  }))
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

            {form.triggerType === "webhook" && (
              <div className="rounded-md border border-dashed p-3 text-sm space-y-2">
                <p className="text-muted-foreground">
                  <Zap className="inline h-4 w-4 mr-1" />
                  Webhook-Regeln werden durch einen externen HTTP-Aufruf ausgelöst. Nach dem Speichern wird die Webhook-URL in den Regel-Details angezeigt.
                </p>
                {editingRuleId && (
                  <div className="bg-muted rounded p-2">
                    <p className="text-xs font-medium mb-1">Webhook-URL:</p>
                    <code className="text-xs break-all select-all">
                      {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/automation-webhook?ruleId=${editingRuleId}`}
                    </code>
                  </div>
                )}
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

            <div className="space-y-2">
              <Label>Trigger-Wert {form.triggerType === "record_changed" ? "*" : ""}</Label>
              <Input
                value={form.triggerValue}
                onChange={(e) => setForm((prev) => ({ ...prev, triggerValue: sanitizeTriggerValue(prev.triggerType, e.target.value) }))}
                placeholder={form.triggerType === "record_changed" ? "z. B. overdue" : "z. B. 90_days"}
              />
            </div>
          </div>
        )}

        {/* Step 2: Bedingungen */}
        {currentStep === 1 && (
          <div className="space-y-3 py-2">
            <div>
              <p className="text-sm font-medium">Bedingungen</p>
              <p className="text-xs text-muted-foreground">
                Erstelle Bedingungsgruppen mit UND/ODER-Verknüpfung. Verschachtele Gruppen für komplexe Logik.
              </p>
            </div>

            <ConditionGroupEditor
              group={form.conditionGroup}
              onChange={updateConditionGroup}
              fieldOptions={fieldOptions}
              depth={0}
            />
          </div>
        )}

        {/* Step 3: Aktionen / Approvals */}
        {currentStep === 2 && (
          <div className="space-y-4 py-2">
            {/* Summary card */}
            <div className="rounded-md border bg-muted/30 p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Zusammenfassung</p>
              <p className="text-sm">
                <Badge variant="outline" className="mr-1">{summaryLine.mod}</Badge>
                Wenn <span className="font-medium">{form.triggerField}</span> = „{form.triggerValue || "—"}"
              </p>
              <p className="text-sm text-muted-foreground">
                {countConditions(form.conditionGroup)} Bedingung{countConditions(form.conditionGroup) !== 1 ? "en" : ""} ({form.conditionGroup.groups.length > 0 ? "verschachtelt" : form.conditionGroup.logic === "all" ? "UND" : "ODER"}) · {form.actions.length} Aktion{form.actions.length !== 1 ? "en" : ""}
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Aktionen</p>
                <p className="text-xs text-muted-foreground">Alle Aktionen werden nacheinander ausgeführt.</p>
              </div>
              <Button variant="outline" size="sm" onClick={addAction} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Aktion
              </Button>
            </div>

            {form.actions.map((action, i) => (
              <ActionCard
                key={i}
                action={action}
                index={i}
                onChange={updateAction}
                onRemove={removeAction}
                canRemove={form.actions.length > 1}
              />
            ))}
          </div>
        )}

        {/* Step 4: Simulation */}
        {currentStep === 3 && (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">Simulation / Dry-Run</p>
              <p className="text-xs text-muted-foreground">Füge einen Beispieldatensatz als JSON ein, um Bedingungs-Matches und Aktionen in der Vorschau zu prüfen.</p>
            </div>

            <div className="space-y-2">
              <Label>Beispieldatensatz (JSON)</Label>
              <textarea
                className="w-full min-h-36 rounded-md border bg-background px-3 py-2 text-xs font-mono"
                value={form.samplePayload}
                onChange={(e) => setForm((prev) => ({ ...prev, samplePayload: e.target.value }))}
                placeholder='{"status":"open","priority":"high"}'
              />
              {samplePayloadParseError && <p className="text-xs text-destructive">{samplePayloadParseError}</p>}
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Echtzeit-Validierung</p>
              {semanticIssues.length === 0 ? (
                <p className="text-xs text-emerald-600">Keine statischen/semantischen Probleme erkannt.</p>
              ) : (
                <div className="space-y-1">
                  {semanticIssues.map((issue, idx) => (
                    <div key={`${issue.message}-${idx}`} className={cn("text-xs flex items-center gap-1.5", issue.level === "error" ? "text-destructive" : "text-palette-amber")}>
                      {issue.level === "error" ? <TriangleAlert className="h-3.5 w-3.5" /> : <WandSparkles className="h-3.5 w-3.5" />}
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-md border p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Vorschau</p>
              <p className="text-sm">
                Bedingungen gematcht: <span className="font-medium">{matchingConditionCount ?? 0}/{countConditions(form.conditionGroup)}</span>
              </p>
              <p className="text-sm">Aktionen, die laufen würden: <span className="font-medium">{form.actions.length}</span></p>
            </div>
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
