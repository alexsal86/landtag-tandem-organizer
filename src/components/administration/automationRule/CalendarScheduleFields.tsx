import { useId } from 'react';
import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { WizardForm } from './types';
import { DEFAULT_FORM } from './constants';
import { nextCalendarOccurrence, validateCalendarSchedule } from '@/features/automation/calendarSchedule';
import styles from './RuleEditor.module.css';

export const EDITOR_MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
export function CalendarScheduleFields({ form, onChange }: { form: WizardForm; onChange: (schedule: NonNullable<WizardForm['schedule']>) => void }) {
  const id = useId();
  const schedule = form.schedule ?? DEFAULT_FORM.schedule;
  const officePackage = form.actions.some(action => action.type === 'run_annual_routine' && (action.routineDeadlineMonth || action.routineSteps));
  if (!schedule) return null;
  const update = (patch: Partial<typeof schedule>) => onChange({ ...schedule, ...patch });
  const calendar = schedule.schedule_kind !== 'interval';
  const error = calendar ? validateCalendarSchedule(schedule) : null;
  const next = calendar && !error ? nextCalendarOccurrence(schedule, new Date()) : null;
  return <section className={`${styles.box} ${styles.sunk} space-y-4`} aria-label="Zeitplan">
    <div className={styles.field}><Label htmlFor={`${id}-repeat`}>Wiederholung</Label><Select value={schedule.schedule_kind} onValueChange={value => update({ schedule_kind: value, ...(value === 'quarterly' ? { month_end: 'true' } : {}) })}><SelectTrigger id={`${id}-repeat`}><SelectValue /></SelectTrigger><SelectContent>{[['interval','Minutenintervall'],['annual','Jährlicher Stichtag'],['monthly','Monatlich'],['quarterly','Quartalsende']].map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
    {!calendar ? <div className={styles.field}><Label htmlFor={`${id}-minutes`}>Intervall (Minuten)</Label><Input id={`${id}-minutes`} type="number" min={60} value={schedule.minutes_interval} onChange={event => update({ minutes_interval: event.target.value })} /><p className={styles.hint}>Mindestens 60 Minuten. Der nächste Lauf richtet sich nach der letzten Ausführung.</p></div> : <>
      <div className={styles.grid3}>
        {schedule.schedule_kind === 'annual' && <div className={styles.field}><Label htmlFor={`${id}-month`}>{officePackage ? 'Startmonat' : 'Monat'}</Label><Select value={schedule.month} onValueChange={month => update({ month })}><SelectTrigger id={`${id}-month`}><SelectValue placeholder="Monat wählen" /></SelectTrigger><SelectContent>{EDITOR_MONTHS.map((month,index) => <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>)}</SelectContent></Select></div>}
        <div className={styles.field}><Label htmlFor={`${id}-day`}>{officePackage ? 'Starttag' : 'Tag'}</Label><Input id={`${id}-day`} type="number" min={1} max={31} disabled={schedule.month_end === 'true'} value={schedule.day} onChange={event => update({ day: event.target.value })} /></div>
        <div className={styles.field}><Label htmlFor={`${id}-hour`}>Uhrzeit (Berlin)</Label><Select value={schedule.hour} onValueChange={hour => update({ hour })}><SelectTrigger id={`${id}-hour`}><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 24 },(_,hour) => <SelectItem key={hour} value={String(hour)}>{String(hour).padStart(2,'0')}:00</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className={styles.row}><Label htmlFor={`${id}-end`}>Letzter Tag des Monats</Label><Switch id={`${id}-end`} checked={schedule.month_end === 'true'} onCheckedChange={checked => update({ month_end: String(checked) })} /></div>
      {error && <p role="status" className="text-sm text-destructive">{error}</p>}
      {next && <div className={styles.next}><CalendarDays className="h-4 w-4" aria-hidden="true" /><span>{officePackage ? 'Nächster Planungsbeginn' : 'Nächster Lauf'}: <strong>{new Intl.DateTimeFormat('de-DE', { dateStyle:'long', timeStyle:'short', timeZone:'Europe/Berlin' }).format(next)}</strong> (Berlin)</span></div>}
    </>}
  </section>;
}
