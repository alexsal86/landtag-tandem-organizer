import type { ReactNode } from "react";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
export function AgendaSystemRow({
  children,
  dragHandleProps,
  canEdit,
  selected,
}: {
  children: ReactNode;
  dragHandleProps: DraggableProvidedDragHandleProps | null;
  canEdit: boolean;
  selected: boolean;
}) {
  return (
    <div
      className={cn(
        "group flex min-w-0 border border-transparent hover:bg-muted/30 focus-within:bg-muted/40",
        selected && "rounded-lg border-primary/45 bg-primary/10",
      )}
    >
      {canEdit && (
        <div
          {...dragHandleProps}
          aria-label="Baustein verschieben"
          className="self-start mt-3 ml-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-grab opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
