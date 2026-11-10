import { useEffect, useId, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { TenantUserSelect } from "./TenantUserSelect";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Check, Clock, Database, Hand, Webhook, Filter, FolderPlus, Loader2, Play, Plus, Save, ShieldCheck, Trash2, TriangleAlert, WandSparkles, Zap } from "lucide-react";

import {
  MODULE_OPTIONS,
  CONDITION_OPERATORS,
  ACTION_TYPES,
  MODULE_TO_TABLE,
  STATUS_TABLE_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  FIELD_OPTIONS_BY_MODULE,
  FIELD_SPEC_BY_MODULE,
  RULE_TEMPLATES,
  RULE_TEMPLATE_GROUPS,
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
} from "./automationRule/logic";
import type {
  ActionItem,
  ConditionItem,
  ConditionGroup,
  WizardForm,
} from "./automationRule/types";
import styles from "./automationRule/RuleEditor.module.css";
import { RuleEditorSummary } from "./automationRule/RuleEditorSummary";
import { editorFormSnapshot, editorSample, editorStepErrors, evaluateEditorSample, parseEditorSample } from "./automationRule/editorModel";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RoutinePreview } from "./automationRule/RoutinePreview";
import { AnnualRoutineFields } from "./automationRule/AnnualRoutineFields";
import { CalendarScheduleFields } from "./automationRule/CalendarScheduleFields";
import { isCalendarSchedule } from "@/features/automation/calendarSchedule";

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
  { label: "Auslöser", subtitle: "Wann", icon: Clock },
  { label: "Bedingungen", subtitle: "Wenn", icon: Filter },
  { label: "Aktionen & Freigaben", subtitle: "Dann", icon: ShieldCheck },
  { label: "Simulation", subtitle: "Prüfen", icon: Play },
] as const;

interface AutomationRuleWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: WizardForm;
  setForm: React.Dispatch<React.SetStateAction<WizardForm>>;
  onSave: () => Promise<void>;
  onDryRun: (sample?: Record<string, unknown>) => void;
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
  const id = useId();
  return <div className={styles.condition}>
    <div className={styles.field}><Label htmlFor={`${id}-field`}>Feld</Label><Select value={condition.field} onValueChange={field => onChange(index, { field })}><SelectTrigger id={`${id}-field`}><SelectValue /></SelectTrigger><SelectContent>{fieldOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
    <div className={styles.field}><Label htmlFor={`${id}-operator`}>Operator</Label><Select value={condition.operator} onValueChange={operator => onChange(index, { operator })}><SelectTrigger id={`${id}-operator`}><SelectValue /></SelectTrigger><SelectContent>{CONDITION_OPERATORS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
    <div className={styles.field}><Label htmlFor={`${id}-value`}>Wert</Label><Input id={`${id}-value`} value={condition.value} onChange={event => onChange(index, { value: event.target.value })} placeholder="z. B. high" /></div>
    {canRemove ? <EditorIconButton label={`Bedingung ${index + 1} entfernen`} onClick={() => onRemove(index)} /> : <span />}
  </div>;
}

function EditorIconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive" aria-label={label} onClick={onClick}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

function ActionCard({
  action,
  form,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  action: ActionItem;
  form: WizardForm;
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
    <div className={`${styles.actionCard} space-y-4`}>
      <div className={styles.actionHeader}>
        <span className="text-xs font-medium text-muted-foreground">
          Aktion {index + 1}
        </span>
        {canRemove && !(action.annualTaskId && action.systemFunction) && (
          <EditorIconButton label={`Aktion ${index + 1} entfernen`} onClick={() => onRemove(index)} />
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Aktionstyp</Label>
        <Select disabled={Boolean(action.annualTaskId && action.systemFunction)} value={action.type} onValueChange={(v) => onChange(index, { type: v })}>
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

      {action.type === "run_annual_routine" && <AnnualRoutineFields action={action} form={form} onChange={patch => onChange(index, patch)} />}

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
              <Input className="h-8 text-xs" value={action.title} onChange={(e) => onChange(index, { title: e.target.value })} placeholder="Titel der Benachrichtigung" />
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
            <Label className="text-xs">Datensatz-ID *</Label>
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
            <Label className="text-xs">Freigebende Person *</Label>
            <TenantUserSelect
              value={action.targetUserId}
              onValueChange={(v) => onChange(index, { targetUserId: v })}
              placeholder="Freigebende Person auswählen…"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Freigaberegel</Label>
              <Select value={action.approvalPolicy} onValueChange={(v) => onChange(index, { approvalPolicy: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Einzelne Freigabe</SelectItem>
                  <SelectItem value="four_eyes">4-Augen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mindestzahl Freigaben</Label>
              <Input className="h-8 text-xs" value={action.approvalMinimumApprovers} onChange={(e) => onChange(index, { approvalMinimumApprovers: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Frist in Stunden</Label>
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

  const borderColor = depth === 0 ? "border-border" : group.logic === "all" ? "border-primary/30" : "border-accent/50";
  const bgColor = depth === 0 ? "" : group.logic === "all" ? "bg-primary/5" : "bg-accent/10";

  return (
    <div className={cn(styles.conditionGroup, "space-y-2", borderColor, bgColor)}>
      <div className={styles.conditionTools}>
        <div className="flex flex-wrap items-center gap-2">
          {/* Logic toggle */}
          <div className={styles.segment} role="group" aria-label="Bedingungen verknüpfen">
            <button
              type="button"
              aria-pressed={group.logic === "all"}
              onClick={() => onChange({ ...group, logic: "all" })}
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
              aria-pressed={group.logic === "any"}
              onClick={() => onChange({ ...group, logic: "any" })}
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
            <EditorIconButton label={`Untergruppe auf Ebene ${depth + 1} entfernen`} onClick={onRemove} />
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
            canRemove={depth === 0 || group.conditions.length + group.groups.length > 1}
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

  const sample = useMemo(() => parseEditorSample(form.samplePayload), [form.samplePayload]);
  const parsedSamplePayload = sample.data;
  const samplePayloadParseError = sample.error;
  const semanticIssues = useMemo(() => collectSemanticIssues(form, parsedSamplePayload), [form, parsedSamplePayload]);
  const simulation = useMemo(() => evaluateEditorSample(form, parsedSamplePayload), [form, parsedSamplePayload]);
  const errors = useMemo(() => editorStepErrors(form), [form]);
  const canSave = errors.every(step => step.length === 0);
  const initialForm = useRef("");
  const wasOpen = useRef(false);
  const conditionBackup = useRef<ConditionGroup | null>(null);
  const scrollBody = useRef<HTMLDivElement>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [baseline, setBaseline] = useState("");
  useEffect(() => {
    if (open && !wasOpen.current) {
      initialForm.current = editorFormSnapshot(form);
      setBaseline(initialForm.current);
      conditionBackup.current = null;
      setCurrentStep(0);
      setDiscardOpen(false);
    }
    wasOpen.current = open;
  }, [open, form]);
  const dirty = Boolean(baseline) && baseline !== editorFormSnapshot(form);
  const goToStep = (step: number) => {
    setCurrentStep(step);
    if (step === currentStep) { scrollBody.current?.scrollTo({ top: 0 }); scrollBody.current?.querySelector<HTMLHeadingElement>("h2")?.focus({ preventScroll: true }); }
  };
  useEffect(() => { scrollBody.current?.scrollTo({ top: 0 }); scrollBody.current?.querySelector<HTMLHeadingElement>("h2")?.focus({ preventScroll: true }); }, [currentStep]);
  useEffect(() => {
    if (!open || !dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [open, dirty]);
  const withoutConditions = form.conditionGroup.conditions.length === 0 && form.conditionGroup.groups.length === 0;
  const toggleConditions = (without: boolean) => {
    if (without) {
      conditionBackup.current = structuredClone(form.conditionGroup);
      updateConditionGroup({ logic: "all", conditions: [], groups: [] });
    } else updateConditionGroup(conditionBackup.current ?? { ...DEFAULT_CONDITION_GROUP, conditions: [{ ...DEFAULT_CONDITION, field: fieldOptions[0]?.value || "status" }], groups: [] });
  };

  const applyTemplate = (templateId: string) => {
    const template = RULE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    conditionBackup.current = null;
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
      actions: template.actions.map((a) => ({ ...a, routineStepKinds: "", routineStepSettings: "" })),
      enabled: true,
      samplePayload: "",
    }));
  };

  const handleSave = async () => {
    if (canSave && !saving) await onSave();
  };

  const handleOpenChange = (val: boolean) => {
    if (!val && saving) return;
    if (!val && dirty) { setDiscardOpen(true); return; }
    onOpenChange(val);
  };

  return <TooltipProvider delayDuration={200}>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={styles.dialog} onPointerDownOutside={event => event.preventDefault()}>
        <DialogHeader className={styles.header}>
          <DialogTitle className={styles.title}>{editingRuleId ? "Regel bearbeiten" : "Neue Regel erstellen"}</DialogTitle>
          <DialogDescription className={styles.subtitle}>{form.name || "Eine Regel Schritt für Schritt einrichten"}</DialogDescription>
        </DialogHeader>
        <nav className={styles.steps} aria-label="Regel einrichten">
          {STEPS.map((step, index) => {
            const invalid = errors[index].length > 0;
            return <button type="button" key={step.label} onClick={() => goToStep(index)} aria-current={index === currentStep ? "step" : undefined} aria-label={`${step.label}${invalid ? `: ${errors[index].length} Angabe(n) fehlen` : ""}`} className={cn(styles.step, index === currentStep && styles.active, !invalid && index < currentStep && styles.done, invalid && index !== currentStep && styles.warning)}>
              <span className={styles.number}>{!invalid && index < currentStep ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}</span><span><b>{step.label}</b><small>{invalid && index !== currentStep ? "Angaben ergänzen" : step.subtitle}</small></span>
            </button>;
          })}
        </nav>
        <div className={styles.body} ref={scrollBody} aria-busy={saving || runningDryRun}>
          <fieldset className="min-w-0" disabled={saving || runningDryRun}>
            {editingRuleId && form.actions.some(action => action.type === "run_annual_routine") && <p className={`${styles.hint} mb-4 rounded-lg bg-muted p-3`}>Du bearbeitest die Vorlage für neue Pakete. Laufende Pakete behalten ihren Ablauf. Wartende Schritte lassen sich nach dem Speichern in der Jahresübersicht gezielt aktualisieren.</p>}
        {/* Step 1: Trigger wählen */}
        {currentStep === 0 && (
          <section className={styles.panel} aria-label="Auslöser konfigurieren">
            <h2 tabIndex={-1}>Wann startet die Regel?</h2>
            <div className="space-y-2">
              <Label htmlFor="rule-editor-template">Template laden (optional)</Label>
              <Select onValueChange={applyTemplate}>
                <SelectTrigger id="rule-editor-template">
                  <SelectValue placeholder="Vorlage wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TEMPLATE_GROUPS.map(group => (
                    <SelectGroup key={group.value} className="mt-2 first:mt-0">
                      <SelectLabel className="pl-2 text-muted-foreground">{group.label}</SelectLabel>
                      {group.templates.length > 0 ? group.templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      )) : (
                        <SelectItem value={`empty-${group.value}`} disabled>Keine Vorlagen vorhanden</SelectItem>
                      )}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-editor-name">Regelname *</Label>
              <Input id="rule-editor-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="z. B. Überfällige Aufgaben erinnern"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-editor-description">Beschreibung</Label>
              <Input id="rule-editor-description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Kurz erklären, wann und warum die Regel läuft"
              />
            </div>
            <div className={styles.grid2}>
            <div className="space-y-2">
              <Label htmlFor="rule-editor-module">Fachbereich</Label>
              <Select
                value={form.module}
                onValueChange={module => setForm(previous => ({ ...previous, module, triggerField: (FIELD_OPTIONS_BY_MODULE[module] ?? []).some(field => field.value === previous.triggerField) ? previous.triggerField : FIELD_OPTIONS_BY_MODULE[module]?.[0]?.value || "status" }))}
              >
                <SelectTrigger id="rule-editor-module">
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
            <div className={styles.field}><Label>Status</Label><div className={`${styles.box} ${styles.row} !p-2`}><Label htmlFor="rule-editor-enabled">Regel ist aktiv</Label><Switch id="rule-editor-enabled" checked={form.enabled} onCheckedChange={enabled => setForm(previous => ({ ...previous, enabled }))} /></div></div>
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-semibold">Auslöser</legend>
              <div className={styles.triggerOptions}>{[
                { value: "schedule", label: "Zeitgesteuert", description: "Läuft zu festen Terminen", icon: Clock },
                { value: "manual", label: "Manuell", description: "Startet auf Knopfdruck", icon: Hand },
                { value: "record_changed", label: "Datenänderung", description: "Reagiert auf Änderungen", icon: Database },
                { value: "webhook", label: "Webhook", description: "Startet durch einen externen Aufruf", icon: Webhook },
              ].map(option => <label key={option.value} className={styles.triggerOption}><input type="radio" name="rule-trigger" value={option.value} checked={form.triggerType === option.value} onChange={() => setForm(previous => ({ ...previous, triggerType: option.value }))} /><b><option.icon className="h-4 w-4" aria-hidden="true" />{option.label}</b><span>{option.description}</span></label>)}</div>
            </fieldset>

            {form.triggerType === "manual" && form.actions.some(a => a.type === "run_annual_routine") && <CalendarScheduleFields form={form} onChange={schedule => setForm(prev => ({ ...prev, schedule, actions: prev.actions.map(action => action.routineRequiresConfirmation ? { ...action, routineConfirmedYear: "" } : action) }))} />}

            {form.triggerType === "schedule" && (
              <CalendarScheduleFields form={form} onChange={schedule => setForm(prev => ({ ...prev, schedule, actions: prev.actions.map(action => action.routineRequiresConfirmation ? { ...action, routineConfirmedYear: "" } : action) }))} />
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
                <div className="space-y-2">
                  <Label htmlFor="webhook-secret">Webhook-Geheimnis *</Label>
                  <Input
                    id="webhook-secret"
                    type="password"
                    autoComplete="new-password"
                    value={form.webhookSecret ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, webhookSecret: e.target.value }))}
                    minLength={16}
                    required
                    aria-describedby="webhook-secret-help"
                    aria-invalid={(form.webhookSecret ?? "").length < 16}
                    placeholder="Mindestens 16 Zeichen"
                  />
                  <p id="webhook-secret-help" className="text-xs text-muted-foreground">
                    Mindestens 16 Zeichen. Bei jedem Aufruf als Header <code>x-webhook-secret</code> mitschicken, nicht in der URL.
                    Änderungen müssen auch im aufrufenden Dienst übernommen werden.
                  </p>
                </div>
                {editingRuleId && (
                  <div className="bg-muted rounded p-2">
                    <p className="text-xs font-medium mb-1">Webhook-URL:</p>
                    <code className="text-xs break-all select-all">
                      {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/automation-webhook?ruleId=${editingRuleId}`}
                    </code>
                    <p className="text-xs text-muted-foreground mt-1">
                      Aufrufe benötigen das Webhook-Geheimnis der Regel (mind. 16 Zeichen) im Header <code>x-webhook-secret</code>; Regeln ohne Geheimnis werden abgelehnt.
                    </p>
                  </div>
                )}
              </div>
            )}

            {!(form.triggerType === "schedule" && form.schedule && isCalendarSchedule(form.schedule)) && <div className={styles.grid2}><div className="space-y-2">
              <Label htmlFor="rule-editor-trigger-field">Trigger-Feld</Label>
              <Select
                value={form.triggerField}
                onValueChange={(v) => setForm((prev) => ({ ...prev, triggerField: v }))}
              >
                <SelectTrigger id="rule-editor-trigger-field">
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
              <Label htmlFor="rule-editor-trigger-value">Trigger-Wert {form.triggerType === "record_changed" ? "*" : ""}</Label>
              <Input id="rule-editor-trigger-value"
                value={form.triggerValue}
                onChange={(e) => setForm((prev) => ({ ...prev, triggerValue: sanitizeTriggerValue(prev.triggerType, e.target.value) }))}
                placeholder={form.triggerType === "record_changed" ? "z. B. overdue" : "z. B. 90_days"}
              />
            </div></div>}
          </section>
        )}

        {currentStep === 1 && <section className={styles.panel} aria-label="Bedingungen konfigurieren">
          <h2 tabIndex={-1}>Unter welchen Bedingungen?</h2>
          <p className={styles.lead}>Verknüpfe Bedingungen mit UND/ODER und verschachtelten Gruppen. Ohne zusätzliche Bedingungen genügt der Auslöser.</p>
          <div className={`${styles.box} ${styles.row}`}><div><p className="text-sm font-semibold">Ohne zusätzliche Bedingungen ausführen</p><p className={styles.hint}>Der Auslöser genügt. Beim Zurückschalten bleiben deine Eingaben erhalten.</p></div><Switch checked={withoutConditions} onCheckedChange={toggleConditions} aria-label="Ohne zusätzliche Bedingungen ausführen" /></div>
          {!withoutConditions && <ConditionGroupEditor group={form.conditionGroup} onChange={updateConditionGroup} fieldOptions={fieldOptions} depth={0} />}
        </section>}

        {/* Step 3: Aktionen / Approvals */}
        {currentStep === 2 && (
          <section className={styles.panel} aria-label="Aktionen und Freigaben konfigurieren">
            <div className={styles.row}><div><h2 tabIndex={-1}>Was passiert dann?</h2><p className={styles.hint}>Aktionen werden der Reihe nach verarbeitet. Schritte eines Aufgabenpakets folgen ihren eigenen Startbedingungen.</p></div><Button type="button" variant="outline" size="sm" onClick={addAction} className="gap-1"><Plus className="h-4 w-4" aria-hidden="true" />Aktion hinzufügen</Button></div>

            {form.actions.map((action, i) => (
              <ActionCard
                key={i}
                action={action}
                form={form}
                index={i}
                onChange={updateAction}
                onRemove={removeAction}
                canRemove={form.actions.length > 1}
              />
            ))}
          </section>
        )}

        {/* Step 4: Simulation */}
        {currentStep === 3 && (
          <section className={styles.panel} aria-label="Regel simulieren">
            <RoutinePreview form={form} />
            <div className="space-y-1">
              <h2 tabIndex={-1}>Regel testen</h2>
              <p className="text-xs text-muted-foreground">Füge einen Beispieldatensatz als JSON ein, um Bedingungs-Matches und Aktionen in der Vorschau zu prüfen.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-editor-sample">Beispieldatensatz (JSON)</Label>
              <textarea id="rule-editor-sample" aria-invalid={!!samplePayloadParseError}
                className="w-full min-h-36 rounded-md border bg-background px-3 py-2 text-xs font-mono"
                value={form.samplePayload}
                onChange={(e) => setForm((prev) => ({ ...prev, samplePayload: e.target.value }))}
                placeholder='{"status":"open","priority":"high"}'
              />
              <Button type="button" variant="link" size="sm" className="px-0" onClick={() => setForm(previous => ({ ...previous, samplePayload: editorSample(previous) }))}>Beispiel aus dieser Regel einfügen</Button>
              {samplePayloadParseError && <p className="text-xs text-destructive">{samplePayloadParseError}</p>}
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Echtzeit-Validierung</p>
              {semanticIssues.length === 0 ? (
                <p className="text-xs text-palette-green">Keine statischen/semantischen Probleme erkannt.</p>
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

            <div className={`${styles.box} ${styles.sunk} space-y-2`} aria-live="polite">
              <p className="text-sm font-semibold">Lokale Vorschau</p>
              {simulation ? <><p className="text-sm">Bedingungen erfüllt: <strong>{simulation.matched} von {simulation.total}</strong></p><p className={simulation.runs ? "text-sm text-primary" : "text-sm text-destructive"}>{simulation.runs ? "Die Bedingungen sind erfüllt." : "Die Bedingungen sind nicht erfüllt."}</p><p className="text-sm">Aktionen bei erfüllten Bedingungen: <strong>{simulation.runs && canSave ? form.actions.length : 0}</strong></p></> : <p className={styles.hint}>Füge einen JSON-Beispieldatensatz ein, um die Bedingungen auszuwerten.</p>}
              <p className={styles.hint}>Die Vorschau erzeugt keine Einträge und ersetzt keinen tatsächlichen Prüflauf. Der serverseitige Dry-Run verwendet die gespeicherte Regel und den eingegebenen Beispieldatensatz.</p>
              {(!editingRuleId || dirty) && <p className={styles.hint}>Für den serverseitigen Dry-Run bitte zuerst speichern und die Regel erneut öffnen.</p>}
            </div>
          </section>
        )}

          </fieldset>
          <RuleEditorSummary form={form} errors={errors} onStep={goToStep} />
        </div>
        <footer className={styles.footer}>
          <Button type="button" variant="outline" onClick={() => setCurrentStep(step => Math.max(0, step - 1))} disabled={currentStep === 0 || saving}><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />Zurück</Button>
          {dirty && <span className={styles.dirty} role="status"><i aria-hidden="true" />Ungespeicherte Änderungen</span>}
          <div className={styles.footerActions}>
            {currentStep === 3 && <Button type="button" variant="outline" onClick={() => onDryRun(parsedSamplePayload ?? undefined)} disabled={!canSave || !editingRuleId || dirty || runningDryRun || saving} title={!editingRuleId || dirty ? "Zuerst speichern und die Regel erneut öffnen" : (parsedSamplePayload ? "Gespeicherte Regel mit diesem Beispieldatensatz prüfen" : "Gespeicherte Regel mit automatisch erzeugten Beispieldaten prüfen")}>{runningDryRun ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="mr-2 h-4 w-4" aria-hidden="true" />}Dry-Run</Button>}
            {currentStep < 3 && <Button type="button" variant="outline" onClick={() => setCurrentStep(step => Math.min(3, step + 1))} disabled={saving}>Weiter<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></Button>}
            <Button type="button" onClick={handleSave} disabled={!canSave || saving || runningDryRun}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />}{editingRuleId ? "Speichern" : "Erstellen"}</Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Ungespeicherte Änderungen verwerfen?</AlertDialogTitle><AlertDialogDescription>Deine Änderungen an dieser Regel sind noch nicht gespeichert. Du kannst weiter bearbeiten oder sie verwerfen.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Weiter bearbeiten</AlertDialogCancel><AlertDialogAction onClick={() => { setDiscardOpen(false); onOpenChange(false); }}>Änderungen verwerfen</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </TooltipProvider>;
}
