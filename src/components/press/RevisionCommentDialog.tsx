import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

interface RevisionCommentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
  isLoading?: boolean;
}

export function RevisionCommentDialog({ isOpen, onClose, onSubmit, isLoading }: RevisionCommentDialogProps) {
  const [comment, setComment] = useState("");

  const handleSubmit = () => {
    if (!comment.trim()) return;
    onSubmit(comment.trim());
    setComment("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Pressemitteilung zurückweisen
          </DialogTitle>
          <DialogDescription>
            Bitte geben Sie einen Kommentar mit den gewünschten Änderungen ein.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="revision-comment">Änderungswünsche</Label>
            <Textarea
              id="revision-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Beschreiben Sie die gewünschten Änderungen..."
              rows={4}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!comment.trim() || isLoading}
            variant="destructive"
          >
            {isLoading ? "Wird gesendet..." : "Zurückweisen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
