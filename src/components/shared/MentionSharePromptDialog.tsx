import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface MentionedUser {
  id: string;
  displayName: string;
}

interface MentionSharePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: MentionedUser[];
  onConfirm: (userIds: string[], permission: "view" | "edit") => Promise<void>;
}

export const MentionSharePromptDialog = ({
  open,
  onOpenChange,
  users,
  onConfirm,
}: MentionSharePromptDialogProps) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [permission, setPermission] = useState<"view" | "edit">("edit");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(users.map((user) => user.id));
    setPermission("edit");
  }, [open, users]);

  const handleToggle = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(selectedIds, permission);
    } finally {
      setSubmitting(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Erwähnte Personen freigeben?</DialogTitle>
          <DialogDescription>
            Du hast Personen in der Notiz erwähnt. Möchtest du die Notiz direkt für sie
            freigeben?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.includes(user.id)}
                  onCheckedChange={() => handleToggle(user.id)}
                />
                <span className="text-sm">{user.displayName}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Berechtigung</Label>
            <Select
              value={permission}
              onValueChange={(value) => setPermission(value as "view" | "edit")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="edit">Bearbeiten</SelectItem>
                <SelectItem value="view">Ansicht</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Nicht freigeben
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || selectedIds.length === 0}>
            Freigeben
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
