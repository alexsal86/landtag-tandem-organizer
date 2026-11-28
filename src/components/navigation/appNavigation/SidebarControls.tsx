import type { ComponentProps } from "react";
import { Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function SidebarIconButton({ label, className, children, ...props }: ComponentProps<"button"> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} className={cn("mission-icon", className)} {...props}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent className="mission-tooltip" side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function CommandSearchTrigger({ compact }: { compact: boolean }) {
  const openSearch = () => window.dispatchEvent(new CustomEvent("openGlobalSearch"));
  if (compact) {
    return (
      <SidebarIconButton label="Suchen oder Befehl" aria-keyshortcuts="Control+K Meta+K" onClick={openSearch}>
        <Search aria-hidden="true" />
      </SidebarIconButton>
    );
  }
  return (
    <button
      type="button"
      className="mission-search"
      aria-keyshortcuts="Control+K Meta+K"
      onClick={openSearch}
    >
      <Search className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">Suchen oder Befehl …</span>
      <kbd aria-hidden="true">⌘K</kbd>
    </button>
  );
}
