import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { SocialContentVariant, SocialPlannerItem } from "@/features/redaktion/hooks/useSocialPlannerItems";

interface MarkPublishedDialogProps {
  item: SocialPlannerItem | null;
  channels: Array<{ id: string; name: string; slug: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: {
    publishedAt: string;
    perChannelLinks: Record<string, string>;
  }) => Promise<void>;
}

function nowLocalDatetime(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function MarkPublishedDialog({ item, channels, open, onOpenChange, onConfirm }: MarkPublishedDialogProps) {
  const { toast } = useToast();
  const [publishedAt, setPublishedAt] = useState(nowLocalDatetime());
  const [links, setLinks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setPublishedAt(item.published_at ? item.published_at.slice(0, 16) : nowLocalDatetime());
    const initialLinks: Record<string, string> = {};
    item.channel_ids.forEach((channelId) => {
      const variant: SocialContentVariant | undefined = item.variants[channelId];
      initialLinks[channelId] = variant?.publish_link || item.publish_link || "";
    });
    setLinks(initialLinks);
  }, [item]);

  if (!item) return null;

  const handleConfirm = async () => {
    try {
      setSaving(true);
      await onConfirm({
        publishedAt: new Date(publishedAt).toISOString(),
        perChannelLinks: links,
      });
      toast({ title: "Als veröffentlicht markiert" });
      onOpenChange(false);
    } catch {
      toast({ title: "Fehler beim Markieren", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Als veröffentlicht markieren</DialogTitle>
          <DialogDescription>Trage Veröffentlichungszeit und Links pro Kanal ein.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Veröffentlichungszeit</Label>
            <Input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Links pro Kanal</Label>
            {item.channel_ids.length === 0 && (
              <p className="text-xs text-muted-foreground">Keine Kanäle verknüpft.</p>
            )}
            {item.channel_ids.map((channelId) => {
              const channel = channels.find((c) => c.id === channelId);
              return (
                <div key={channelId} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{channel?.name || channelId}</Label>
                  <Input
                    placeholder="https://…"
                    value={links[channelId] || ""}
                    onChange={(e) => setLinks((prev) => ({ ...prev, [channelId]: e.target.value }))}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={() => void handleConfirm()} disabled={saving}>Markieren</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
