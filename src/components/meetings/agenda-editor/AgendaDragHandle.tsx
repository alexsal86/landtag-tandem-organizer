import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export function AgendaDragHandle({ dragHandleProps, dragging = false, className }: {
  dragHandleProps: DraggableProvidedDragHandleProps;
  dragging?: boolean;
  className?: string;
}) {
  return (
    <div
      {...dragHandleProps}
      aria-label="Punkt verschieben"
      className={cn(
        "flex h-8 max-w-0 shrink-0 cursor-grab items-center overflow-hidden text-muted-foreground/40 opacity-0 transition-[max-width,margin,opacity] duration-200 ease-out hover:text-muted-foreground active:cursor-grabbing motion-reduce:transition-none",
        "group-hover:mr-2 group-hover:max-w-4 group-hover:opacity-100 focus:mr-2 focus:max-w-4 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        "[@media(hover:none)]:mr-2 [@media(hover:none)]:max-w-4 [@media(hover:none)]:opacity-100",
        dragging && "mr-2 max-w-4 opacity-100",
        className,
      )}
    >
      <GripVertical className="size-4 shrink-0" />
    </div>
  );
}
