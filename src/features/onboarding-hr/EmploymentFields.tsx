import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenantUsers } from '@/hooks/useTenantUsers';
import { useHrData } from './useHrData';
import type { HrTemplateStep } from './templates';

export interface EmploymentValues {
  type: string;
  start: string;
  end: string;
  mentor: string;
}
export const emptyEmployment: EmploymentValues = { type: 'praktikum', start: '', end: '', mentor: 'none' };

export function EmploymentFields({ value, onChange }: { value: EmploymentValues; onChange: (value: EmploymentValues) => void }) {
  const { users } = useTenantUsers();
  const model = useHrData();
  const change = (patch: Partial<EmploymentValues>) => onChange({ ...value, ...patch });
  const types = [...new Set(['praktikum', 'hilfskraft', 'referent', ...(model.data?.templates.map(t => t.employment_type).filter(t => t !== 'all') ?? [])])];
  const templates = (model.data?.templates ?? []).filter(t => t.employment_type === value.type || t.employment_type === 'all');
  const selected = ['onboarding', ...(value.end ? ['offboarding'] : [])].map(direction =>
    templates.find(t => t.direction === direction && t.employment_type === value.type) ?? templates.find(t => t.direction === direction && t.employment_type === 'all'),
  ).filter(t => !!t);
  const needsEnd = value.type === 'praktikum' || selected.some(t => t.direction === 'onboarding' && (t.steps as unknown as HrTemplateStep[]).some(step => step.anchor === 'end'));
  return <fieldset className="space-y-3 rounded-lg border p-4">
    <legend className="px-1 font-semibold">Beschäftigung & HR-Ablauf</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      <Label>Beschäftigungsart<Select value={value.type} onValueChange={type => change({ type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{types.map(type => <SelectItem key={type} value={type}>{type === 'praktikum' ? 'Praktikum' : type === 'hilfskraft' ? 'Hilfskraft' : type === 'referent' ? 'Referent:in' : type}</SelectItem>)}</SelectContent></Select></Label>
      <Label>Eintritt *<Input required type="date" value={value.start} onChange={e => change({ start: e.target.value })} /></Label>
      <Label>Austritt {needsEnd ? '*' : '(optional)'}<Input required={needsEnd} type="date" min={value.start} value={value.end} onChange={e => change({ end: e.target.value })} /></Label>
      <Label>Mentor:in<Select value={value.mentor} onValueChange={mentor => change({ mentor })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Noch nicht zugewiesen</SelectItem>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.display_name}</SelectItem>)}</SelectContent></Select></Label>
    </div>
    <p className="text-sm text-muted-foreground">Das Onboarding wird beim Speichern automatisch angelegt. Mit einem Austrittsdatum startet auch das Offboarding. Pflichtpunkte und Nachweise werden anschließend im HR-Bereich bearbeitet. Laufende Abläufe behalten ihre ursprünglichen Termine und Vorlagen.</p>
    {model.isLoading && <p className="text-sm">HR-Vorlagen werden geladen …</p>}
    {model.error && <p role="alert" className="text-sm text-destructive">HR-Vorlagen konnten nicht geladen werden.</p>}
    {selected.map(template => <div key={template.id} className="text-sm space-y-1"><strong>{template.direction === 'onboarding' ? 'Onboarding' : 'Offboarding'}: {template.name}</strong><ul className="list-disc pl-5">{(template.steps as unknown as HrTemplateStep[]).map((step, i) => <li key={i}>{step.title} · {step.is_mandatory ? 'Pflicht' : 'Optional'}</li>)}</ul></div>)}
  </fieldset>;
}
