import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
export function AgendaSystemRow({
  children,
  selected,
  hasSelectedChild,
  liveCurrent,
}: {
  children: ReactNode;
  selected: boolean;
  hasSelectedChild: boolean;
  liveCurrent?: boolean;
}) {
  return (
    <div
      data-selected={selected}
      className={cn(
        "group min-w-0 border-b border-b-[color:var(--agenda-row-divider)] dark:border-b-border border-l-[3px] border-l-transparent",
        selected && "border-l-primary",
        hasSelectedChild && "border-l-success",
        liveCurrent && "border-l-success",
      )}
    >
      {children}
    </div>
  );
}
