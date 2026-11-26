import { useState } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SHORTCUT_HELP } from "./daySlipShorthand";

export function DaySlipCommandHelp() {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Befehle für den Tageszettel anzeigen"
            onClick={() => setOpen(true)}
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-[60] w-80 max-w-[calc(100vw-2rem)] space-y-3 p-4"
        >
          <div>
            <p className="font-semibold">Befehle im Tageszettel</p>
            <p className="mt-1 text-xs text-muted-foreground">Am Zeilenanfang eingeben. Trennlinien mit Enter umwandeln.</p>
          </div>
          <dl className="space-y-3 text-xs">
            <div>
              <dt className="flex items-center justify-between gap-2"><code>---</code><span className="text-muted-foreground">Trennlinie</span></dt>
              <dd className="mt-1.5 rounded border bg-background px-3 py-3" aria-label="Vorschau: einfache Trennlinie"><div className="h-px bg-border" /></dd>
            </div>
            <div>
              <dt><code>--- Überschrift ---</code></dt>
              <dd className="mt-1.5 flex items-center gap-2 rounded border bg-background px-3 py-2" aria-label="Vorschau: Trennlinie mit Überschrift">
                <span className="h-px flex-1 bg-border" /><span>Überschrift</span><span className="h-px flex-1 bg-border" />
              </dd>
            </div>
            <div>
              <dt className="flex items-center justify-between gap-2"><code>! Priorität</code><span className="text-muted-foreground">Gelb markieren</span></dt>
              <dd className="mt-1.5 rounded border border-palette-amber/40 bg-palette-amber/10 px-3 py-2">! Priorität</dd>
            </div>
            <div>
              <dt className="flex items-center justify-between gap-2"><code>!! Wichtig</code><span className="text-muted-foreground">Rot markieren</span></dt>
              <dd className="mt-1.5 rounded border border-priority-high/40 bg-priority-high/10 px-3 py-2">!! Wichtig</dd>
            </div>
          </dl>
          <div className="space-y-1.5 border-t pt-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Kürzel in der Zeile</p>
            {SHORTCUT_HELP.map(entry => (
              <div key={entry.marker} className="flex items-baseline justify-between gap-2 text-xs">
                <code className="shrink-0 rounded border bg-background px-1.5 py-0.5">{entry.marker}</code>
                <span className="text-right text-[11px] text-muted-foreground">{entry.description}</span>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">Wirkt beim Tag abschließen und bleibt in der Zuordnung änderbar.</p>
          </div>
          <p className="border-t pt-2 text-xs text-muted-foreground">Zeile abhaken: links an den Rand klicken oder <code>Alt+Enter</code> in der Zeile drücken.</p>
          <p className="text-xs text-muted-foreground">Text markieren, um die Formatierungsleiste zu öffnen.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
