import { useState } from 'react';
import { Beaker, Clock, Copy, Download, Hand, History, ListTodo, Loader2, MoreHorizontal, Play, Plus, Search, Trash2, Upload, Webhook, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { AutomationRuleRecordView as Rule } from './automationShared';
import { annualRoutineAction } from '@/features/automation/annualRoutines';
import { matchesRule, RULE_FILTERS, ruleActionLabel, ruleModuleLabel, ruleTriggerLabel, type RuleFilter } from '@/features/automation/rulePresentation';
import styles from './AutomationRulesWorkspace.module.css';

type RuleStats = Record<string, { total: number; success: number; totalDurationMs: number; withDuration: number }>;
interface Props {
  rules: Rule[]; stats: RuleStats; canEdit: boolean; canToggle: boolean; paused: boolean; pauseUnknown: boolean;
  runningRuleId: string | null; toggling: boolean; deleting: boolean;
  getNextRun: (rule: Rule) => Date | null;
  onEdit: (rule: Rule) => void; onDuplicate: (rule: Rule) => void; onVersions: (rule: Rule) => void;
  onHistory: (ruleId: string) => void; onDryRun: (rule: Rule) => void; onRun: (rule: Rule) => void;
  onDelete: (ruleId: string) => void; onToggle: (rule: Rule, checked: boolean) => void;
  onExport: () => void; onImport: () => void; onNew: () => void;
}
export function AutomationRulesList(props: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RuleFilter>('all');
  const [deleteRule, setDeleteRule] = useState<Rule | null>(null);
  const [runRule, setRunRule] = useState<Rule | null>(null);
  const filtered = props.rules.filter(rule => matchesRule(rule, query, filter));
  const executing = props.runningRuleId !== null;
  return <TooltipProvider delayDuration={200}>
    <section aria-labelledby="automation-rules-heading">
      <div className={styles.listHead}>
        <div><h2 id="automation-rules-heading">Automations-Regeln</h2><p className={styles.count} role="status" aria-live="polite">{filtered.length} von {props.rules.length} Regeln</p></div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className={styles.button} onClick={props.onExport}><Download className="mr-2 h-4 w-4" aria-hidden="true" />Export</Button>
          <Button type="button" variant="outline" className={styles.button} onClick={props.onImport} disabled={!props.canEdit}><Upload className="mr-2 h-4 w-4" aria-hidden="true" />Import</Button>
          <Button type="button" className={styles.button} onClick={props.onNew} disabled={!props.canEdit}><Plus className="mr-2 h-4 w-4" aria-hidden="true" />Neue Regel</Button>
        </div>
      </div>
      <div className={styles.tools}>
        <div className={styles.search}><Search aria-hidden="true" /><Input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Regeln durchsuchen" aria-label="Regeln durchsuchen" /></div>
        <div className={styles.filters} role="group" aria-label="Regeln filtern">{RULE_FILTERS.map(item => <button type="button" key={item.value} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div>
      </div>
      <div className={styles.rules}>
        {!filtered.length && <div className={styles.empty}>{props.rules.length ? <><p>Keine Regel gefunden. Passe Suche oder Filter an.</p><Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => { setQuery(''); setFilter('all'); }}>Suche und Filter zurücksetzen</Button></> : 'Noch keine Regeln. Lege eine neue Regel an oder nutze eine Vorlage.'}</div>}
        {filtered.map(rule => {
          const annual = annualRoutineAction(rule);
          const system = Boolean(annual?.payload?.system_function);
          const plannedRun = props.getNextRun(rule);
          const nextRun = plannedRun && Number.isFinite(plannedRun.getTime()) ? plannedRun : null;
          const stat = props.stats[rule.id];
          const successRate = stat?.total ? Math.round(stat.success / stat.total * 100) : null;
          const TriggerIcon = ({ schedule: Clock, manual: Hand, record_changed: Zap, webhook: Webhook })[rule.trigger_type];
          const runDisabled = !props.canEdit || !rule.enabled || props.paused || props.pauseUnknown || executing;
          const runLabel = !props.canEdit ? 'Nur Abgeordnete und Büroleitung dürfen Regeln ausführen' : props.pauseUnknown ? 'Pausenstatus ist nicht verfügbar' : props.paused ? 'Alle Automationen sind pausiert' : !rule.enabled ? 'Regel zuerst aktivieren' : executing ? 'Eine Regel wird bereits ausgeführt' : 'Jetzt ausführen';
          return <article key={rule.id} className={`${styles.rule} ${!rule.enabled ? styles.off : ''}`} aria-label={rule.name}>
            <Switch checked={rule.enabled} onCheckedChange={checked => props.onToggle(rule, checked)} disabled={!props.canToggle || props.toggling} aria-label={`Regel „${rule.name}“ ${rule.enabled ? 'pausieren' : 'aktivieren'}`} />
            <div>
              <h3 className={styles.name}>{rule.name}</h3>
              <p className={styles.description}>{rule.description || 'Keine Beschreibung'}</p>
              <div className={styles.meta}>
                {!rule.enabled && <span className={styles.tag}>Pausiert</span>}
                <span><TriggerIcon aria-hidden="true" />{ruleTriggerLabel(rule.trigger_type)}</span>
                <span>{system ? <Zap aria-hidden="true" /> : <ListTodo aria-hidden="true" />}{ruleActionLabel(rule.actions)}</span>
                {annual && <span className={`${styles.tag} ${styles.year}`}>Jahresroutine</span>}
                {!annual && <span>{ruleModuleLabel(rule.module)}</span>}
                {nextRun && rule.enabled && !props.paused && !props.pauseUnknown && <Tooltip><TooltipTrigger asChild><span tabIndex={0}>{nextRun.getTime() < Date.now() ? 'Lauf fällig' : 'Nächster Lauf'} {formatDistanceToNow(nextRun, { addSuffix: true, locale: de })}</span></TooltipTrigger><TooltipContent>{new Intl.DateTimeFormat('de-DE', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(nextRun)} (Berlin)</TooltipContent></Tooltip>}
                {successRate !== null && <Tooltip><TooltipTrigger asChild><span tabIndex={0}>{successRate}% erfolgreich</span></TooltipTrigger><TooltipContent>{stat.success} von {stat.total} geladenen Ausführungen erfolgreich{stat.withDuration > 0 && ` · Ø ${Math.round(stat.totalDurationMs / stat.withDuration / 1000)} s`}</TooltipContent></Tooltip>}
                <span>Aktualisiert {formatDistanceToNow(new Date(rule.updated_at), { addSuffix: true, locale: de })}</span>
              </div>
            </div>
            <div className={styles.actions}>
              <Button type="button" variant="outline" size="sm" className={styles.button} onClick={() => props.onEdit(rule)} disabled={!props.canEdit} aria-label={`Regel „${rule.name}“ bearbeiten`}>Bearbeiten</Button>
              <Tooltip><TooltipTrigger asChild><span className="inline-flex" tabIndex={runDisabled ? 0 : undefined}>
                <Button type="button" variant="ghost" size="icon" className={styles.iconButton} disabled={runDisabled} onClick={() => system ? setRunRule(rule) : props.onRun(rule)} aria-label={`Regel „${rule.name}“ jetzt ausführen`}>{props.runningRuleId === rule.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}</Button>
              </span></TooltipTrigger><TooltipContent>{runLabel}</TooltipContent></Tooltip>
              <DropdownMenu>
                <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className={styles.iconButton} aria-label={`Weitere Aktionen für „${rule.name}“`}><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent>Weitere Aktionen</TooltipContent></Tooltip>
                <DropdownMenuContent align="end" className="min-w-52 rounded-xl">
                  <DropdownMenuItem disabled={!props.canEdit || executing} onSelect={() => props.onDryRun(rule)}><Beaker className="mr-2 h-4 w-4" />Testlauf (Simulation)</DropdownMenuItem>
                  <DropdownMenuItem disabled={!props.canEdit} onSelect={() => props.onDuplicate(rule)}><Copy className="mr-2 h-4 w-4" />Duplizieren</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => props.onHistory(rule.id)}><History className="mr-2 h-4 w-4" />Ausführungsverlauf</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => props.onVersions(rule)}><Clock className="mr-2 h-4 w-4" />Versionshistorie</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" disabled={!props.canEdit || system || props.deleting} onSelect={() => setDeleteRule(rule)}><Trash2 className="mr-2 h-4 w-4" />{system ? 'Systemroutine bleibt erhalten' : 'Löschen'}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </article>;
        })}
      </div>
    </section>
    <AlertDialog open={deleteRule !== null} onOpenChange={open => { if (!open) setDeleteRule(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Regel löschen?</AlertDialogTitle><AlertDialogDescription>„{deleteRule?.name}“ wird dauerhaft gelöscht. Wenn die Regel nur vorübergehend aussetzen soll, kannst du sie stattdessen pausieren.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteRule) props.onDelete(deleteRule.id); setDeleteRule(null); }}>Regel löschen</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={runRule !== null} onOpenChange={open => { if (!open) setRunRule(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Systemroutine jetzt ausführen?</AlertDialogTitle><AlertDialogDescription>„{runRule?.name}“ verändert die Personaldaten des Büros. Die Jahresroutine wird höchstens einmal pro Jahr ausgeführt.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction disabled={!props.canEdit || executing || props.paused || props.pauseUnknown || !props.rules.find(rule => rule.id === runRule?.id)?.enabled} onClick={() => { const current = props.rules.find(rule => rule.id === runRule?.id); if (props.canEdit && current?.enabled && !props.paused && !props.pauseUnknown && !executing) props.onRun(current); setRunRule(null); }}>Jetzt ausführen</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </TooltipProvider>;
}
