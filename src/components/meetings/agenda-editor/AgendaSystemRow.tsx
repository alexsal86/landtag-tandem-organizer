import type { ReactNode } from "react";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
export function AgendaSystemRow({
  children,
  dragHandleProps,
  canEdit,
  selected,
  nested,
}: {
  children: ReactNode;
  dragHandleProps: DraggableProvidedDragHandleProps | null;
  canEdit: boolean;
  selected: boolean;
  nested: boolean;
}) {
  return (
    <div
      data-selected={selected}
      className={cn(
        "group flex min-w-0 border-b border-b-[color:var(--agenda-row-divider)] dark:border-b-border border-l-[3px] border-l-transparent pl-1 transition-colors hover:bg-muted/40",
        nested && "bg-[var(--agenda-subpoint-bg)] hover:bg-[var(--agenda-subpoint-bg)] dark:bg-slate-800 dark:hover:bg-slate-700",
        selected && (nested ? "border-l-primary" : "border-l-primary bg-primary/10 hover:bg-primary/10"),
      )}
    >
      {canEdit && (
        <div
          {...dragHandleProps}
          aria-label="Baustein verschieben"
          className="mt-3 mr-2 flex h-8 shrink-0 cursor-grab items-center self-start text-muted-foreground/40 hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
