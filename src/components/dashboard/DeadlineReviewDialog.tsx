import { useState } from 'react';
import { format, startOfDay } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDeadlineActions, type DeadlineAction } from '@/hooks/useDeadlineActions';
import { performSnooze } from '@/hooks/useSnoozeDeadline';
import { useQueryClient } from '@tanstack/react-query';
import { notify } from '@/lib/notify';
import { formatDeadlineDateLabel, getDeadlineContextLabel } from '@/utils/deadlineFormatting';
import type { DeadlineItem } from '@/types/dashboardDeadlines';

export function DeadlineReviewDialog({ items, open, onOpenChange }: { items: DeadlineItem[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState('');
  const [moving, setMoving] = useState(false);
  const actions = useDeadlineActions();
  const queryClient = useQueryClient();
  const key = (item: DeadlineItem) => `${item.type}-${item.id}`;
  const editable = items.filter(item => item.canSnooze);
  const selection = editable.filter(item => selected.has(key(item)));
  const busy = actions.isPending || moving;
  const toggle = (id: string) => setSelected(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const apply = async (action: DeadlineAction) => {
    await actions.mutateAsync({ items: selection, action });
    setSelected(new Set());
  };
  const move = async () => {
    if (!date || date < format(new Date(), 'yyyy-MM-dd')) return;
    setMoving(true);
    try {
      let moved = 0;
      const failures: string[] = [];
      for (const item of selection) {
        try {
          await performSnooze({ item, newDate: startOfDay(new Date(`${date}T00:00:00`)) });
          moved++;
        } catch (error) {
          failures.push(`${item.title}: ${error instanceof Error ? error.message : 'Speichern fehlgeschlagen'}`);
        }
      }
      await queryClient.invalidateQueries();
      if (moved) notify.success(`${moved} ${moved === 1 ? 'Frist verschoben' : 'Fristen verschoben'}`);
      if (failures.length) notify.error(`${failures.length} Fristen konnten nicht verschoben werden`, { description: failures.join('\n'), duration: 15000 });
      setSelected(new Set());
    } finally { setMoving(false); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!busy) { onOpenChange(value); setSelected(new Set()); } }}>
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Alte Fristen prüfen</DialogTitle>
        <DialogDescription>Fristen seit mehr als 30 Tagen überfällig. „Erledigt“ schließt den zugehörigen Eintrag ab; bei Notizen nur die Wiedervorlage. „Verwerfen“ entfernt nur die Frist und kann rückgängig gemacht werden. Veranstaltungstermine bleiben bestehen.</DialogDescription>
      </DialogHeader>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" disabled={busy || !editable.length} checked={editable.length > 0 && selection.length === editable.length} onChange={e => setSelected(e.target.checked ? new Set(editable.map(key)) : new Set())} />
        Alle bearbeitbaren Fristen auswählen ({editable.length})
      </label>
      <div className="max-h-[45vh] overflow-y-auto divide-y">
        {items.length === 0 && <p className="py-4 text-sm text-muted-foreground">Keine alten Fristen mehr offen.</p>}
        {items.map(item => <label key={key(item)} className="flex items-start gap-3 py-3">
          <input type="checkbox" className="mt-1" disabled={busy || !item.canSnooze} checked={selected.has(key(item))} onChange={() => toggle(key(item))} />
          <span className="min-w-0 text-sm"><span className="block break-words font-medium">{item.title}</span><span className="text-muted-foreground">{getDeadlineContextLabel(item.type)} · {formatDeadlineDateLabel(item.dueDate)}{!item.canSnooze && ' · Nur lesbar'}</span></span>
        </label>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-full text-sm text-muted-foreground" aria-live="polite">{selection.length} ausgewählt</span>
        <Button disabled={busy || !selection.length} onClick={() => void apply('complete')}>Erledigt</Button>
        <Button variant="outline" disabled={busy || !selection.length} onClick={() => void apply('discard')}>Verwerfen</Button>
        <label className="text-sm" htmlFor="deadline-review-date">Neue Frist</label>
        <Input id="deadline-review-date" type="date" className="w-auto" min={format(new Date(), 'yyyy-MM-dd')} value={date} disabled={busy} onChange={e => setDate(e.target.value)} />
        <Button variant="outline" disabled={busy || !selection.length || !date || date < format(new Date(), 'yyyy-MM-dd')} onClick={() => void move()}>Neue Frist setzen</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
