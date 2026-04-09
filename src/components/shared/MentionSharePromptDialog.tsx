import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";

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
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(
        users.map((u) => u.id),
        "edit"
      );
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
            Du hast folgende Personen erwähnt. Möchtest du die Notiz direkt für sie freigeben?
          </DialogDescription>
        </DialogHeader>

        <ul className="list-disc pl-5 space-y-1 text-sm">
          {users.map((user) => (
            <li key={user.id}>{user.displayName}</li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Nicht freigeben
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            Freigeben
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
