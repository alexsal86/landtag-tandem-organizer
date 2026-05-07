import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InlineActionsProps {
  children: ReactNode;
  /** Show only on hover of parent group */
  hoverOnly?: boolean;
  className?: string;
}

/**
 * Hover-action bar for list rows. Wrap in a `group` element on the row.
 */
export function InlineActions({ children, hoverOnly = true, className }: InlineActionsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2xs shrink-0 transition-opacity duration-fast ease-standard",
        hoverOnly && "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
        className,
      )}
    >
      {children}
    </div>
  );
}
