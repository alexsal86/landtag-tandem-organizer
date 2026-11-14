import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const ControlsTarget = createContext<HTMLDivElement | null | undefined>(undefined);

/** Keep panel-owned controls next to the shared election filters. */
export function AnalysisToolbarLayout({
  filters,
  children,
}: {
  filters: ReactNode;
  children: ReactNode;
}) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  if (filters == null) return <>{children}</>;
  return (
    <ControlsTarget.Provider value={target}>
      <div className="flex flex-col gap-4 rounded-lg border bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-5">
        <div className="flex flex-wrap items-end gap-4">{filters}</div>
        <div
          ref={setTarget}
          className="flex min-w-0 flex-wrap items-end gap-3 border-t pt-4 empty:hidden sm:flex-1 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0"
        />
      </div>
      {children}
    </ControlsTarget.Provider>
  );
}

export function AnalysisControls({ children }: { children: ReactNode }) {
  const target = useContext(ControlsTarget);
  if (target === undefined)
    return <div className="flex flex-wrap items-end gap-3">{children}</div>;
  return target ? createPortal(children, target) : null;
}
