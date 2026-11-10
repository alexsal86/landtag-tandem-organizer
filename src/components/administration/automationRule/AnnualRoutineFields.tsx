import { FieldIssue, useRuleValidation } from './RuleValidationContext';
import { useId } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TenantUserSelect } from '../TenantUserSelect';
import { SYSTEM_ROUTINES } from '@/features/automation/annualRoutines';
import { annualDueDay } from '@/features/timetracking/annualTaskRules';
import { officeRoutineDeadline } from '@/features/automation/officeRoutineTemplates';
import { RoutineStepsEditor } from './RoutineStepsEditor';
import { ROUTINE_CATEGORIES } from './constants';
import { EDITOR_MONTHS } from './CalendarScheduleFields';
import { editorPlanYear } from './editorModel';
import type { ActionItem, WizardForm } from './types';
import styles from './RuleEditor.module.css';

export function AnnualRoutineFields({ action, form, prefix, onChange }: { prefix: string; action: ActionItem; form: WizardForm; onChange: (patch: Partial<ActionItem>) => void }) {
  const id = useId();
  const validation = useRuleValidation();
  const field = (name: string) => validation.field(`${prefix}.${name}`);
  const currentYear = new Intl.DateTimeFormat('en', { timeZone:'Europe/Berlin', year:'numeric' }).format(new Date());
  let dates: { start: string; finish: string } | undefined;
  try {
    if (form.schedule?.schedule_kind === 'annual' && action.routineDeadlineMonth && action.routineDeadlineDay) {
      const start = annualDueDay({ due_month:Number(form.schedule.month), due_day:form.schedule.month_end === 'true' ? null : Number(form.schedule.day) },editorPlanYear(form));
      dates = { start, finish:officeRoutineDeadline({ routine_deadline_month:action.routineDeadlineMonth, routine_deadline_day:action.routineDeadlineDay },start) };
    }
  } catch { /* Incomplete date fields remain editable. */ }
  return <div className="space-y-4">
    <div className={styles.field}><Label htmlFor={`${id}-routine`}>Routine</Label><Select value={action.systemFunction || 'office'} disabled={Boolean(action.annualTaskId && action.systemFunction)} onValueChange={value => onChange({ systemFunction:value === 'office' ? '' : value, ...(value !== 'office' ? { officeTemplateId:'',routineDeadlineMonth:'',routineDeadlineDay:'',routineSteps:'',routineStepKinds:'',routineStepSettings:'',routineRequiresConfirmation:false,routineConfirmedYear:'' } : {}) })}><SelectTrigger {...field("systemFunction")} id={`${id}-routine`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="office">Büroaufgabe übergeben</SelectItem>{SYSTEM_ROUTINES.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select><FieldIssue name={`${prefix}.systemFunction`} /></div>
    <div className={styles.field}><Label htmlFor={`${id}-title`}>Titel der Jahresaufgabe *</Label><Input {...field("title")} id={`${id}-title`} value={action.title} onChange={event => onChange({ title:event.target.value })} /><FieldIssue name={`${prefix}.title`} /></div>
    <div className={styles.field}><Label htmlFor={`${id}-description`}>Beschreibung</Label><Textarea id={`${id}-description`} value={action.message} onChange={event => onChange({ message:event.target.value })} /></div>
    <div className={styles.grid2}>
      <div className={styles.field}><Label htmlFor={`${id}-category`}>Kategorie</Label><Select value={action.routineCategory || 'admin'} onValueChange={routineCategory => onChange({ routineCategory })}><SelectTrigger {...field("routineCategory")} id={`${id}-category`}><SelectValue /></SelectTrigger><SelectContent>{ROUTINE_CATEGORIES.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select><FieldIssue name={`${prefix}.routineCategory`} /></div>
      {!action.systemFunction && <div className={styles.field}><Label>Zuständige Person</Label><TenantUserSelect validationField={`${prefix}.taskAssignees`} value={action.taskAssignees} onValueChange={taskAssignees => onChange({ taskAssignees })} placeholder="Büroleitung (Standard)" /><FieldIssue name={`${prefix}.taskAssignees`} /></div>}
    </div>
    {!action.systemFunction && <>
      <section className={`${styles.box} space-y-4`} aria-label="Aufgabenpaket und Abschluss">
        <div><h3 className="text-base font-semibold">Aufgabenpaket und Abschluss</h3><p className={styles.hint}>Der Zeitplan startet die Planung. Der Abschluss kann auch im Folgejahr liegen. Änderungen gelten für neue Pakete; wartende Schritte laufender Pakete können ausdrücklich in der Jahresübersicht aktualisiert werden.</p></div>
        <div className={styles.grid2}><div className={styles.field}><Label htmlFor={`${id}-month`}>Abschlussmonat</Label><Select value={action.routineDeadlineMonth || 'none'} onValueChange={value => onChange({ routineDeadlineMonth:value === 'none' ? '' : value,routineConfirmedYear:'' })}><SelectTrigger {...field("routineDeadlineMonth")} id={`${id}-month`}><SelectValue placeholder="Monat wählen" /></SelectTrigger><SelectContent><SelectItem value="none">Kein Abschlussmonat</SelectItem>{EDITOR_MONTHS.map((month,index) => <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>)}</SelectContent></Select><FieldIssue name={`${prefix}.routineDeadlineMonth`} /></div><div className={styles.field}><Label htmlFor={`${id}-day`}>Abschlusstag</Label><Input {...field("routineDeadlineDay")} id={`${id}-day`} type="number" min={1} max={31} value={action.routineDeadlineDay || ''} onChange={event => onChange({ routineDeadlineDay:event.target.value,routineConfirmedYear:'' })} /><FieldIssue name={`${prefix}.routineDeadlineDay`} /></div></div>
        <RoutineStepsEditor prefix={prefix} value={action.routineSteps || ''} kinds={action.routineStepKinds} settings={action.routineStepSettings} dates={dates} onChange={(routineSteps,routineStepKinds,routineStepSettings) => onChange({ routineSteps,routineStepKinds,routineStepSettings,routineConfirmedYear:'' })} />
      </section>
      <div className={`${styles.box} space-y-3`}><div className={styles.row}><div><Label htmlFor={`${id}-confirm`}>Termine jährlich bestätigen</Label><p className={styles.hint}>Ohne Jahresbestätigung wartet die Ausführung.</p></div><Switch id={`${id}-confirm`} checked={Boolean(action.routineRequiresConfirmation)} onCheckedChange={routineRequiresConfirmation => onChange({ routineRequiresConfirmation,routineConfirmedYear:'' })} /></div>
        {action.routineRequiresConfirmation && editorPlanYear(form) > Number(currentYear) && <p className={styles.hint}>Die Bestätigung gilt ausschließlich für {currentYear}. Für den nächsten automatischen Start in {editorPlanYear(form)} müssen die Termine in diesem Jahr erneut bestätigt werden.</p>}
        {action.routineRequiresConfirmation && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={action.routineConfirmedYear === currentYear} onChange={event => onChange({ routineConfirmedYear:event.target.checked ? currentYear : '' })} /><span>Ich habe Planungsbeginn und Abschluss mit dem tatsächlichen Zeitplan für {currentYear} abgeglichen.</span></label>}
      </div>
    </>}
  </div>;
}
