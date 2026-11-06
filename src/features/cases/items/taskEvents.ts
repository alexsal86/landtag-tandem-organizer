import type { WorkflowEvent } from "./workflow";

export type CaseTaskJournalRow = {
  id: string; subject: string | null; details: string | null; interaction_at: string;
  source_id: string | null; payload: unknown;
};

export function caseTaskEvents(rows: CaseTaskJournalRow[], activeTaskIds: string[]): WorkflowEvent[] {
  return rows.flatMap((row) => {
    if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) return [];
    const payload = row.payload as Record<string, unknown>;
    if (payload.origin !== "case_step_task") return [];
    return [{
      id: `case-task-${row.id}`, title: row.subject || "Aufgabe geändert", note: row.details || undefined,
      timestamp: row.interaction_at,
      actorName: typeof payload.responsible_name === "string" ? payload.responsible_name : typeof payload.actor_name === "string" ? payload.actor_name : undefined,
      href: row.source_id && activeTaskIds.includes(row.source_id) ? `/tasks?highlight=${row.source_id}` : undefined,
    }];
  });
}
