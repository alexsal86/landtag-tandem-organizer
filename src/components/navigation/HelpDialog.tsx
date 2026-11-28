import { HelpCircle } from "lucide-react";
import { matchPath, useLocation } from "react-router-dom";
import { EMPLOYEE_MEETING_HELP_CONTENT, MYWORK_HELP_CONTENT } from "@/config/helpContent";
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
  onFollowHint?: () => void;
}

export function HelpDialog({ open, onOpenChange, onFollowHint }: HelpDialogProps) {
  const { pathname, search } = useLocation();
  const tab = new URLSearchParams(search).get("tab") ?? "dashboard";
  const pageHelp = matchPath("/mywork", pathname) && Object.hasOwn(MYWORK_HELP_CONTENT, tab)
    ? MYWORK_HELP_CONTENT[tab]
    : matchPath("/employee-meeting/:meetingId", pathname) ? EMPLOYEE_MEETING_HELP_CONTENT : undefined;

  const highlightTarget = (targetId: string) => {
    const target = document.querySelector<HTMLElement>(`[data-help-id="${targetId}"]`);
    if (!target) return;

    onOpenChange(false);
    onFollowHint?.();
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      target.classList.add("ring-2", "ring-primary", "ring-offset-2", "animate-pulse");
      window.setTimeout(() => {
        target.classList.remove("ring-2", "ring-primary", "ring-offset-2", "animate-pulse");
      }, 1800);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Hilfe & Tastenkürzel
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {pageHelp && (
            <>
              <section>
                <h3 className="mb-2 text-sm font-medium">{pageHelp.title}</h3>
                <p className="text-sm text-muted-foreground">{pageHelp.description}</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                  {pageHelp.features.map((feature) => {
                    const { label, targetId } = typeof feature === "string" ? { label: feature } : feature;
                    const linkedTarget = targetId && open && document.querySelector(`[data-help-id="${targetId}"]`) ? targetId : undefined;
                    return (
                      <li key={label}>
                        {linkedTarget ? (
                          <button type="button" className="text-left underline decoration-dotted underline-offset-2 hover:text-foreground"
                            onClick={() => highlightTarget(linkedTarget)}>
                            {label}
                          </button>
                        ) : label}
                      </li>
                    );
                  })}
                </ul>
              </section>
              <Separator />
            </>
          )}
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
              <div className="flex justify-between items-center">
                <span>Neue Terminanfrage</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl + Shift + .</kbd>
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
