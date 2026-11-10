import type { WizardForm } from './types';
import { ACTION_TYPES, FIELD_OPTIONS_BY_MODULE, MODULE_OPTIONS } from './constants';
import { countConditions } from './logic';
import { isCalendarSchedule, nextCalendarOccurrence, validateCalendarSchedule } from '@/features/automation/calendarSchedule';
import styles from './RuleEditor.module.css';

export function RuleEditorSummary({ form, errors, onStep }: { form: WizardForm; errors: string[][]; onStep: (step: number) => void }) {
  const schedule = form.schedule;
  const conditions = countConditions(form.conditionGroup);
  const next = form.triggerType === 'schedule' && schedule && isCalendarSchedule(schedule) && !validateCalendarSchedule(schedule) ? nextCalendarOccurrence(schedule, new Date()) : null;
  const date = (value: Date) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(value);
  const fieldLabel = FIELD_OPTIONS_BY_MODULE[form.module]?.find(field => field.value === form.triggerField)?.label ?? form.triggerField;
  const trigger = form.triggerType === 'manual' ? 'Du startest die Regel manuell.' : form.triggerType === 'webhook' ? 'Ein externer Dienst sendet einen Webhook.' : form.triggerType === 'record_changed' ? `${fieldLabel || 'Ein Feld'} wird „${form.triggerValue || '…'}“.` : schedule?.schedule_kind === 'interval' ? `Alle ${schedule.minutes_interval || '…'} Minuten.` : `${({ annual: 'Jährlicher Stichtag', monthly: 'Monatlicher Stichtag', quarterly: 'Quartalsende' })[schedule?.schedule_kind ?? ''] ?? 'Zeitplan'}${schedule?.hour ? `, ${schedule.hour.padStart(2,'0')}:00 Uhr (Berlin)` : ''}.`;
  return <aside className={styles.summary} aria-label="Zusammenfassung der Regel">
    <h3>So läuft die Regel</h3>
    <dl>
      <div><dt>Fachbereich · Status</dt><dd>{MODULE_OPTIONS.find(module => module.value === form.module)?.label ?? form.module} · {form.enabled ? 'Aktiv' : 'Pausiert'}</dd></div>
      <div><dt>Wenn</dt><dd>{trigger}</dd></div>
      <div><dt>Und</dt><dd>{conditions ? `${conditions} Bedingung${conditions === 1 ? '' : 'en'} (${form.conditionGroup.logic === 'all' ? 'alle' : 'mindestens eine Gruppe oder Bedingung'}${form.conditionGroup.groups.length ? ', verschachtelt' : ''})` : 'Keine zusätzlichen Bedingungen'}</dd></div>
      <div><dt>Dann</dt><dd className="space-y-2">{form.actions.map((action, index) => {
        const steps = (action.routineSteps ?? '').split('\n').filter(line => line.trim()).length;
        return <p key={index}>{ACTION_TYPES.find(type => type.value === action.type)?.label ?? action.type}{action.title ? `: „${action.title}“` : ''}{steps ? ` · ${steps} Arbeitsschritte` : ''}</p>;
      })}</dd></div>
      <div><dt>Nächster Lauf</dt><dd>{!form.enabled ? 'Regel pausiert' : form.triggerType === 'manual' ? 'Beim manuellen Start' : form.triggerType === 'record_changed' || form.triggerType === 'webhook' ? 'Beim nächsten passenden Ereignis' : next ? `${date(next)} (Berlin)` : schedule?.schedule_kind === 'interval' ? 'Abhängig vom letzten Lauf' : 'Zeitplan vervollständigen'}</dd></div>
      {form.actions.some(action => action.routineRequiresConfirmation) && <div><dt>Jahresbestätigung</dt><dd>Vor der Ausführung erforderlich</dd></div>}
    </dl>
    {errors.some(step => step.length > 0) && <div className={styles.issues}><strong>Hinweise zur Einrichtung</strong>{errors.flatMap((step, index) => step.map(message => <button type="button" key={`${index}-${message}`} onClick={() => onStep(index)}>{message}</button>))}</div>}
  </aside>;
}
