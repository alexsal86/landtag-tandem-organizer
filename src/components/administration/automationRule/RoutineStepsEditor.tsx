import { HR_PHASES, defaultHrMeta, type HrStepMeta } from '@/features/onboarding-hr/progress';
import { FieldIssue, useRuleValidation } from './RuleValidationContext';
import { useId } from 'react';
import { ArrowDown, ArrowUp, Flag, Plus, Trash2 } from 'lucide-react';
import { draftStepSettings, defaultStepSetting, ROUTINE_RELEASES, ROUTINE_DEADLINES, hasRelativeDeadlines, resolveRoutineDates, type RoutineStepSetting } from '@/features/automation/routineWorkflow';
import { OFFICE_ROUTINE_TEMPLATES, parseRoutineSteps, ROUTINE_STEP_KINDS, routineStepKinds } from '@/features/automation/officeRoutineTemplates';
import { useTenantUsers } from '@/hooks/useTenantUsers';
import { TenantUserSelect } from '../TenantUserSelect';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import styles from './RuleEditor.module.css';

const STEP_SUGGESTIONS = [...new Set(OFFICE_ROUTINE_TEMPLATES.flatMap(template => parseRoutineSteps(template.steps).map(step => step.title)))];
const dateLabel = (value: string) => new Intl.DateTimeFormat('de-DE', { day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Berlin' }).format(new Date(`${value}T12:00:00Z`));
interface Props { hrMetadata?: HrStepMeta[]; onHrMetadataChange?: (metadata:HrStepMeta[])=>void; prefix: string; value: string; kinds?: string; settings?: string; dates?: { start: string; finish: string }; onChange: (value: string, kinds: string, settings: string) => void }
export function RoutineStepsEditor({ prefix,value,kinds,settings,dates,onChange,hrMetadata,onHrMetadataChange }: Props) {
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
    return { days:separator < 0 ? '0' : line.slice(0,separator).trim(), title:separator < 0 ? line.trim() : line.slice(separator + 1).trimStart(), kind:stepKinds[index],setting:stepSettings[index],hr:hrMetadata?.[index] ?? defaultHrMeta() };
  });
  let computed: Array<{ due:string | null; clamped:boolean }> = steps.map(() => ({ due:null,clamped:false }));
  try { if (dates) computed = resolveRoutineDates(dates.start,dates.finish,steps.map(step => Number(step.days)),stepSettings); } catch { /* Field diagnostics explain invalid dependency graphs. */ }
  const relative = hasRelativeDeadlines(stepSettings);
  const save = (next: typeof steps) => {onChange(next.map(step => `${step.days} | ${step.title}`).join('\n'),JSON.stringify(next.map(step => step.kind)),JSON.stringify(next.map(step => step.setting)));onHrMetadataChange?.(next.map(step=>step.hr));};
  const update = (index: number,patch: Partial<typeof steps[number]>) => save(steps.map((step,i) => i === index ? { ...step,...patch } : step));
  const updateHr = (index:number,patch:Partial<HrStepMeta>) => update(index,{hr:{...steps[index].hr,...patch}});
  const updateSetting = (index: number,patch: Partial<RoutineStepSetting>) => update(index,{ setting:{ ...steps[index].setting,...patch } });
  return <TooltipProvider><section tabIndex={-1} {...validation.field(`${prefix}.routineSteps`)} className="space-y-3" aria-labelledby={`${id}-heading`}>
    <div><h4 id={`${id}-heading`} className="text-sm font-semibold">Ablauf des Aufgabenpakets</h4><p className={styles.hint}>Fristen können sich auf den Paketabschluss oder einen benachbarten Schritt beziehen. „Vorheriger“ und „nächster“ beziehen sich auf die sichtbare Reihenfolge.</p></div>
    <FieldIssue name={`${prefix}.routineSteps`} />
    {!steps.length && <p className={`${styles.box} ${styles.hint}`}>Noch keine Arbeitsschritte. Füge einen Schritt hinzu oder lade eine Vorlage.</p>}
    {!relative && steps.some((step,index) => index > 0 && Number(step.days) > Number(steps[index - 1].days)) && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">Bitte vor dem Speichern „Nach Zeitpunkt sortieren“ wählen. Alle Einstellungen bleiben beim zugehörigen Schritt.</p>}
    <ol aria-label="Arbeitsschritte bis zum Abschluss">
      {steps.map((step,index) => {
        const proposed = computed[index].due;
        const beforeStart = computed[index].clamped;
        const basis = step.setting.deadline_basis;
        const kindLabel = ROUTINE_STEP_KINDS.find(kind => kind.value === step.kind)?.label;
        const releaseLabel = ROUTINE_RELEASES.find(release => release.value === step.setting.release)?.label;
        const owner = users.find(user => user.id === step.setting.assignee)?.display_name ?? (step.setting.assignee ? 'Zugewiesene Person' : 'Verantwortung des Pakets');
        return <li key={index} className={styles.timelineRow}>
          <div className={styles.days}>{hrMetadata ? <><Label htmlFor={`${id}-hr-offset-${index}`}>Kalendertage Abstand</Label><Input id={`${id}-hr-offset-${index}`} type="number" min={-365} max={365} value={step.hr.offset_days} onChange={e=>updateHr(index,{offset_days:Number(e.target.value)})}/><span>{step.hr.anchor==='start'?'Ab Eintritt':'Ab Austritt'}</span></> : <><Label htmlFor={`${id}-days-${index}`}>{basis === 'finish' ? 'Tage vorher' : 'Tage Abstand'}</Label><Input {...field(index,basis === 'finish' ? "days" : "deadline_offset")} id={`${id}-days-${index}`} type="number" min={basis === 'finish' || basis.endsWith('_completed') ? 0 : -365} max={365} step={1} value={basis === 'finish' ? step.days : step.setting.deadline_offset} onChange={event => basis === 'finish' ? update(index,{ days:event.target.value }) : updateSetting(index,{ deadline_offset:Number(event.target.value) })} /><FieldIssue name={`${prefix}.routineSteps.${index}.${basis === 'finish' ? 'days' : 'deadline_offset'}`} />
            {proposed ? <span className={beforeStart ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}>{dateLabel(proposed)}{beforeStart && <><br />Auf Planungsbeginn begrenzt</>}</span> : <span className="text-muted-foreground">{basis.endsWith('_completed') ? 'Nach tatsächlichem Abschluss' : 'Termin noch offen'}</span>}</>}
          </div>
          <div className="min-w-0"><Label className="sr-only" htmlFor={`${id}-title-${index}`}>Arbeitsschritt {index + 1}</Label><Input {...field(index,"title")} id={`${id}-title-${index}`} value={step.title} maxLength={500} placeholder="Was ist zu tun?" onChange={event => update(index,{ title:event.target.value.replace(/[\r\n]/g,' ') })} /><FieldIssue name={`${prefix}.routineSteps.${index}.title`} />
            {basis !== 'finish' && <p className="mt-1 text-xs text-muted-foreground">Frist: {ROUTINE_DEADLINES.find(option => option.value === basis)?.label} {step.setting.deadline_offset >= 0 ? '+' : ''}{step.setting.deadline_offset} Tage</p>}
            {hrMetadata ? <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Select value={step.hr.phase} onValueChange={phase=>updateHr(index,{phase:phase as HrStepMeta['phase']})}><SelectTrigger aria-label="HR-Phase"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(HR_PHASES).map(([value,label])=><SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
              <Select value={step.hr.anchor} onValueChange={anchor=>updateHr(index,{anchor:anchor as 'start'|'end'})}><SelectTrigger aria-label="Fristbezug"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="start">Eintrittsdatum</SelectItem><SelectItem value="end">Austrittsdatum</SelectItem></SelectContent></Select>
              <Select value={step.kind} onValueChange={kind=>update(index,{kind})}><SelectTrigger aria-label="Schrittziel"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="subtask">Checklistenpunkt im Paket</SelectItem><SelectItem value="task">Eigenständige Aufgabe</SelectItem></SelectContent></Select>
              <Select value={step.setting.release} onValueChange={release=>updateSetting(index,{release:release as 'package_start'|'scheduled',use_deputy:false})}><SelectTrigger aria-label="Schrittstart"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="package_start">Beim Paketstart</SelectItem><SelectItem value="scheduled">Am geplanten Tag</SelectItem></SelectContent></Select>
              <Select value={step.hr.evidence} onValueChange={evidence=>updateHr(index,{evidence:evidence as HrStepMeta['evidence']})}><SelectTrigger aria-label="Nachweis"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Normaler Abschluss</SelectItem><SelectItem value="gdpr">DSGVO-Nachweis durch Leitung</SelectItem><SelectItem value="handover">Aufgabenübergabe durch Leitung</SelectItem></SelectContent></Select>
              <label className="flex items-center gap-2"><Switch checked={step.hr.is_mandatory} onCheckedChange={is_mandatory=>updateHr(index,{is_mandatory})}/>Pflichtpunkt</label>
            </div> : <details className={styles.stepDetails}><summary>{kindLabel} · {releaseLabel} · {owner}</summary><div className={styles.stepFields}>
              <div className={styles.field}><Label htmlFor={`${id}-basis-${index}`}>Worauf bezieht sich die Frist?</Label><Select value={basis} onValueChange={deadline_basis => updateSetting(index,{ deadline_basis:deadline_basis as RoutineStepSetting['deadline_basis'],deadline_offset:0 })}><SelectTrigger {...field(index,'deadline_basis')} id={`${id}-basis-${index}`}><SelectValue /></SelectTrigger><SelectContent>{ROUTINE_DEADLINES.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><FieldIssue name={`${prefix}.routineSteps.${index}.deadline_basis`} />{basis !== 'finish' && <p className={styles.hint}>{basis.endsWith('_completed') ? '0 bis 365 Kalendertage nach dem tatsächlichen Abschluss. Bis dahin bleibt die Frist offen.' : 'Negative Zahl = Tage vorher, positive Zahl = Tage danach. Beispiel: −3 bedeutet drei Tage vor dem Bezugstermin.'}</p>}</div>
              <div className={styles.field}><Label htmlFor={`${id}-kind-${index}`}>Was soll entstehen?</Label><Select value={step.kind} onValueChange={kind => update(index,{ kind })}><SelectTrigger {...field(index,"kind")} id={`${id}-kind-${index}`}><SelectValue /></SelectTrigger><SelectContent>{ROUTINE_STEP_KINDS.map(kind => <SelectItem key={kind.value} value={kind.value}>{kind.label}</SelectItem>)}</SelectContent></Select><FieldIssue name={`${prefix}.routineSteps.${index}.kind`} />{step.kind === 'jour_fixe' && <p className={styles.hint}>Wird als Vorgang für die Jour-fixe-Agenda vorgemerkt.</p>}</div>
              <div className={styles.field}><Label htmlFor={`${id}-release-${index}`}>Wann startet dieser Schritt?</Label><Select value={step.setting.release} onValueChange={release => updateSetting(index,{ release:release as RoutineStepSetting['release'] })}><SelectTrigger {...field(index,"release")} id={`${id}-release-${index}`}><SelectValue /></SelectTrigger><SelectContent>{ROUTINE_RELEASES.map(release => <SelectItem key={release.value} value={release.value}>{release.label}</SelectItem>)}</SelectContent></Select><FieldIssue name={`${prefix}.routineSteps.${index}.release`} />{step.setting.release === 'scheduled' && <p className={styles.hint}>Wird frühestens am angegebenen Tag automatisch angelegt; Prüfung alle 15 Minuten.</p>}</div>
              <div className={styles.field}><Label>Verantwortlich{step.kind === 'decision' ? ' / entscheidet' : ''}</Label><TenantUserSelect validationField={`${prefix}.routineSteps.${index}.assignee`} value={step.setting.assignee} onValueChange={assignee => updateSetting(index,{ assignee })} placeholder="Zuständige Person des Pakets übernehmen" /><FieldIssue name={`${prefix}.routineSteps.${index}.assignee`} />{step.setting.assignee && <Button type="button" size="sm" variant="ghost" onClick={() => updateSetting(index,{ assignee:'' })}>Vom Paket übernehmen</Button>}</div>
              <div className={styles.row}><div><Label htmlFor={`${id}-deputy-${index}`}>Bei Abwesenheit vertreten lassen</Label><p className={styles.hint}>Nutzt die Stellvertretung aus genehmigten Abwesenheiten. Gilt auch für offene Freigaben; eine Zustimmung bleibt erforderlich.</p></div><Switch id={`${id}-deputy-${index}`} checked={step.setting.use_deputy} onCheckedChange={use_deputy => updateSetting(index,{ use_deputy })} /></div>
              {step.setting.release === 'after_approval' && <div className={styles.field}><Label>Wer gibt diesen Schritt frei? *</Label><TenantUserSelect validationField={`${prefix}.routineSteps.${index}.approver`} value={step.setting.approver} onValueChange={approver => updateSetting(index,{ approver })} placeholder="Freigebende Person auswählen…" /><FieldIssue name={`${prefix}.routineSteps.${index}.approver`} /><p className={styles.hint}>Erstellt eine eigene Ja/Nein-Entscheidung. Eine Ablehnung blockiert den Schritt.</p></div>}
              <Select value="" onValueChange={title => update(index,{ title })}><SelectTrigger aria-label={`Vorschlag für Schritt ${index + 1} auswählen`}><SelectValue placeholder="Aufgabe aus Vorschlägen auswählen…" /></SelectTrigger><SelectContent>{STEP_SUGGESTIONS.map(title => <SelectItem key={title} value={title}>{title}</SelectItem>)}</SelectContent></Select>
            </div></details>}
            {step.setting.release === 'after_approval' && !step.setting.approver && <p role="status" className="mt-1 text-xs text-destructive">Bitte die freigebende Person in den Schrittdetails auswählen.</p>}
          </div>
          <div className={styles.stepButtons}>
            <Tooltip><TooltipTrigger asChild><span><Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={index === 0} aria-label={`Schritt ${index + 1} nach oben verschieben`} onClick={() => { const next = [...steps]; [next[index - 1],next[index]] = [next[index],next[index - 1]]; save(next); }}><ArrowUp className="h-4 w-4" /></Button></span></TooltipTrigger><TooltipContent>Schritt nach oben</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><span><Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={index === steps.length - 1} aria-label={`Schritt ${index + 1} nach unten verschieben`} onClick={() => { const next = [...steps]; [next[index],next[index + 1]] = [next[index + 1],next[index]]; save(next); }}><ArrowDown className="h-4 w-4" /></Button></span></TooltipTrigger><TooltipContent>Schritt nach unten</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive" aria-label={`Schritt ${index + 1} entfernen`} onClick={() => save(steps.filter((_,i) => i !== index))}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>Arbeitsschritt entfernen</TooltipContent></Tooltip>
          </div>
        </li>;
      })}
    </ol>
    {steps.length > 0 && <div className={styles.goal}><Flag className="h-4 w-4" aria-hidden="true" />Abschluss des Aufgabenpakets{dates ? ` am ${dateLabel(dates.finish)}` : ''}</div>}
    <div className={styles.row}><Button type="button" variant="outline" size="sm" disabled={steps.length >= 20} onClick={() => save([...steps,{ days:'0',title:'',kind:'subtask',setting:defaultStepSetting(),hr:defaultHrMeta() }])}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />Arbeitsschritt hinzufügen</Button><span className={styles.hint}>{steps.length} von 20 Arbeitsschritten</span></div>
    {!hrMetadata && steps.length > 1 && !relative && <Button type="button" variant="link" size="sm" className="px-0" onClick={() => save([...steps].sort((a,b) => Number(b.days) - Number(a.days)))}>Nach Zeitpunkt sortieren</Button>}
    <p className={styles.hint}>{hrMetadata ? "HR-Fristen zählen Kalendertage ab Eintritt/Austritt. Änderungen gelten nur für neue Pakete. Keine Ausweis- oder Schlüsselnummern in Schritttiteln speichern." : "Fristen liegen frühestens am Planungsbeginn. Ohne Abschlussdatum und Schritte bleibt es eine einzelne Büroaufgabe."}</p>
  </section></TooltipProvider>;
}
