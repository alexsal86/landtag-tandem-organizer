import { openAppointmentRequestCreate } from "@/features/appointment-requests/events";
import { useRef } from "react";
import {
  MessageCircleQuestion,
  FilePenLine,
  Plus,
  CalendarClock,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useActionPermission } from "@/hooks/useActionPermission";
import {
  openKnowledgeQuestion,
  KNOWLEDGE_QUESTION_SHORTCUT,
} from "@/features/knowledge/globalQuestion";

export function GlobalCreateMenu() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { allowed } = useActionPermission("knowledge.write");
  const nextAction = useRef<(() => void) | null>(null);
  if (!user || !currentTenant) return null;
  return (
    <DropdownMenu>
      {/* Rendered without `asChild` on purpose: nesting Button inside the trigger
          stacks two Radix Slots, and the duplicated ref composition loops under React 19. */}
      <DropdownMenuTrigger
        type="button"
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 shrink-0")}
        aria-label="Globales Erstellen-Menü öffnen"
        title="Erstellen"
      >
        <Plus className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onCloseAutoFocus={() => {
          const action = nextAction.current;
          nextAction.current = null;
          // Let the menu return focus to its trigger before the dialog captures it.
          if (action) window.setTimeout(action, 0);
        }}
      >
        <DropdownMenuLabel>Erstellen</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            nextAction.current = () =>
              window.dispatchEvent(new Event("openGlobalQuickNote"));
          }}
        >
          <FilePenLine className="mr-2 h-4 w-4" aria-hidden="true" />
          Schnelle Notiz
        </DropdownMenuItem>
        <DropdownMenuItem
          aria-keyshortcuts="Control+Shift+. Meta+Shift+."
          onSelect={() => {
            nextAction.current = () => openAppointmentRequestCreate();
          }}
        >
          <CalendarClock className="mr-2 h-4 w-4" aria-hidden="true" />
          <span className="flex flex-col">
            <span>Terminanfrage vormerken</span>
            <span className="text-xs text-muted-foreground">
              Strg/⌘ + Umschalt + .
            </span>
          </span>
        </DropdownMenuItem>
        {allowed && (
          <DropdownMenuItem
            aria-keyshortcuts="Control+Alt+F Meta+Alt+F"
            onSelect={() => {
              nextAction.current = () => openKnowledgeQuestion();
            }}
          >
            <MessageCircleQuestion
              className="mr-2 h-4 w-4"
              aria-hidden="true"
            />
            <span className="flex flex-col">
              <span>Wissensfrage stellen</span>
              <span className="text-xs text-muted-foreground">
                {KNOWLEDGE_QUESTION_SHORTCUT}
              </span>
            </span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
