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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,85fr)_minmax(0,15fr)]">
        {left}
        {right}
      </div>
    </DragDropContext>
  );
}
