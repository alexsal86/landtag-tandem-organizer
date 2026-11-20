export const agendaSubpointListClass =
  "border-t border-[color:var(--agenda-row-divider)] dark:border-border";

export const agendaSubpointRowClass =
  "min-w-0 border-b border-[color:var(--agenda-row-divider)] bg-[var(--agenda-subpoint-bg)] py-2.5 pl-11 pr-3 text-xs last:border-b-0 dark:border-border dark:bg-slate-800 sm:pr-5";

export function agendaSubpointNumber(parentNumber: string | undefined, index: number) {
  return parentNumber ? `${parentNumber.replace(/\.$/, "")}.${index + 1}` : undefined;
}
