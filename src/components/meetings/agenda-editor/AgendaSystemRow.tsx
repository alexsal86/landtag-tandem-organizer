import type { ReactNode } from "react";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { AgendaDragHandle } from "./AgendaDragHandle";
import { cn } from "@/lib/utils";
export function AgendaSystemRow({
  children,
  dragHandleProps,
  canEdit,
  dragging,
  selected,
  hasSelectedChild,
  nested,
}: {
  children: ReactNode;
  dragHandleProps: DraggableProvidedDragHandleProps | null;
  canEdit: boolean;
  dragging: boolean;
  selected: boolean;
  hasSelectedChild: boolean;
  nested: boolean;
}) {
  return (
    <div
      data-selected={selected}
      className={cn(
        "group flex min-w-0 border-b border-b-[color:var(--agenda-row-divider)] dark:border-b-border border-l-[3px] border-l-transparent pl-4 transition-colors hover:bg-muted/40",
        nested && "bg-[var(--agenda-subpoint-bg)] hover:bg-[var(--agenda-subpoint-bg)] dark:bg-slate-800 dark:hover:bg-slate-700",
        selected && (nested ? "border-l-primary" : "border-l-primary bg-primary/10 hover:bg-primary/10"),
        hasSelectedChild && "border-l-success",
      )}
    >
      {canEdit && dragHandleProps && (
        <AgendaDragHandle dragHandleProps={dragHandleProps} dragging={dragging} className="mt-2 self-start" />
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
