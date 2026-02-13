import { HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Hilfe & Tastenkürzel
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-2">Globale Tastenkürzel</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span>Suche öffnen</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl + K</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Neuer Termin</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl + Shift + T</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Neue Aufgabe</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl + Shift + A</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Neue Notiz</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl + .</kbd>
              </div>
            </div>
          </div>
          <Separator />
          <div>
            <h4 className="font-medium text-sm mb-2">Navigation</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Klicken Sie auf ein Menüsymbol, um zur entsprechenden Seite zu wechseln.</p>
              <p>• Rote Badges zeigen neue oder ungelesene Elemente an.</p>
              <p>• In der Kartenansicht können Sie mit Hover weitere Aktionen sehen.</p>
            </div>
          </div>
          <Separator />
          <div>
            <h4 className="font-medium text-sm mb-2">Weitere Hilfe</h4>
            <p className="text-sm text-muted-foreground">
              Bei Fragen oder Problemen wenden Sie sich an Ihren Administrator.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
