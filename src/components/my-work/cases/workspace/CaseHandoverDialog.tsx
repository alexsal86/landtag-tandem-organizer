import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CaseItem, TeamUser } from "@/components/my-work/hooks/useCaseWorkspaceData";

/** Offene Vorgänge, deren nächster Schritt bei dieser Person liegt. */
export function handoverCandidates(items: CaseItem[], fromUserId: string): CaseItem[] {
  return items.filter((i) => i.status !== "erledigt" && i.status !== "archiviert" && (i.next_action_assignee_id ?? i.owner_user_id) === fromUserId);
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CaseItem[];
  teamUsers: TeamUser[];
  onConfirm: (ids: string[], toUserId: string) => Promise<void>;
};

export function CaseHandoverDialog({ open, onOpenChange, items, teamUsers, onConfirm }: Props) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const candidates = useMemo(() => (from ? handoverCandidates(items, from) : []), [items, from]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vorgänge an Vertretung übergeben</DialogTitle>
          <DialogDescription>Die nächsten Schritte aller offenen Vorgänge einer Person gehen an die Vertretung.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger aria-label="Von"><SelectValue placeholder="Von (abwesende Person)" /></SelectTrigger>
            <SelectContent>{teamUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger aria-label="An"><SelectValue placeholder="An (Vertretung)" /></SelectTrigger>
            <SelectContent>{teamUsers.filter((u) => u.id !== from).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
          </Select>
          {from && <p className="text-sm text-muted-foreground">{candidates.length} offene Vorgänge betroffen.</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button
            disabled={!from || !to || candidates.length === 0 || busy}
            onClick={async () => {
              setBusy(true);
              try { await onConfirm(candidates.map((c) => c.id), to); onOpenChange(false); setFrom(""); setTo(""); } finally { setBusy(false); }
            }}
          >
            Übergeben
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
