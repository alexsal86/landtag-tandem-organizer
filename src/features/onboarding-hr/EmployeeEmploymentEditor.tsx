import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmploymentFields, type EmploymentValues } from './EmploymentFields';
import { useHrData } from './useHrData';

export function EmployeeEmploymentEditor({ userId, startDate, onSaved }: { userId: string; startDate: string | null; onSaved: (start: string) => void }) {
  const model = useHrData();
  const [draft, setDraft] = useState<EmploymentValues | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const employment = model.data?.employment.find(e => e.user_id === userId);
  const value = draft ?? { type: employment?.employment_type ?? 'referent', start: employment?.start_date ?? startDate ?? '', end: employment?.end_date ?? '', mentor: employment?.mentor_user_id ?? 'none' };
  return <form className="space-y-3" onSubmit={async e => {
    e.preventDefault();
    if (!model.tenantId || !model.data) return;
    setError(''); setSaved(false);
    try {
      await model.mutation.mutateAsync({ name: 'save_employee_lifecycle', args: { p_tenant: model.tenantId, p_user: userId, p_type: value.type, p_start: value.start, p_end: value.end || undefined, p_mentor: value.mentor === 'none' ? undefined : value.mentor, p_id: employment?.id } });
      onSaved(value.start); setDraft(null); setSaved(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Beschäftigung konnte nicht gespeichert werden.'); }
  }}>
    <EmploymentFields value={value} onChange={next => { setDraft(next); setSaved(false); }} />
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {saved && <p role="status">Beschäftigung und HR-Abläufe gespeichert.</p>}
    <Button type="submit" disabled={!model.data || model.mutation.isPending || !value.start}>Beschäftigung speichern</Button>
  </form>;
}
