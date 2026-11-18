import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FilterControlsTarget = createContext<HTMLDivElement | null | undefined>(undefined);
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
  const [filterTarget, setFilterTarget] = useState<HTMLDivElement | null>(null);
  if (filters == null) return <>{children}</>;
  return (
    <ControlsTarget.Provider value={target}>
      <FilterControlsTarget.Provider value={filterTarget}>
        <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-5">
          <div className="flex flex-wrap items-end gap-4">{filters}<div ref={setFilterTarget} className="contents" /></div>
          <div
            ref={setTarget}
            className="flex min-w-0 flex-wrap items-end gap-3 border-t pt-4 empty:hidden sm:flex-1 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0"
          />
        </div>
        {children}
      </FilterControlsTarget.Provider>
    </ControlsTarget.Provider>
  );
}

export function AnalysisControls({ children, placement = 'panel' }: { children: ReactNode; placement?: 'panel' | 'filters' }) {
  const panelTarget = useContext(ControlsTarget);
  const filterTarget = useContext(FilterControlsTarget);
  const target = placement === 'filters' ? filterTarget : panelTarget;
  if (target === undefined)
    return <div className="flex flex-wrap items-end gap-3">{children}</div>;
  return target ? createPortal(children, target) : null;
}
