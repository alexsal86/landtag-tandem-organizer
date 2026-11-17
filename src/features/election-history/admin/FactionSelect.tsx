import { useHistoryFactions } from '../useHistoryFactions';
import { historyError } from '../useElectionHistory';
export function FactionSelect({ id, value, onChange, disabled, required = false }: { id: string; value: string; onChange: (value: string) => void; disabled?: boolean; required?: boolean }) {
  const query = useHistoryFactions();
  return <div className="min-w-0"><select id={id} required={required} disabled={disabled || query.isLoading || !!query.error} value={value} onChange={e => onChange(e.target.value)} className="h-9 min-w-0 w-full max-w-full rounded-md border border-input bg-background px-2 text-sm">
    <option value="">{query.isLoading ? 'Verzeichnis wird geladen …' : required ? 'Partei / Fraktion auswählen' : 'Keine zusätzliche Zuordnung'}</option>
    {value && query.data && !query.data.some(f => f.name === value) && <option value={value} disabled>{value} · bitte zuordnen</option>}
    {query.data?.filter(f => f.is_active || f.name === value).map(f => <option key={f.id} value={f.name}>{f.name}{f.is_active ? '' : ' (inaktiv)'}</option>)}
  </select>{query.error && <p role="alert" className="text-xs text-destructive">{historyError(query.error)} <button type="button" className="underline" onClick={() => void query.refetch()}>Erneut laden</button></p>}</div>;
}
