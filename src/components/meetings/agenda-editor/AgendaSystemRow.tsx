import type { ReactNode } from "react";
import { SystemSubpointScope } from "./SystemSubpointScope";
import type { ContextType } from "react";
export function AgendaSystemRow({
  children,
  selected,
  scope,
}: {
  children: ReactNode;
  selected: boolean;
  scope: ContextType<typeof SystemSubpointScope>;
}) {
  return (
    <div
      data-selected={selected}
      className="group min-w-0 border-b border-[color:var(--agenda-row-divider)] dark:border-border"
    >
      <SystemSubpointScope.Provider value={scope}>{children}</SystemSubpointScope.Provider>
    </div>
  );
}
