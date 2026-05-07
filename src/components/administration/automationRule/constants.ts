import type { ActionItem, ConditionItem, ConditionGroup, FieldSpec, WizardForm } from "./types";

export const MODULE_OPTIONS = [
  { value: "tasks", label: "Aufgaben" },
  { value: "meetings", label: "Meetings" },
  { value: "decisions", label: "Entscheidungen" },
  { value: "knowledge", label: "Wissen" },
  { value: "casefiles", label: "Fallakten" },
  { value: "contacts", label: "Kontakte" },
] as const;

export const CONDITION_OPERATORS = [
  { value: "equals", label: "ist gleich" },
  { value: "not_equals", label: "ist nicht gleich" },
  { value: "contains", label: "enthält" },
  { value: "gt", label: "größer als" },
  { value: "lt", label: "kleiner als" },
] as const;

export const ACTION_TYPES = [
  { value: "create_notification", label: "Benachrichtigung erzeugen" },
  { value: "create_task", label: "Aufgabe erzeugen" },
  { value: "create_approval_request", label: "Freigabe/Approval anfordern" },
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

export const STATUS_TABLE_OPTIONS = ["tasks", "decisions", "knowledge_documents", "case_files", "contacts"] as const;
export const TASK_PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;

export const TRIGGER_TYPES = [
  { value: "record_changed", label: "Bei Datenänderung" },
  { value: "schedule", label: "Zeitgesteuert" },
  { value: "manual", label: "Manuell (Button)" },
  { value: "webhook", label: "Webhook (extern)" },
] as const;

export const FIELD_OPTIONS_BY_MODULE: Record<string, Array<{ value: string; label: string }>> = {
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

export const FIELD_SPEC_BY_MODULE: Record<string, Record<string, FieldSpec>> = {
  tasks: {
    status: { type: "enum", options: ["open", "in_progress", "done", "overdue"] },
    priority: { type: "enum", options: ["low", "medium", "high", "urgent"] },
    due_date: { type: "date" },
  },
  meetings: {
    status: { type: "enum", options: ["planned", "done", "cancelled"] },
    meeting_date: { type: "date" },
    preparation_status: { type: "enum", options: ["none", "draft", "ready"] },
  },
  decisions: {
    status: { type: "enum", options: ["draft", "accepted", "rejected"] },
    deadline: { type: "date" },
  },
  knowledge: {
    status: { type: "enum", options: ["draft", "published", "review"] },
    updated_at: { type: "date" },
  },
  casefiles: {
    status: { type: "enum", options: ["open", "in_review", "closed"] },
    priority: { type: "enum", options: ["low", "medium", "high", "critical"] },
    processing_status: { type: "enum", options: ["new", "processing", "blocked", "completed"] },
  },
  contacts: {
    status: { type: "enum", options: ["active", "inactive", "archived"] },
    category: { type: "string" },
    updated_at: { type: "date" },
  },
};

// Used by templates before full DEFAULT_ACTION is defined
const DEFAULT_ACTION_INIT = {
  targetUserId: "", title: "", message: "", taskPriority: "medium", taskCategory: "personal",
  taskDueDate: "", taskAssignees: "", table: "tasks", recordId: "", status: "",
  emailTemplateId: "", emailRecipient: "", emailRecipientName: "",
  approvalPolicy: "single", approvalDueInHours: "24", approvalMinimumApprovers: "1",
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
  {
    id: "four-eyes-approval",
    name: "4-Augen-Freigabe",
    description: "Bei kritischen Änderungen wird eine Freigabe von mindestens zwei Personen angefordert.",
    module: "casefiles",
    triggerType: "record_changed",
    triggerField: "priority",
    triggerValue: "critical",
    conditions: [{ field: "status", operator: "not_equals", value: "closed" }],
    actions: [{ ...DEFAULT_ACTION_INIT, type: "create_approval_request", title: "Kritische Änderung freigeben", message: "Bitte 4-Augen-Freigabe durchführen.", approvalPolicy: "four_eyes", approvalMinimumApprovers: "2", approvalDueInHours: "24", table: "case_files" }],
  },
  {
    id: "deadline-based-escalation",
    name: "Fristbasierte Eskalation",
    description: "Wenn der Termin naht und der Status nicht erledigt ist, wird automatisch eskaliert.",
    module: "tasks",
    triggerType: "schedule",
    triggerField: "due_date",
    triggerValue: "24_hours_before",
    conditions: [{ field: "status", operator: "not_equals", value: "done" }],
    actions: [{ ...DEFAULT_ACTION_INIT, type: "create_notification", title: "Frist-Eskalation", message: "Eine Aufgabe nähert sich der Deadline und ist noch nicht erledigt.", table: "tasks" }],
  },
  {
    id: "auto-assignment",
    name: "Auto-Zuweisung",
    description: "Neue Datensätze werden automatisch der zuständigen Person zugewiesen.",
    module: "tasks",
    triggerType: "record_changed",
    triggerField: "status",
    triggerValue: "open",
    conditions: [{ field: "priority", operator: "equals", value: "high" }],
    actions: [{ ...DEFAULT_ACTION_INIT, type: "create_task", title: "Auto-Zuweisung prüfen", message: "Datensatz wurde automatisch zugewiesen.", taskPriority: "high", table: "tasks" }],
  },
] as const;

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
  approvalPolicy: "single",
  approvalDueInHours: "24",
  approvalMinimumApprovers: "1",
};

export const DEFAULT_CONDITION: ConditionItem = {
  field: "status",
  operator: "equals",
  value: "",
};

export const DEFAULT_CONDITION_GROUP: ConditionGroup = {
  logic: "all",
  conditions: [{ ...DEFAULT_CONDITION }],
  groups: [],
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
  conditionGroup: { ...DEFAULT_CONDITION_GROUP },
  actions: [{ ...DEFAULT_ACTION }],
  enabled: true,
  samplePayload: "",
};
