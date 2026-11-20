import type { ReactNode } from "react";
import { SystemSubpointScope } from "./SystemSubpointScope";
import type { ContextType } from "react";
export function AgendaSystemRow({
  children,
  scope,
}: {
  children: ReactNode;
  scope: ContextType<typeof SystemSubpointScope>;
}) {
  return (
    <div
      className="min-w-0 border-b border-[color:var(--agenda-row-divider)] dark:border-border"
    >
      <SystemSubpointScope.Provider value={scope}>{children}</SystemSubpointScope.Provider>
    </div>
  );
}
