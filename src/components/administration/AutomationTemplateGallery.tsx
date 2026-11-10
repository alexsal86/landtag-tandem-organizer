import { useState } from 'react';
import { RULE_TEMPLATES } from './automationRule/constants';
import { EmptyState } from '@/components/ui-patterns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowRight, ChevronDown, LayoutGrid, Plus, Search } from 'lucide-react';
import { ruleActionLabel, ruleModuleLabel, templateTriggerLabel } from '@/features/automation/rulePresentation';
import styles from './AutomationRulesWorkspace.module.css';

interface AutomationTemplateGalleryProps {
  onUseTemplate: (templateId: string) => void;
  canEdit?: boolean;
}
export function AutomationTemplateGallery({ onUseTemplate, canEdit = true }: AutomationTemplateGalleryProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const modules = [...new Set(RULE_TEMPLATES.map(template => template.module))];
  const filtered = RULE_TEMPLATES.filter(template =>
    (!moduleFilter || template.module === moduleFilter) &&
    [template.name, template.description, ruleModuleLabel(template.module)].join(' ').toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE'))
  );
  return <Collapsible open={open} onOpenChange={setOpen} className={styles.gallery}>
    <CollapsibleTrigger asChild>
      <button type="button" className={styles.galleryHead}>
        <span className={styles.galleryIcon}><LayoutGrid className="h-4 w-4" aria-hidden="true" /></span>
        <span className="min-w-0"><span className={styles.galleryTitle}>Template-Galerie</span><span className={styles.galleryDescription}>Vorgefertigte Regeln mit einem Klick übernehmen</span></span>
        <ChevronDown className={`ml-auto h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className={styles.galleryBody}>
        <div className={styles.galleryTools}>
          <div className={styles.search}><Search aria-hidden="true" /><Input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Templates durchsuchen" aria-label="Templates durchsuchen" /></div>
          <div className={styles.chips} role="group" aria-label="Templates nach Modul filtern">
            <button type="button" aria-pressed={moduleFilter === null} onClick={() => setModuleFilter(null)}>Alle</button>
            {modules.map(module => <button type="button" key={module} aria-pressed={moduleFilter === module} onClick={() => setModuleFilter(module)}>{ruleModuleLabel(module)}</button>)}
          </div>
        </div>
        {filtered.length === 0 ? <EmptyState size="sm" title="Keine Templates gefunden" description="Passe die Suche oder den Modulfilter an." /> : <div className={styles.templateGrid}>
          {filtered.map(template => <article key={template.id} className={styles.template}>
            <h4>{template.name}</h4>
            <p className="line-clamp-2">{template.description}</p>
            <div className={styles.flow}><span>Wenn {templateTriggerLabel(template)}</span><ArrowRight aria-hidden="true" /><span>{template.actions.some(action => action.type === 'run_annual_routine') ? 'Jahresroutine' : ruleActionLabel(template.actions)}</span></div>
            <Button type="button" variant="outline" size="sm" className={`mt-1 w-full gap-2 ${styles.button}`} disabled={!canEdit} onClick={() => onUseTemplate(template.id)} aria-label={`Vorlage „${template.name}“ als Regel übernehmen`}><Plus className="h-4 w-4" aria-hidden="true" />Als Regel übernehmen</Button>
          </article>)}
        </div>}
      </div>
    </CollapsibleContent>
  </Collapsible>;
}
