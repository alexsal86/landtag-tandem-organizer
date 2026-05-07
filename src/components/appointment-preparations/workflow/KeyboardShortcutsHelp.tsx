import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS: Array<{ keys: string; label: string }> = [
  { keys: "⌘ →", label: "Nächste Phase" },
  { keys: "⌘ ←", label: "Vorherige Phase" },
  { keys: "⌘ F", label: "Fokus-Modus umschalten" },
  { keys: "⌘ B", label: "Briefing-Ansicht öffnen" },
  { keys: "?", label: "Diese Hilfe öffnen" },
];

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tastatur-Kürzel</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <kbd className="px-2 py-0.5 text-xs font-mono rounded border bg-muted">{s.keys}</kbd>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Auf Windows/Linux: <kbd className="font-mono">Strg</kbd> statt <kbd className="font-mono">⌘</kbd>.
        </p>
      </DialogContent>
    </Dialog>
  );
}
