import { useRef } from "react";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useGlobalCreateActions } from "./globalCreateActions";

export function GlobalCreateMenu({ compact = false }: { compact?: boolean }) {
  const actions = useGlobalCreateActions();
  const nextAction = useRef<(() => void) | null>(null);
  if (!actions.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={compact ? "mission-icon" : cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}
        aria-label="Globales Erstellen-Menü öffnen"
        title="Erstellen"
      >
        <Plus className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onCloseAutoFocus={() => {
          const action = nextAction.current;
          nextAction.current = null;
          if (action) window.setTimeout(action, 0);
        }}
      >
        <DropdownMenuLabel>Erstellen</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map(action => (
          <DropdownMenuItem key={action.id} aria-keyshortcuts={action.ariaShortcut} onSelect={() => {
            nextAction.current = () => action.run();
          }}>
            <action.icon className="mr-2 size-4" aria-hidden="true" />
            <span className="flex flex-col">
              <span>{action.label}</span>
              <span className="font-mono text-xs text-muted-foreground">{action.shortcut}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
