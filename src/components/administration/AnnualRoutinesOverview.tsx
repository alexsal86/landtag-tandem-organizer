import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { useNavigate } from 'react-router-dom';
import { berlinCalendar, matchesRoutineFilter, presentAnnualRoutines, type PresentedRoutine, type RoutineFilter } from '@/features/automation/annualRoutinePresentation';
import type { AutomationRuleRecordView } from './automationShared';
import { Button } from '@/components/ui/button';
import { CheckCircle2, CircleAlert, Clock3, Hand, ListTodo, Loader2, Pencil, Play, Plus, Settings2, Zap } from 'lucide-react';
import { ErrorState, LoadingState, EmptyState } from '@/components/ui-patterns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import styles from './AnnualRoutinesOverview.module.css';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const tone = (status: PresentedRoutine['status']) => status === 'completed' ? styles.done : status === 'overdue' ? styles.late : styles.soon;
const statusLabel = (status: PresentedRoutine['status']) => ({ completed: 'Erledigt', overdue: 'Überfällig', due: 'Heute fällig', upcoming: 'Anstehend' })[status];
interface Props {
  rules: AutomationRuleRecordView[];
  onEdit: (rule: AutomationRuleRecordView) => void;
  onRun: (rule: AutomationRuleRecordView) => void;
  onNew: (month?: number) => void;
  canEdit: boolean;
  runningRuleId: string | null;
}
export function AnnualRoutinesOverview({ rules, onEdit, onRun, onNew, canEdit, runningRuleId }: Props) {
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [confirmRule, setConfirmRule] = useState<AutomationRuleRecordView | null>(null);
  const [filter, setFilter] = useState<RoutineFilter>('all');
  const [showEmpty, setShowEmpty] = useState(true);
  const [jumpMonth, setJumpMonth] = useState<number | null>(null);
  const rows = useRef(new Map<number, HTMLElement>());
  const now = new Date();
  const today = berlinCalendar(now);
  const year = today.year;
  const { data: records = [], isLoading, error, refetch } = useQuery({
    queryKey: ['annual-routines', currentTenant?.id, year], enabled: Boolean(currentTenant?.id), staleTime: 60_000,
    queryFn: async () => {
      if (!currentTenant) return [];
      const annual = await supabase.from('annual_tasks').select('id,due_month,due_day,automation_rule_id').eq('tenant_id', currentTenant.id);
      if (annual.error) throw annual.error;
      if (!annual.data.length) return [];
      const completions = await supabase.from('annual_task_completions').select('annual_task_id,completed_at,linked_task_id').in('annual_task_id', annual.data.map(item => item.id)).eq('year', year);
      if (completions.error) throw completions.error;
      const byId = new Map(completions.data.map(item => [item.annual_task_id, item]));
      return annual.data.map(item => ({ ...item, completion: byId.get(item.id) }));
    },
  });
  useEffect(() => {
    if (jumpMonth === null) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rows.current.get(jumpMonth)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    setJumpMonth(null);
  }, [jumpMonth, showEmpty]);
  if (isLoading) return <LoadingState variant="list" rows={3} />;
  if (error) return <ErrorState title="Jahresstatus konnte nicht geladen werden" onRetry={() => void refetch()} />;
  const routines = presentAnnualRoutines(rules, records, now);
  const visible = routines.filter(item => matchesRoutineFilter(item.status, filter));
  const overdue = routines.filter(item => item.status === 'overdue').length;
  const completed = routines.filter(item => item.status === 'completed').length;
  const upcoming = routines.length - overdue - completed;

  const renderCard = (item: PresentedRoutine) => {
    const { rule, status, linkedTask, system, due, days } = item;
    const StatusIcon = status === 'completed' ? CheckCircle2 : status === 'overdue' ? CircleAlert : Clock3;
    const KindIcon = system ? Settings2 : ListTodo;
    const ModeIcon = rule.trigger_type === 'manual' ? Hand : Zap;
    const when = days === null || status === 'completed' ? '' : days < 0 ? `seit ${-days} ${days === -1 ? 'Tag' : 'Tagen'} fällig` : days === 0 ? 'heute' : `in ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
    const hour = Number(rule.trigger_config.hour);
    const clock = rule.trigger_type === 'schedule' && rule.trigger_config.hour !== undefined && Number.isInteger(hour) && hour >= 0 && hour <= 23 ? `, ${String(hour).padStart(2, '0')}:00 Uhr` : '';
    return <article key={rule.id} className={`${styles.card} ${tone(status)}`} aria-label={rule.name}>
      <div>
        <h4 className={styles.title}>{rule.name}</h4>
        {rule.description && <p className={styles.description}>{rule.description}</p>}
        <div className={styles.meta}>
          <span className={`${styles.chip} ${tone(status)}`}><StatusIcon aria-hidden="true" />{statusLabel(status)}</span>
          <span>{due ? <><time dateTime={due}>{new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', timeZone: 'Europe/Berlin' }).format(new Date(`${due}T12:00:00Z`))}</time>{clock}{when && ` · ${when}`}{rule.trigger_config.month_end === 'true' && ' · Monatsende'}</> : 'Stichtag prüfen'}</span>
          <span><KindIcon aria-hidden="true" />{system ? 'Systemaktion' : 'Büroaufgabe'}</span>
          <span><ModeIcon aria-hidden="true" />{!rule.enabled ? 'Pausiert' : rule.trigger_type === 'manual' ? 'Manuell' : 'Automatisch'}</span>
          {linkedTask && status !== 'completed' && <span>Im Büro · in Bearbeitung</span>}
        </div>
      </div>
      <div className={styles.actions}>
        {linkedTask ? <Button variant="outline" size="sm" onClick={() => navigate(`/mywork?tab=tasks&highlight=${linkedTask}`)}>Aufgabe öffnen</Button> : status !== 'completed' && <Button variant={status === 'overdue' ? 'default' : 'outline'} size="sm" disabled={!canEdit || !rule.enabled || !due || runningRuleId !== null} onClick={() => system ? setConfirmRule(rule) : onRun(rule)}>
          {runningRuleId === rule.id ? <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : <Play aria-hidden="true" className="mr-2 h-4 w-4" />}{runningRuleId === rule.id ? 'Wird ausgeführt…' : 'Ausführen'}
        </Button>}
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={`${rule.name} bearbeiten`} title="Bearbeiten" disabled={!canEdit} onClick={() => onEdit(rule)}><Pencil aria-hidden="true" className="h-4 w-4" /></Button>
      </div>
    </article>;
  };

  return <section className={styles.overview} aria-label={`Jahresroutinen ${year}`}>
    <div className={styles.heading}>
      <div><h2>Jahresroutinen {year}</h2><p className={styles.subtitle}>Wiederkehrende Aufgaben und Systemaktionen im Jahreslauf</p></div>
      <Button className="rounded-xl" onClick={() => onNew()} disabled={!canEdit}><Plus aria-hidden="true" className="mr-2 h-4 w-4" />Neue Jahresroutine</Button>
    </div>
    <section className={styles.band} aria-label="Jahresübersicht">
      <div className={styles.stats} aria-live="polite"><div><b className={styles.late}>{overdue}</b><span>überfällig</span></div><div><b>{upcoming}</b><span>anstehend</span></div><div><b className={styles.done}>{completed}</b><span>erledigt</span></div></div>
      <nav className={styles.rail} aria-label="Monat auswählen">{MONTHS.map((month, index) => {
        const items = routines.filter(item => item.month === index + 1);
        return <button key={month} className={`${styles.segment} ${today.month === index + 1 ? styles.current : ''}`} aria-current={today.month === index + 1 ? 'date' : undefined} aria-label={`${month}: ${items.length} ${items.length === 1 ? 'Routine' : 'Routinen'}`} onClick={() => { setShowEmpty(true); setJumpMonth(index + 1); }}>
          <span className={styles.bar} aria-hidden="true">{items.map(item => <i key={item.rule.id} className={tone(item.status)} />)}</span><small>{month.slice(0,3)}</small>
        </button>;
      })}</nav>
    </section>
    <div className={styles.tools}>
      <div className={styles.filters} role="group" aria-label="Routinen filtern">{([['all','Alle'],['open','Offen'],['done','Erledigt']] as const).map(([value,label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <label className={styles.toggle}><input type="checkbox" checked={showEmpty} onChange={event => setShowEmpty(event.target.checked)} />Monate ohne Routine anzeigen</label>
    </div>
    {!routines.length && <div className="py-4"><EmptyState title="Keine Jahresroutinen" description="Lege eine Jahresroutine an oder nutze eine Vorlage im Regel-Editor." /></div>}
    {routines.length > 0 && visible.length === 0 && <p role="status" className="py-4 text-sm text-muted-foreground">Keine Routinen für diesen Filter.</p>}
    {MONTHS.map((month, index) => {
      const items = visible.filter(item => item.month === index + 1);
      const total = routines.filter(item => item.month === index + 1).length;
      return <div key={month}>
        {index + 1 === today.month && <div className={styles.today}>Heute, {today.day}. {month}</div>}
        {(items.length > 0 || showEmpty) && <section className={`${styles.row} ${items.length ? '' : styles.empty}`} aria-label={`${month} ${year}`} ref={node => { if (node) rows.current.set(index+1,node); else rows.current.delete(index+1); }}>
          <h3 className={styles.month}>{month}{items.length > 0 && <small>{items.length} {items.length === 1 ? 'Routine' : 'Routinen'}</small>}</h3>
          {items.length ? <div className={styles.cards}>{items.map(renderCard)}</div> : <div className={styles.none}><span>{total ? 'Keine passenden Routinen' : 'Keine Routine'}</span>{canEdit && <button className={styles.add} onClick={() => onNew(index + 1)} aria-label={`Jahresroutine für ${month} hinzufügen`}>+ Hinzufügen</button>}</div>}
        </section>}
      </div>;
    })}
    {visible.some(item => item.month === null) && <section className={styles.row} aria-label="Stichtag prüfen"><h3 className={styles.month}>Stichtag prüfen</h3><div className={styles.cards}>{visible.filter(item => item.month === null).map(renderCard)}</div></section>}
    <AlertDialog open={confirmRule !== null} onOpenChange={open => { if (!open) setConfirmRule(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirmRule?.name} ausführen?</AlertDialogTitle><AlertDialogDescription>Diese Systemaktion verändert die Personaldaten des Büros für {year}. Sie wird höchstens einmal pro Jahr ausgeführt.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction disabled={!canEdit || runningRuleId !== null || !confirmRule?.enabled} onClick={() => { if (confirmRule && canEdit && runningRuleId === null && confirmRule.enabled) onRun(confirmRule); setConfirmRule(null); }}>Ausführen</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
