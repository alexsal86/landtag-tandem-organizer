import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTopicBacklog } from "@/hooks/useTopicBacklog";
import { useToast } from "@/hooks/use-toast";

interface TransferToThemenspeicherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillTitle?: string;
  prefillDescription?: string;
  prefillTags?: string;
  onTransferred?: () => void;
}

export function TransferToThemenspeicherDialog({
  open,
  onOpenChange,
  prefillTitle = "",
  prefillDescription = "",
  prefillTags = "",
  onTransferred,
}: TransferToThemenspeicherDialogProps) {
  const { createTopic } = useTopicBacklog();
  const { toast } = useToast();
  const [title, setTitle] = useState(prefillTitle);
  const [tags, setTags] = useState(prefillTags);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset when dialog opens with new prefill
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setTitle(prefillTitle);
      setTags(prefillTags);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      const parsedTags = tags.split(",").map(t => t.trim()).filter(Boolean);
      await createTopic({ topic: title.trim(), tags: parsedTags, status: "idea", priority: 1 });
      toast({ title: "In Themenspeicher übernommen", description: `"${title.trim()}" wurde als Thema angelegt.` });
      onTransferred?.();
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Fehler", description: "Thema konnte nicht erstellt werden.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>In Themenspeicher übernehmen</DialogTitle>
          <DialogDescription>Erstelle ein neues Thema im Themenspeicher aus diesem Inhalt.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="thema-title">Thema</Label>
            <Input id="thema-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Thema eingeben…" />
          </div>
          <div>
            <Label htmlFor="thema-tags">Tags (optional, komma-separiert)</Label>
            <Input id="thema-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="bildung, kommune" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !title.trim()}>Übernehmen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
