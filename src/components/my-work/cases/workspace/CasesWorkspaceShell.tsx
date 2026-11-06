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
      <div className={inspector ? "grid h-full grid-cols-[320px_minmax(0,1fr)_300px] gap-0 overflow-hidden rounded-2xl border bg-card shadow-sm" : "grid h-full grid-cols-1 gap-0 overflow-hidden rounded-2xl border bg-card shadow-sm lg:grid-cols-[340px_minmax(0,1fr)]"}>
        <div className="h-full min-h-0 min-w-0 overflow-hidden bg-card">
          {left}
        </div>
        <div className="h-full min-h-0 min-w-0 overflow-hidden bg-card">
          {right}
        </div>
        {inspector && (
          <aside className="h-full min-h-0 overflow-y-auto border-l bg-card" aria-label="Aktionen und Zuständigkeit">
            {inspector}
          </aside>
        )}
      </div>
    </DragDropContext>
  );
}
