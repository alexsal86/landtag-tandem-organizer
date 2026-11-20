import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { agendaIconColors, agendaIcons, resolveAgendaIcon, type AgendaIconConfig } from "./agendaIcons";

export function AgendaIcon({ value, linkedTask }: { value?: unknown; linkedTask?: boolean }) {
  const config = resolveAgendaIcon(value, linkedTask);
  const Icon = agendaIcons[config.name as keyof typeof agendaIcons].icon;
  const color = agendaIconColors.find(({ value }) => value === config.color);
  return (
    <span aria-hidden="true" className={cn("grid size-8 shrink-0 place-items-center rounded-lg", color?.darkIcon ? "text-slate-950" : "text-white")} style={{ backgroundColor: config.color }}>
      <Icon className="size-4" />
    </span>
  );
}

export function AgendaIconPicker({ value, linkedTask, onChange }: {
  value?: unknown;
  linkedTask?: boolean;
  onChange: (config: AgendaIconConfig | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AgendaIconConfig>(() => resolveAgendaIcon(value, linkedTask));
  return (
    <Popover open={open} onOpenChange={(next) => {
      if (next) setDraft(resolveAgendaIcon(value, linkedTask));
      setOpen(next);
    }}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-auto gap-2 p-1 pr-2">
          <AgendaIcon value={value} linkedTask={linkedTask} />
          Symbol ändern
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)] space-y-3">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Symbol</legend>
          <div className="grid grid-cols-5 gap-1">
            {Object.entries(agendaIcons).map(([name, { icon: Icon, label }]) => (
              <Button key={name} type="button" size="icon" variant={draft.name === name ? "secondary" : "ghost"}
                aria-label={label} title={label} aria-pressed={draft.name === name}
                onClick={() => setDraft({ ...draft, name })}>
                <Icon className="size-4" />
              </Button>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Hintergrundfarbe</legend>
          <div className="grid grid-cols-6 justify-items-center gap-1.5">
            {agendaIconColors.map(({ value, label, darkIcon }) => (
              <button key={value} type="button" aria-label={label} title={label} aria-pressed={value === draft.color}
                className={cn("grid size-7 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", darkIcon ? "text-slate-950" : "text-white", value === draft.color && "ring-2 ring-ring ring-offset-2 ring-offset-background")}
                style={{ backgroundColor: value }} onClick={() => setDraft({ ...draft, color: value })}>
                {value === draft.color && <Check className="size-4" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center justify-between gap-2">
          <AgendaIcon value={draft} />
          <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(null); setOpen(false); }}>Standard</Button>
          <Button type="button" size="sm" onClick={() => { onChange(draft); setOpen(false); }}>Übernehmen</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
