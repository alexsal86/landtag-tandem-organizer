import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Tag, FileText, Send } from "lucide-react";

interface GhostPublishDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  pressRelease: {
    title: string;
    excerpt?: string | null;
    tags?: string[] | null;
    slug?: string | null;
    meta_title?: string | null;
    meta_description?: string | null;
  };
}

export function GhostPublishDialog({ isOpen, onClose, onConfirm, isLoading, pressRelease }: GhostPublishDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            An Ghost veröffentlichen
          </DialogTitle>
          <DialogDescription>
            Bitte überprüfen Sie die Daten vor der Veröffentlichung.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Titel</p>
            <p className="font-semibold">{pressRelease.title}</p>
          </div>

          {pressRelease.excerpt && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Kurzfassung</p>
              <p className="text-sm">{pressRelease.excerpt}</p>
            </div>
          )}

          {pressRelease.slug && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">URL-Slug</p>
              <p className="text-sm font-mono text-muted-foreground">/{pressRelease.slug}</p>
            </div>
          )}

          {pressRelease.tags && pressRelease.tags.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Tag className="h-3 w-3" /> Tags
              </p>
              <div className="flex flex-wrap gap-1">
                {pressRelease.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {pressRelease.meta_title && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">SEO-Titel</p>
              <p className="text-sm">{pressRelease.meta_title}</p>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <Globe className="h-4 w-4 inline mr-1" />
              Die Pressemitteilung wird direkt auf Ihrer Webseite veröffentlicht.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Abbrechen
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            <Send className="h-4 w-4 mr-2" />
            {isLoading ? "Wird veröffentlicht..." : "Jetzt veröffentlichen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
