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
import { ArrowLeft, ArrowRight, Check, Clock, Filter, Loader2, Play, Plus, Save, Trash2, Zap } from "lucide-react";

const MODULE_OPTIONS = [
  { value: "tasks", label: "Aufgaben" },
  { value: "meetings", label: "Meetings" },
  { value: "decisions", label: "Entscheidungen" },
  { value: "knowledge", label: "Wissen" },
  { value: "casefiles", label: "Fallakten" },
  { value: "contacts", label: "Kontakte" },
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
  { value: "send_email_template", label: "E-Mail-Template senden" },
] as const;

/** Maps logical module names to actual DB table names */
export const MODULE_TO_TABLE: Record<string, string> = {
  tasks: "tasks",
  meetings: "appointments",
  decisions: "decisions",
  knowledge: "knowledge_documents",
  casefiles: "case_files",
  contacts: "contacts",
};

const STATUS_TABLE_OPTIONS = ["tasks", "decisions", "knowledge_documents", "case_files", "contacts"] as const;
const TASK_PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;

const TRIGGER_TYPES = [
  { value: "record_changed", label: "Bei Datenänderung" },
  { value: "schedule", label: "Zeitgesteuert" },
  { value: "manual", label: "Manuell (Button)" },
  { value: "webhook", label: "Webhook (extern)" },
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
    { value: "processing_status", label: "Bearbeitungsstatus" },
  ],
  contacts: [
    { value: "status", label: "Status" },
    { value: "category", label: "Kategorie" },
    { value: "updated_at", label: "Aktualisiert am" },
  ],
};

// Used by templates before full DEFAULT_ACTION is defined
const DEFAULT_ACTION_INIT = {
  targetUserId: "", title: "", message: "", taskPriority: "medium", taskCategory: "personal",
  taskDueDate: "", taskAssignees: "", table: "tasks", recordId: "", status: "",
  emailTemplateId: "", emailRecipient: "", emailRecipientName: "",
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
    conditions: [{ field: "priority", operator: "equals", value: "high" }],
    actions: [{ ...DEFAULT_ACTION_INIT, type: "create_notification", title: "Überfällige Aufgabe", message: "Eine priorisierte Aufgabe ist überfällig.", table: "tasks" }],
  },
  {
    id: "knowledge-review",
    name: "Wissensartikel Review anstoßen",
    description: "Markiert alte Wissensartikel zur Überprüfung.",
    module: "knowledge",
    triggerType: "schedule",
    triggerField: "updated_at",
    triggerValue: "90_days",
    conditions: [{ field: "status", operator: "equals", value: "published" }],
    actions: [{ ...DEFAULT_ACTION_INIT, type: "update_record_status", table: "knowledge_documents", status: "review" }],
  },
  {
    id: "meeting-reminder-48h",
    name: "Meeting in 48h ohne Vorbereitung",
    description: "Erinnert den Termin-Verantwortlichen, wenn ein Meeting in 48 Stunden stattfindet und noch keine Vorbereitung erstellt wurde.",
    module: "meetings",
    triggerType: "schedule",
    triggerField: "start_time",
    triggerValue: "48_hours_before",
    conditions: [{ field: "has_preparation", operator: "equals", value: "false" }],
    actions: [{ ...DEFAULT_ACTION_INIT, type: "create_notification", title: "Meeting-Vorbereitung fehlt", message: "Ihr Meeting findet in 48 Stunden statt, aber es wurde noch keine Vorbereitung erstellt.", table: "appointments" }],
  },
  {
    id: "decision-accepted-task",
    name: "Entscheidung angenommen → Folge-Task",
    description: "Erstellt automatisch eine Folge-Aufgabe, wenn eine Entscheidung den Status 'angenommen' erhält.",
    module: "decisions",
    triggerType: "record_changed",
    triggerField: "status",
    triggerValue: "accepted",
    conditions: [{ field: "assigned_to", operator: "not_equals", value: "" }],
    actions: [{ ...DEFAULT_ACTION_INIT, type: "create_task", title: "Umsetzung: Entscheidung umsetzen", message: "Bitte die angenommene Entscheidung umsetzen.", table: "decisions" }],
  },
  {
    id: "casefile-critical-alert",
    name: "Vorgang auf kritisch gesetzt",
    description: "Benachrichtigt sofort alle Beteiligten, wenn ein Vorgang den Status 'kritisch' erhält.",
    module: "casefiles",
    triggerType: "record_changed",
    triggerField: "priority",
    triggerValue: "critical",
    conditions: [{ field: "status", operator: "not_equals", value: "closed" }],
    actions: [{ ...DEFAULT_ACTION_INIT, type: "create_notification", title: "Kritischer Vorgang", message: "Ein Vorgang wurde als kritisch eingestuft und erfordert sofortige Aufmerksamkeit.", table: "case_files" }],
  },
  // --- New templates ---
  {
    id: "contact-inactive-reminder",
    name: "Kontakt ohne Aktivität → Erinnerung",
    description: "Erinnert an Kontakte, die seit über 30 Tagen nicht aktualisiert wurden.",
    module: "contacts",
    triggerType: "schedule",
    triggerField: "updated_at",
    triggerValue: "30_days",
    conditions: [{ field: "status", operator: "not_equals", value: "archived" }],
    actions: [{ ...DEFAULT_ACTION_INIT, type: "create_notification", title: "Inaktiver Kontakt", message: "Ein Kontakt wurde seit 30 Tagen nicht mehr bearbeitet.", table: "contacts" }],
  },
  {
    id: "casefile-closed-archive",
    name: "Fallakte abgeschlossen → Archivierungs-Task",
    description: "Erstellt automatisch eine Archivierungs-Aufgabe, wenn eine Fallakte auf 'abgeschlossen' gesetzt wird.",
    module: "casefiles",
    triggerType: "record_changed",
    triggerField: "status",
    triggerValue: "closed",
    conditions: [{ field: "priority", operator: "not_equals", value: "critical" }],
    actions: [{ ...DEFAULT_ACTION_INIT, type: "create_task", title: "Fallakte archivieren", message: "Bitte die abgeschlossene Fallakte prüfen und archivieren.", taskPriority: "low", table: "case_files" }],
  },
  {
    id: "knowledge-created-review-task",
    name: "Neuer Wissensartikel → Review-Aufgabe",
    description: "Erstellt eine Review-Aufgabe, wenn ein neuer Wissensartikel erstellt wird.",
    module: "knowledge",
    triggerType: "record_changed",
    triggerField: "status",
    triggerValue: "draft",
    conditions: [{ field: "status", operator: "equals", value: "draft" }],
    actions: [{ ...DEFAULT_ACTION_INIT, type: "create_task", title: "Wissensartikel reviewen", message: "Ein neuer Wissensartikel wartet auf Review.", taskPriority: "medium", table: "knowledge_documents" }],
  },
  {
    id: "task-high-priority-push",
    name: "Aufgabe mit hoher Priorität → Push",
    description: "Sendet eine Push-Benachrichtigung, wenn eine Aufgabe auf 'urgent' gesetzt wird.",
    module: "tasks",
    triggerType: "record_changed",
    triggerField: "priority",
    triggerValue: "urgent",
    conditions: [{ field: "status", operator: "not_equals", value: "done" }],
    actions: [{ ...DEFAULT_ACTION_INIT, type: "send_push_notification", title: "Dringende Aufgabe", message: "Eine Aufgabe wurde als dringend markiert und erfordert sofortige Bearbeitung.", table: "tasks" }],
  },
  {
    id: "casefile-new-participant-notify",
    name: "Neue Fallakte → Team benachrichtigen",
    description: "Benachrichtigt das Team, wenn eine neue Fallakte mit hoher Priorität angelegt wird.",
    module: "casefiles",
    triggerType: "record_changed",
    triggerField: "status",
    triggerValue: "open",
    conditions: [{ field: "priority", operator: "equals", value: "high" }],
    actions: [{ ...DEFAULT_ACTION_INIT, type: "create_notification", title: "Neue wichtige Fallakte", message: "Eine neue Fallakte mit hoher Priorität wurde angelegt.", table: "case_files" }],
  },
] as const;

export type ConditionItem = {
  field: string;
  operator: string;
  value: string;
};

export type ActionItem = {
  type: string;
  targetUserId: string;
  title: string;
  message: string;
  taskPriority: string;
  taskCategory: string;
  taskDueDate: string;
  taskAssignees: string;
  table: string;
  recordId: string;
  status: string;
  emailTemplateId: string;
  emailRecipient: string;
  emailRecipientName: string;
};

export const DEFAULT_ACTION: ActionItem = {
  type: "create_notification",
  targetUserId: "",
  title: "",
  message: "",
  taskPriority: "medium",
  taskCategory: "personal",
  taskDueDate: "",
  taskAssignees: "",
  table: "tasks",
  recordId: "",
  status: "",
  emailTemplateId: "",
  emailRecipient: "",
  emailRecipientName: "",
};

export const DEFAULT_CONDITION: ConditionItem = {
  field: "status",
  operator: "equals",
  value: "",
};

export type WizardForm = {
  name: string;
  description: string;
  module: string;
  triggerType: string;
  triggerField: string;
  triggerValue: string;
  conditionLogic: "all" | "any";
  conditions: ConditionItem[];
  actions: ActionItem[];
  enabled: boolean;
};

export const DEFAULT_FORM: WizardForm = {
  name: "",
  description: "",
  module: "tasks",
  triggerType: "record_changed",
  triggerField: "status",
  triggerValue: "",
  conditionLogic: "all",
  conditions: [{ ...DEFAULT_CONDITION }],
  actions: [{ ...DEFAULT_ACTION }],
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

  const updateCondition = (index: number, patch: Partial<ConditionItem>) => {
    setForm((prev) => {
      const next = [...prev.conditions];
      next[index] = { ...next[index], ...patch };
      return { ...prev, conditions: next };
    });
  };

  const addCondition = () => {
    setForm((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { ...DEFAULT_CONDITION, field: fieldOptions[0]?.value || "status" }],
    }));
  };

  const removeCondition = (index: number) => {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
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

  const stepValid = useMemo(() => {
    switch (currentStep) {
      case 0:
        return form.name.trim().length >= 3;
      case 1:
        return form.triggerType === "schedule" || form.triggerType === "manual" || form.triggerValue.trim().length > 0;
      case 2:
        return form.conditions.length > 0 && form.conditions.every((c) => c.value.trim().length > 0);
      case 3: {
        return form.actions.length > 0 && form.actions.every((a) => {
          const isNotif = a.type === "create_notification" || a.type === "send_push_notification";
          const isStat = a.type === "update_record_status";
          const isTask = a.type === "create_task";
          const isEmail = a.type === "send_email_template";
          if (isNotif) return a.targetUserId.trim().length > 0;
          if (isStat) return a.recordId.trim().length > 0 && a.status.trim().length > 0;
          if (isTask) return a.title.trim().length > 0;
          if (isEmail) return a.emailTemplateId.trim().length > 0 && a.emailRecipient.trim().length > 0;
          return true;
        });
      }
      default:
        return true;
    }
  }, [currentStep, form]);

  const applyTemplate = (templateId: string) => {
    const template = RULE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
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
    const trigger = TRIGGER_TYPES.find((t) => t.value === form.triggerType)?.label || form.triggerType;
    return { mod, trigger };
  }, [form.module, form.triggerType]);

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

            <div className="space-y-2">
              <Label>Trigger-Wert {form.triggerType === "record_changed" ? "*" : ""}</Label>
              <Input
                value={form.triggerValue}
                onChange={(e) => setForm((prev) => ({ ...prev, triggerValue: e.target.value }))}
                placeholder={form.triggerType === "record_changed" ? "z. B. overdue" : "z. B. 90_days"}
              />
            </div>
          </div>
        )}

        {/* Step 3: Bedingungen (multi) with AND/OR toggle */}
        {currentStep === 2 && (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Bedingungen</p>
                <p className="text-xs text-muted-foreground">
                  {form.conditionLogic === "all"
                    ? "Alle Bedingungen müssen erfüllt sein (UND-Verknüpfung)."
                    : "Mindestens eine Bedingung muss erfüllt sein (ODER-Verknüpfung)."}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={addCondition} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Bedingung
              </Button>
            </div>

            {/* AND/OR Toggle */}
            <div className="flex items-center gap-2 rounded-md border p-2">
              <span className="text-xs font-medium text-muted-foreground">Verknüpfung:</span>
              <div className="flex rounded-md border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, conditionLogic: "all" }))}
                  className={cn(
                    "px-3 py-1 text-xs font-medium transition-colors",
                    form.conditionLogic === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  UND
                </button>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, conditionLogic: "any" }))}
                  className={cn(
                    "px-3 py-1 text-xs font-medium transition-colors",
                    form.conditionLogic === "any"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  ODER
                </button>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {form.conditionLogic === "all" ? "Alle müssen zutreffen" : "Mindestens eine"}
              </Badge>
            </div>

            {form.conditions.map((condition, i) => (
              <div key={i}>
                {i > 0 && (
                  <div className="flex items-center justify-center py-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {form.conditionLogic === "all" ? "UND" : "ODER"}
                    </Badge>
                  </div>
                )}
                <ConditionCard
                  condition={condition}
                  index={i}
                  fieldOptions={fieldOptions}
                  onChange={updateCondition}
                  onRemove={removeCondition}
                  canRemove={form.conditions.length > 1}
                />
              </div>
            ))}
          </div>
        )}

        {/* Step 4: Aktionen (multi) + Zusammenfassung */}
        {currentStep === 3 && (
          <div className="space-y-4 py-2">
            {/* Summary card */}
            <div className="rounded-md border bg-muted/30 p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Zusammenfassung</p>
              <p className="text-sm">
                <Badge variant="outline" className="mr-1">{summaryLine.mod}</Badge>
                Wenn <span className="font-medium">{form.triggerField}</span> = „{form.triggerValue || "—"}"
              </p>
              <p className="text-sm text-muted-foreground">
                {form.conditions.length} Bedingung{form.conditions.length !== 1 ? "en" : ""} ({form.conditionLogic === "all" ? "UND" : "ODER"}) · {form.actions.length} Aktion{form.actions.length !== 1 ? "en" : ""}
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
