import { validateRoutineWorkflow } from './routineWorkflow';
import { validateOfficeRoutine, type OfficeRoutineFields } from './officeRoutineTemplates';
import type { AutomationRuleRecordView } from "@/components/administration/automationShared";

export const SYSTEM_ROUTINES = [
  { value: "execute_reset_vacation_days", label: "Urlaubstage zurücksetzen" },
  { value: "execute_archive_sick_days", label: "Krankentage archivieren" },
  { value: "execute_expire_carry_over", label: "Resturlaub verfallen lassen" },
  { value: "generate_current_year_stats", label: "Jahresstatistik erstellen" },
] as const;

export function annualRoutineAction(rule: Pick<AutomationRuleRecordView, "actions">) {
  return rule.actions.find(action => action.type === "run_annual_routine");
}

export function routineMonth(rule: Pick<AutomationRuleRecordView, "trigger_config" | "actions">): number | null {
  if (!annualRoutineAction(rule)) return null;
  const month = Number(rule.trigger_config.month);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

export function validateAnnualRoutine(triggerType: string, schedule: { schedule_kind: string } | undefined, actions: Array<{ type: string; systemFunction?: string; taskAssignees?: string } & OfficeRoutineFields>): string | null {
  const routines = actions.filter(action => action.type === "run_annual_routine");
  if (!routines.length) return null;
  if (routines.length !== 1) return "Eine Jahresroutine pro Regel ist zulässig.";
  if (!["manual", "schedule"].includes(triggerType) || schedule?.schedule_kind !== "annual") return "Jahresroutinen benötigen einen jährlichen Stichtag oder manuelle Ausführung.";
  const routine = routines[0];
  if (routine.systemFunction && !SYSTEM_ROUTINES.some(item => item.value === routine.systemFunction)) return "Unbekannte Systemaktion.";
  if (routine.taskAssignees && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(routine.taskAssignees)) return "Eine zuständige Person auswählen.";
  return validateOfficeRoutine(routine) || validateRoutineWorkflow(routine);
}