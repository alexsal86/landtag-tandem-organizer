import type { ReactNode } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";

type CasesWorkspaceShellProps = {
  onDragEnd: (result: DropResult) => void;
  left: ReactNode;
  right: ReactNode;
};

export function CasesWorkspaceShell({ onDragEnd, left, right }: CasesWorkspaceShellProps) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[340px_1fr] h-full">
        {left}
        {right}
      </div>
    </DragDropContext>
  );
}
