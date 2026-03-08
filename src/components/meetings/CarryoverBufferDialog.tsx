import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AgendaItem } from './types';

interface CarryoverBufferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: AgendaItem[];
}

export function CarryoverBufferDialog({ open, onOpenChange, items }: CarryoverBufferDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zwischenspeicher: Übertragene Punkte</DialogTitle>
          <DialogDescription>
            Diese Punkte wurden auf die nächste Sitzung vorgemerkt und bleiben im Zwischenspeicher, bis sie in einer erfolgreich beendeten Besprechung behandelt wurden.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine übertragenen Punkte im Zwischenspeicher.</p>
          ) : items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-3 space-y-1">
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground">Ursprung: {item.original_meeting_title || 'Unbekannt'} ({item.original_meeting_date || '-'})</p>
                {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
