import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WorkspaceToolbar({ children, actions, className }: {
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full shrink-0 items-center gap-3 px-4 pb-2 pt-4 md:px-6 lg:px-8", children && "flex-col items-end sm:flex-row sm:items-center", className)}>
      {children}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          aria-label="Global suchen"
          aria-keyshortcuts="Control+K Meta+K"
          className="workspace-search-trigger size-11 rounded-full border-border/80 bg-card/90 p-0 text-muted-foreground shadow-sm hover:border-[#2e6018] hover:bg-card/90 hover:text-muted-foreground lg:w-auto lg:px-4"
          onClick={() => window.dispatchEvent(new CustomEvent("openGlobalSearch"))}
        >
          <Search aria-hidden="true" />
          <span className="hidden lg:inline">Suchen</span>
          <kbd aria-hidden="true" className="hidden rounded-md bg-muted px-1.5 text-xs xl:inline">⌘K</kbd>
        </Button>
        <NotificationBell variant="island" />
        {actions}
      </div>
    </div>
  );
}
