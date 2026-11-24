import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { batchPreviewSummary, describeBatchItem, groupBatchSkips, TASK_BATCH_LABELS, type TaskBatchPreview } from "@/features/tasks/stafette";

interface Props {
  preview: TaskBatchPreview | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Shows what a batch action will change and what it will skip before anything is written. */
export function TaskBatchDialog({ preview, pending, onCancel, onConfirm }: Props) {
  const actionable = preview?.items.filter((item) => item.eligible) ?? [];
  const skipped = preview ? groupBatchSkips(preview.items) : [];

  return (
    <Dialog open={!!preview} onOpenChange={(open) => { if (!open && !pending) onCancel(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{preview ? TASK_BATCH_LABELS[preview.action] : ""}</DialogTitle>
          <DialogDescription>{preview ? `${batchPreviewSummary(preview)}. Nichts wird ohne diese Bestätigung geändert.` : ""}</DialogDescription>
        </DialogHeader>

        {actionable.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Wird übernommen</p>
            <ul className="max-h-56 space-y-1 overflow-y-auto pr-1 text-sm">
              {actionable.map((item) => (
                <li key={item.task_id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{item.title ?? "Aufgabe"}</span>
                  <span className="text-xs text-muted-foreground">{preview && describeBatchItem(item, preview.action)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {skipped.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Wird übersprungen</p>
            <ul className="space-y-1 text-sm">
              {skipped.map(({ reason, count }) => (
                <li key={reason} className="flex items-center gap-2">
                  <Badge variant="secondary" className="tabular-nums">{count}</Badge>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>Abbrechen</Button>
          <Button onClick={onConfirm} disabled={pending || actionable.length === 0}>
            {actionable.length === 1 ? "1 Aufgabe übernehmen" : `${actionable.length} Aufgaben übernehmen`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
