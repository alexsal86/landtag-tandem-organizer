import type { ActionItem, ConditionGroup, WizardForm } from './types';
import { AUTOMATION_FIELD_SPECS, isAutomationDate } from '@/features/automation/conditions';
import { isCalendarSchedule, validateCalendarSchedule } from '@/features/automation/calendarSchedule';
import { SYSTEM_ROUTINES, validateAnnualRoutine } from '@/features/automation/annualRoutines';
import { routineStepKinds } from '@/features/automation/officeRoutineTemplates';
import { draftStepSettings, validateRoutineWorkflow } from '@/features/automation/routineWorkflow';

export interface RuleIssue { step: 0 | 1 | 2 | 3; field: string; level: 'error' | 'warning'; message: string }
export function parseEditorSample(value: string): { data: Record<string,unknown> | null; error: string | null } {
  if (!value.trim()) return { data:null,error:null };
  try {
    const data: unknown = JSON.parse(value);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { data:null,error:'Der Beispieldatensatz muss ein JSON-Objekt sein, keine Liste und kein einzelner Wert.' };
    return { data:data as Record<string,unknown>,error:null };
  } catch { return { data:null,error:'Ungültiges JSON. Bitte Klammern und Anführungszeichen prüfen.' }; }
}
export function validateRuleEditor(form: WizardForm): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const add = (step: RuleIssue['step'],field: string,message: string,level: RuleIssue['level'] = 'error') => {
    if (!issues.some(issue => issue.field === field && issue.message === message)) issues.push({ step,field,message,level });
  };
  const required = (step: RuleIssue['step'],field: string,value: string | undefined,message: string) => { if (!value?.trim()) add(step,field,message); };
  required(0,'name',form.name,'Bitte einen Regelnamen eingeben.');
  required(0,'module',form.module,'Bitte einen Fachbereich auswählen.');
  required(0,'triggerType',form.triggerType,'Bitte einen Auslöser auswählen.');
  if (form.triggerType === 'record_changed') {
    required(0,'triggerField',form.triggerField,'Bitte das auslösende Feld auswählen.');
    required(0,'triggerValue',form.triggerValue,'Bitte den auslösenden Wert eingeben.');
  }
  if (form.triggerType === 'webhook' && (form.webhookSecret ?? '').length < 16) add(0,'webhookSecret','Das Webhook-Geheimnis muss mindestens 16 Zeichen enthalten.');
  const routines = form.actions.map((action,index) => ({ action,index })).filter(item => item.action.type === 'run_annual_routine');
  if (form.triggerType === 'schedule' || (form.triggerType === 'manual' && routines.length)) {
    const schedule = form.schedule;
    if (!schedule) add(0,'schedule.schedule_kind','Bitte einen Zeitplan auswählen.');
    else if (isCalendarSchedule(schedule)) {
      if (schedule.timezone !== 'Europe/Berlin') add(0,'schedule.timezone','Die Zeitzone muss Europe/Berlin sein.');
      if (!schedule.hour.trim() || !Number.isInteger(Number(schedule.hour)) || Number(schedule.hour) < 0 || Number(schedule.hour) > 23) add(0,'schedule.hour','Bitte eine volle Stunde zwischen 00:00 und 23:00 auswählen.');
      if (!schedule.day.trim() || !Number.isInteger(Number(schedule.day)) || Number(schedule.day) < 1 || Number(schedule.day) > 31) add(0,'schedule.day','Bitte einen Tag zwischen 1 und 31 eingeben.');
      if (schedule.schedule_kind === 'annual' && (!Number.isInteger(Number(schedule.month)) || Number(schedule.month) < 1 || Number(schedule.month) > 12)) add(0,'schedule.month','Bitte einen Monat auswählen.');
      const error = validateCalendarSchedule(schedule);
      if (error && !issues.some(issue => issue.field.startsWith('schedule.'))) add(0,'schedule.day',error);
    } else if (!Number.isFinite(Number(schedule.minutes_interval)) || Number(schedule.minutes_interval) < 60) add(0,'schedule.minutes_interval','Das Minutenintervall muss mindestens 60 Minuten betragen.');
  }
  const specs = AUTOMATION_FIELD_SPECS[form.module] ?? {};
  const group = (node: ConditionGroup,path: string,root = false) => {
    if (!root && !node.conditions.length && !node.groups.length) add(1,path,'Diese Untergruppe ist leer. Bitte eine Bedingung hinzufügen oder die Gruppe entfernen.');
    node.conditions.forEach((condition,index) => {
      const prefix = `${path}.conditions.${index}`;
      required(1,`${prefix}.field`,condition.field,'Bitte ein Feld auswählen.');
      required(1,`${prefix}.value`,condition.value,'Bitte den Vergleichswert eingeben.');
      if (!['equals','not_equals','contains','gt','lt'].includes(condition.operator)) add(1,`${prefix}.operator`,'Bitte einen gültigen Operator auswählen.');
      const spec = specs[condition.field];
      if (!spec) { if (condition.field) add(1,`${prefix}.field`,'Dieses Feld ist für den Fachbereich nicht bekannt. Die bestehende Feldzuordnung bleibt erhalten.','warning'); return; }
      if (['gt','lt'].includes(condition.operator) && !['number','date'].includes(spec.type)) add(1,`${prefix}.operator`,'Größer/kleiner ist nur für Zahlen- oder Datumsfelder möglich.');
      if (!condition.value.trim()) return;
      if (spec.type === 'date' && condition.operator !== 'contains' && !isAutomationDate(condition.value)) add(1,`${prefix}.value`,'Bitte ein gültiges Datum als JJJJ-MM-TT oder einen ISO-Zeitstempel mit Zeitzone eingeben.');
      if (spec.type === 'number' && !Number.isFinite(Number(condition.value))) add(1,`${prefix}.value`,'Bitte eine gültige Zahl eingeben.');
      if (spec.type === 'enum' && spec.options && !spec.options.includes(condition.value)) add(1,`${prefix}.value`,`Bekannte Werte: ${spec.options.join(', ')}. Andere Werte bleiben möglich.`,'warning');
    });
    node.groups.forEach((nested,index) => group(nested,`${path}.groups.${index}`));
  };
  group(form.conditionGroup,'conditionGroup',true);
  if (!form.actions.length) add(2,'actions','Bitte mindestens eine Aktion hinzufügen.');
  form.actions.forEach((action,index) => {
    const prefix = `actions.${index}`;
    if (['create_notification','send_push_notification','create_approval_request'].includes(action.type)) required(2,`${prefix}.targetUserId`,action.targetUserId,'Bitte eine empfangende oder freigebende Person auswählen.');
    if (['create_task','run_annual_routine'].includes(action.type)) required(2,`${prefix}.title`,action.title,'Bitte einen Titel eingeben.');
    if (action.type === 'create_task' && action.taskDueDate.trim() && !isAutomationDate(action.taskDueDate)) add(2,`${prefix}.taskDueDate`,'Bitte ein Datum als JJJJ-MM-TT oder einen ISO-Zeitstempel mit Zeitzone eingeben.');
    if (action.type === 'update_record_status') {
      required(2,`${prefix}.table`,action.table,'Bitte die Zieltabelle auswählen.');
      required(2,`${prefix}.recordId`,action.recordId,'Bitte die Datensatz-ID eingeben.');
      required(2,`${prefix}.status`,action.status,'Bitte den Zielstatus eingeben.');
    }
    if (action.type === 'send_email_template') {
      required(2,`${prefix}.emailTemplateId`,action.emailTemplateId,'Bitte eine E-Mail-Vorlage auswählen.');
      if (!action.emailRecipient.trim() || !action.emailRecipient.includes('@')) add(2,`${prefix}.emailRecipient`,'Bitte eine Empfänger-E-Mail mit @ eingeben.');
    }
    if (action.type === 'create_approval_request') {
      const minimum = action.approvalPolicy === 'four_eyes' ? 2 : 1;
      if (!Number.isInteger(Number(action.approvalMinimumApprovers)) || Number(action.approvalMinimumApprovers) < minimum) add(2,`${prefix}.approvalMinimumApprovers`,`Bitte mindestens ${minimum} ${minimum === 1 ? 'Freigabe' : 'Freigaben'} vorsehen.`);
      if (!Number.isFinite(Number(action.approvalDueInHours)) || Number(action.approvalDueInHours) <= 0) add(2,`${prefix}.approvalDueInHours`,'Bitte eine Frist größer als 0 Stunden eingeben.');
    }
    if (action.type !== 'run_annual_routine') return;
    if (action.taskAssignees && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(action.taskAssignees)) add(2,`${prefix}.taskAssignees`,'Bitte eine zuständige Person auswählen.');
    if (routines.length > 1) add(2,`${prefix}.type`,'Pro Regel ist nur eine Jahresroutine möglich.');
    if (!['manual','schedule'].includes(form.triggerType)) add(0,'triggerType','Jahresroutinen benötigen einen manuellen oder zeitgesteuerten Auslöser.');
    if (form.schedule?.schedule_kind !== 'annual') add(0,'schedule.schedule_kind','Bitte für diese Jahresroutine einen jährlichen Stichtag wählen.');
    if (action.systemFunction && !SYSTEM_ROUTINES.some(item => item.value === action.systemFunction)) add(2,`${prefix}.systemFunction`,'Bitte eine bekannte Systemroutine auswählen.');
    validatePackage(action,prefix,add);
  });
  const routineError = validateAnnualRoutine(form.triggerType,form.schedule,form.actions);
  if (routineError && routines.length && !issues.some(issue => issue.level === 'error' && (issue.field.startsWith(`actions.${routines[0].index}.`) || issue.field.startsWith('schedule.') || issue.field === 'triggerType'))) add(2,`actions.${routines[0].index}.type`,routineError);
  const sample = parseEditorSample(form.samplePayload);
  if (sample.error) add(3,'samplePayload',sample.error);
  return issues;
}
function validatePackage(action: ActionItem,prefix: string,add: (step: RuleIssue['step'],field: string,message: string,level?: RuleIssue['level']) => void) {
  if (action.systemFunction) return;
  const lines = (action.routineSteps ?? '').split('\n').filter(line => line.trim());
  const hasPackage = Boolean(action.routineDeadlineMonth || action.routineDeadlineDay || lines.length || action.routineRequiresConfirmation);
  if (hasPackage) {
    if (!Number.isInteger(Number(action.routineDeadlineMonth)) || Number(action.routineDeadlineMonth) < 1 || Number(action.routineDeadlineMonth) > 12) add(2,`${prefix}.routineDeadlineMonth`,'Bitte den Abschlussmonat auswählen.');
    if (!Number.isInteger(Number(action.routineDeadlineDay)) || Number(action.routineDeadlineDay) < 1 || Number(action.routineDeadlineDay) > 31) add(2,`${prefix}.routineDeadlineDay`,'Bitte den Abschlusstag zwischen 1 und 31 eingeben.');
  }
  if (lines.length > 20) add(2,`${prefix}.routineSteps`,'Maximal 20 Arbeitsschritte sind möglich.');
  const settings = draftStepSettings(action.routineStepSettings,lines.length);
  lines.forEach((line,index) => {
    const position = line.indexOf('|');
    const days = position < 0 ? '' : line.slice(0,position).trim();
    const title = position < 0 ? line.trim() : line.slice(position + 1).trim();
    const step = `${prefix}.routineSteps.${index}`;
    if (!/^\d{1,3}$/.test(days) || Number(days) > 365) add(2,`${step}.days`,'Bitte einen Vorlauf zwischen 0 und 365 Tagen eingeben.');
    if (!title || title.length > 500) add(2,`${step}.title`,'Bitte einen Arbeitsschritt mit 1 bis 500 Zeichen eingeben.');
    if (settings[index].release === 'after_approval' && !settings[index].approver) add(2,`${step}.approver`,'Bitte die freigebende Person auswählen.');
    if (settings[index].release === 'after_previous' && index === 0) add(2,`${step}.release`,'Der erste Schritt kann nicht auf einen Vorgänger warten.');
  });
  try { routineStepKinds(action.routineStepKinds,lines.length); } catch { add(2,`${prefix}.routineSteps`,'Bitte die Aktionstypen der Arbeitsschritte prüfen.'); }
  const workflow = validateRoutineWorkflow(action);
  if (workflow && !settings.some(setting => setting.release === 'after_approval' && !setting.approver)) add(2,`${prefix}.routineSteps`,workflow);
}
