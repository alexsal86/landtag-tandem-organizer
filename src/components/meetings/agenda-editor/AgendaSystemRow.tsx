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
        "group flex min-w-0 border-b border-l-[3px] border-l-transparent pl-3 transition-colors hover:bg-muted/40 sm:pl-5",
        nested && "bg-muted/25 pl-7 sm:pl-10",
        selected && "border-l-primary bg-primary/10 hover:bg-primary/10",
      )}
    >
      {canEdit && (
        <div
          {...dragHandleProps}
          aria-label="Baustein verschieben"
          className="mt-5 mr-1 self-start cursor-grab text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
