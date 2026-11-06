import type { ReactNode } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";

type CasesWorkspaceShellProps = {
  onDragEnd: (result: DropResult) => void;
  left: ReactNode;
  right: ReactNode;
  /** Optional third zone (Aktions-Dock); only rendered when provided. */
  inspector?: ReactNode;
};

export function CasesWorkspaceShell({ onDragEnd, left, right, inspector }: CasesWorkspaceShellProps) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className={inspector ? "grid h-full grid-cols-[320px_1fr_300px] gap-4" : "grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr] h-full"}>
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden h-full min-h-0">
          {left}
        </div>
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden h-full min-h-0">
          {right}
        </div>
        {inspector && (
          <aside className="h-full min-h-0 overflow-y-auto rounded-2xl border bg-card shadow-sm" aria-label="Aktionen und Zuständigkeit">
            {inspector}
          </aside>
        )}
      </div>
    </DragDropContext>
  );
}
