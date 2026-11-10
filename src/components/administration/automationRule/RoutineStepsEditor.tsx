import { FieldIssue, useRuleValidation } from './RuleValidationContext';
import { useId } from 'react';
import { Flag, Plus, Trash2 } from 'lucide-react';
import { draftStepSettings, defaultStepSetting, ROUTINE_RELEASES, type RoutineStepSetting } from '@/features/automation/routineWorkflow';
import { OFFICE_ROUTINE_TEMPLATES, parseRoutineSteps, ROUTINE_STEP_KINDS, routineStepKinds } from '@/features/automation/officeRoutineTemplates';
import { useTenantUsers } from '@/hooks/useTenantUsers';
import { TenantUserSelect } from '../TenantUserSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import styles from './RuleEditor.module.css';

const STEP_SUGGESTIONS = [...new Set(OFFICE_ROUTINE_TEMPLATES.flatMap(template => parseRoutineSteps(template.steps).map(step => step.title)))];
const dateLabel = (value: string) => new Intl.DateTimeFormat('de-DE', { day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Berlin' }).format(new Date(`${value}T12:00:00Z`));
interface Props { prefix: string; value: string; kinds?: string; settings?: string; dates?: { start: string; finish: string }; onChange: (value: string, kinds: string, settings: string) => void }
export function RoutineStepsEditor({ prefix,value,kinds,settings,dates,onChange }: Props) {
  const id = useId();
  const validation = useRuleValidation();
  const field = (index: number,name: string) => validation.field(`${prefix}.routineSteps.${index}.${name}`);
  const { users } = useTenantUsers();
  const lines = value.split('\n').filter(line => line.trim());
  let stepKinds: string[] = Array(lines.length).fill('subtask');
  try { stepKinds = routineStepKinds(kinds,lines.length); } catch { /* The inline configuration error remains visible for repair. */ }
  const stepSettings = draftStepSettings(settings,lines.length);
  const steps = lines.map((line,index) => {
    const separator = line.indexOf('|');
    return { days:separator < 0 ? '0' : line.slice(0,separator).trim(), title:separator < 0 ? line.trim() : line.slice(separator + 1).trimStart(), kind:stepKinds[index],setting:stepSettings[index] };
  });
  const save = (next: typeof steps) => onChange(next.map(step => `${step.days} | ${step.title}`).join('\n'),JSON.stringify(next.map(step => step.kind)),JSON.stringify(next.map(step => step.setting)));
  const update = (index: number,patch: Partial<typeof steps[number]>) => save(steps.map((step,i) => i === index ? { ...step,...patch } : step));
  const updateSetting = (index: number,patch: Partial<RoutineStepSetting>) => update(index,{ setting:{ ...steps[index].setting,...patch } });
  return <TooltipProvider><section tabIndex={-1} {...validation.field(`${prefix}.routineSteps`)} className="space-y-3" aria-labelledby={`${id}-heading`}>
    <div><h4 id={`${id}-heading`} className="text-sm font-semibold">Ablauf des Aufgabenpakets</h4><p className={styles.hint}>Tage vor Abschluss bestimmen die Reihenfolge. Typ, Zuständigkeit, Freigabe und Startbedingung kannst du pro Schritt aufklappen.</p></div>
    <FieldIssue name={`${prefix}.routineSteps`} />
    {!steps.length && <p className={`${styles.box} ${styles.hint}`}>Noch keine Arbeitsschritte. Füge einen Schritt hinzu oder lade eine Vorlage.</p>}
    {steps.some((step,index) => index > 0 && Number(step.days) > Number(steps[index - 1].days)) && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">Bitte vor dem Speichern „Nach Zeitpunkt sortieren“ wählen. Alle Einstellungen bleiben beim zugehörigen Schritt.</p>}
    <ol aria-label="Arbeitsschritte bis zum Abschluss">
      {steps.map((step,index) => {
        let proposed: string | null = null;
        if (dates && step.days.trim() && Number.isInteger(Number(step.days)) && Number(step.days) >= 0 && Number(step.days) <= 365) {
          const date = new Date(`${dates.finish}T12:00:00Z`);
          date.setUTCDate(date.getUTCDate() - Number(step.days)); proposed = date.toISOString().slice(0,10);
        }
        const beforeStart = proposed && dates && proposed < dates.start;
        const kindLabel = ROUTINE_STEP_KINDS.find(kind => kind.value === step.kind)?.label;
        const releaseLabel = ROUTINE_RELEASES.find(release => release.value === step.setting.release)?.label;
        const owner = users.find(user => user.id === step.setting.assignee)?.display_name ?? (step.setting.assignee ? 'Zugewiesene Person' : 'Verantwortung des Pakets');
        return <li key={index} className={styles.timelineRow}>
          <div className={styles.days}><Label htmlFor={`${id}-days-${index}`}>Tage vorher</Label><Input {...field(index,"days")} id={`${id}-days-${index}`} type="number" min={0} max={365} step={1} value={step.days} onChange={event => update(index,{ days:event.target.value })} /><FieldIssue name={`${prefix}.routineSteps.${index}.days`} />
            {proposed ? <span className={beforeStart ? 'text-destructive' : 'text-muted-foreground'}>{beforeStart ? <>Vor Start: {dateLabel(proposed)}<br />Frist: {dateLabel(dates!.start)}</> : dateLabel(proposed)}</span> : <span className="text-muted-foreground">{step.days === '0' ? 'Am Abschluss' : 'Tage vor Abschluss'}</span>}
          </div>
          <div className="min-w-0"><Label className="sr-only" htmlFor={`${id}-title-${index}`}>Arbeitsschritt {index + 1}</Label><Input {...field(index,"title")} id={`${id}-title-${index}`} value={step.title} maxLength={500} placeholder="Was ist zu tun?" onChange={event => update(index,{ title:event.target.value.replace(/[\r\n]/g,' ') })} /><FieldIssue name={`${prefix}.routineSteps.${index}.title`} />
            <details className={styles.stepDetails}><summary>{kindLabel} · {releaseLabel} · {owner}</summary><div className={styles.stepFields}>
              <div className={styles.field}><Label htmlFor={`${id}-kind-${index}`}>Was soll entstehen?</Label><Select value={step.kind} onValueChange={kind => update(index,{ kind })}><SelectTrigger {...field(index,"kind")} id={`${id}-kind-${index}`}><SelectValue /></SelectTrigger><SelectContent>{ROUTINE_STEP_KINDS.map(kind => <SelectItem key={kind.value} value={kind.value}>{kind.label}</SelectItem>)}</SelectContent></Select><FieldIssue name={`${prefix}.routineSteps.${index}.kind`} />{step.kind === 'jour_fixe' && <p className={styles.hint}>Wird als Vorgang für die Jour-fixe-Agenda vorgemerkt.</p>}</div>
              <div className={styles.field}><Label htmlFor={`${id}-release-${index}`}>Wann startet dieser Schritt?</Label><Select value={step.setting.release} onValueChange={release => updateSetting(index,{ release:release as RoutineStepSetting['release'] })}><SelectTrigger {...field(index,"release")} id={`${id}-release-${index}`}><SelectValue /></SelectTrigger><SelectContent>{ROUTINE_RELEASES.map(release => <SelectItem key={release.value} value={release.value}>{release.label}</SelectItem>)}</SelectContent></Select><FieldIssue name={`${prefix}.routineSteps.${index}.release`} />{step.setting.release === 'scheduled' && <p className={styles.hint}>Wird frühestens am angegebenen Tag automatisch angelegt; Prüfung alle 15 Minuten.</p>}</div>
              <div className={styles.field}><Label>Verantwortlich{step.kind === 'decision' ? ' / entscheidet' : ''}</Label><TenantUserSelect validationField={`${prefix}.routineSteps.${index}.assignee`} value={step.setting.assignee} onValueChange={assignee => updateSetting(index,{ assignee })} placeholder="Zuständige Person des Pakets übernehmen" /><FieldIssue name={`${prefix}.routineSteps.${index}.assignee`} />{step.setting.assignee && <Button type="button" size="sm" variant="ghost" onClick={() => updateSetting(index,{ assignee:'' })}>Vom Paket übernehmen</Button>}</div>
              {step.setting.release === 'after_approval' && <div className={styles.field}><Label>Wer gibt diesen Schritt frei? *</Label><TenantUserSelect validationField={`${prefix}.routineSteps.${index}.approver`} value={step.setting.approver} onValueChange={approver => updateSetting(index,{ approver })} placeholder="Freigebende Person auswählen…" /><FieldIssue name={`${prefix}.routineSteps.${index}.approver`} /><p className={styles.hint}>Erstellt eine eigene Ja/Nein-Entscheidung. Eine Ablehnung blockiert den Schritt.</p></div>}
              <Select value="" onValueChange={title => update(index,{ title })}><SelectTrigger aria-label={`Vorschlag für Schritt ${index + 1} auswählen`}><SelectValue placeholder="Aufgabe aus Vorschlägen auswählen…" /></SelectTrigger><SelectContent>{STEP_SUGGESTIONS.map(title => <SelectItem key={title} value={title}>{title}</SelectItem>)}</SelectContent></Select>
            </div></details>
            {step.setting.release === 'after_approval' && !step.setting.approver && <p role="status" className="mt-1 text-xs text-destructive">Bitte die freigebende Person in den Schrittdetails auswählen.</p>}
          </div>
          <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive" aria-label={`Schritt ${index + 1} entfernen`} onClick={() => save(steps.filter((_,i) => i !== index))}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>Arbeitsschritt entfernen</TooltipContent></Tooltip>
        </li>;
      })}
    </ol>
    {steps.length > 0 && <div className={styles.goal}><Flag className="h-4 w-4" aria-hidden="true" />Abschluss des Aufgabenpakets{dates ? ` am ${dateLabel(dates.finish)}` : ''}</div>}
    <div className={styles.row}><Button type="button" variant="outline" size="sm" disabled={steps.length >= 20} onClick={() => save([...steps,{ days:'0',title:'',kind:'subtask',setting:defaultStepSetting() }])}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />Arbeitsschritt hinzufügen</Button><span className={styles.hint}>{steps.length} von 20 Arbeitsschritten</span></div>
    {steps.length > 1 && <Button type="button" variant="link" size="sm" className="px-0" onClick={() => save([...steps].sort((a,b) => Number(b.days) - Number(a.days)))}>Nach Zeitpunkt sortieren</Button>}
    <p className={styles.hint}>Fristen liegen frühestens am Planungsbeginn. Ohne Abschlussdatum und Schritte bleibt es eine einzelne Büroaufgabe.</p>
  </section></TooltipProvider>;
}
