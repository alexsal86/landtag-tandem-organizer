import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type DraftRow = { faction: string; seats: string | number };
export function SeatDistributionEditor({ id, value, disabled, onChange }: { id: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  let rows: DraftRow[] = [];
  try { const parsed = JSON.parse(value || '[]'); if (Array.isArray(parsed)) rows = parsed; } catch { /* A malformed draft remains protected by save validation. */ }
  const update = (index: number, changes: Partial<DraftRow>) => onChange(JSON.stringify(rows.map((row, i) => i === index ? { ...row, ...changes } : row)));
  const sum = rows.reduce((n, row) => n + (/^\d+$/.test(String(row.seats)) ? Number(row.seats) : 0), 0);
  return <div className="min-w-0 space-y-3">
    {rows.map((row, index) => <div key={index} className="grid min-w-0 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto]">
      <div className="min-w-0"><Label htmlFor={index === 0 ? id : `${id}-${index}-faction`}>Partei / Fraktion</Label><Input id={index === 0 ? id : `${id}-${index}-faction`} value={row.faction} disabled={disabled} maxLength={100} onChange={event => update(index, { faction: event.target.value })} /></div>
      <div className="min-w-0"><Label htmlFor={`${id}-${index}-seats`}>Sitze</Label><Input id={`${id}-${index}-seats`} type="number" min={0} max={1000} step={1} value={row.seats} disabled={disabled} onChange={event => update(index, { seats: event.target.value })} /></div>
      <Button type="button" variant="outline" className="max-w-full" disabled={disabled} aria-label={`${row.faction || 'Eintrag'} entfernen`} onClick={() => onChange(JSON.stringify(rows.filter((_, i) => i !== index)))}>Entfernen</Button>
    </div>)}
    <div className="flex flex-wrap items-center gap-3"><Button id={rows.length ? `${id}-add` : id} type="button" variant="outline" className="h-auto max-w-full whitespace-normal" disabled={disabled || rows.length >= 30} onClick={() => onChange(JSON.stringify([...rows, { faction: '', seats: '' }]))}>Partei / Fraktion ergänzen</Button><span className="text-sm tabular-nums">Summe der Eingaben: {sum}</span></div>
    <p className="text-xs text-muted-foreground">Die Gesamtsitzzahl wird separat erfasst. Noch nicht zugeordnete Sitze bleiben als unvollständige Verteilung erkennbar.</p>
  </div>;
}
