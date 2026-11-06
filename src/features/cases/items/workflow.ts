export type WorkflowRequest = {
  id: string; status: string; requested_date: string; created_at: string;
  decided_at: string | null; appointment_id: string | null;
};
export type WorkflowResponse = { id: string; response_type: string; comment: string | null; created_at: string; updated_at?: string };
export type WorkflowDecision = {
  id: string; title: string; status: string; created_at: string; updated_at: string;
  task_decision_participants: Array<{ id: string; task_decision_responses: WorkflowResponse[] }>;
};
export type WorkflowMeeting = {
  id: string; title: string; meeting_date: string; status: string; updated_at: string;
};
export type WorkflowAgenda = { id: string; meeting_id: string; result_text: string | null; updated_at: string };
export type WorkflowEvent = { id: string; title: string; note?: string; timestamp: string; actorName?: string; href?: string };

export function meetingOutcome(resultText: string | null, itemId: string): { completed: boolean; result: string } {
  try {
    const entry: unknown = JSON.parse(resultText || "{}")[itemId];
    if (typeof entry === "string") return { completed: !!entry.trim(), result: entry };
    if (!entry || typeof entry !== "object") return { completed: false, result: "" };
    const value = entry as { completed?: unknown; result?: unknown };
    const result = typeof value.result === "string" ? value.result : "";
    return { completed: typeof value.completed === "boolean" ? value.completed : !!result.trim(), result };
  } catch { return { completed: false, result: "" }; }
}

export function decisionOutcome(decision: WorkflowDecision) {
  const latest = decision.task_decision_participants.map((participant) =>
    [...participant.task_decision_responses].sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))[0],
  );
  const answered = latest.filter((response) => response && response.response_type !== "question");
  return {
    completed: decision.status === "archived" || decision.status === "completed" || (latest.length > 0 && answered.length === latest.length),
    answered: answered.length,
    total: latest.length,
  };
}

export function workflowEvents(itemId: string, requests: WorkflowRequest[], decisions: WorkflowDecision[], meetings: WorkflowMeeting[], agenda: WorkflowAgenda[]): WorkflowEvent[] {
  const events: WorkflowEvent[] = [];
  for (const request of requests) {
    events.push({ id: `request-${request.id}-created`, title: "Ortstermin angefragt", note: `Termin: ${request.requested_date}`, timestamp: request.created_at });
    if (request.status !== "open" && request.decided_at) events.push({
      id: `request-${request.id}-${request.status}`, title: request.status === "accepted" ? "Ortstermin bestätigt" : "Ortstermin abgelehnt",
      note: `Termin: ${request.requested_date}`, timestamp: request.decided_at,
    });
  }
  for (const decision of decisions) {
    events.push({ id: `decision-${decision.id}-created`, title: "Entscheidung angefordert", note: decision.title, timestamp: decision.created_at });
    for (const participant of decision.task_decision_participants) {
      for (const response of participant.task_decision_responses) events.push({
        id: `decision-response-${response.id}`, title: response.response_type === "question" ? "Rückfrage zur Entscheidung" : "Entscheidungsrückmeldung eingegangen",
        note: [decision.title, response.response_type === "yes" ? "Zustimmung" : response.response_type === "no" ? "Ablehnung" : "Rückmeldung", response.comment].filter(Boolean).join(" · "), timestamp: response.updated_at ?? response.created_at,
      });
    }
    if (decisionOutcome(decision).completed) events.push({ id: `decision-${decision.id}-completed`, title: "Entscheidungsanfrage abgeschlossen", note: decision.title, timestamp: [decision.updated_at, ...decision.task_decision_participants.flatMap((participant) => participant.task_decision_responses.map((response) => response.updated_at ?? response.created_at))].sort().slice(-1)[0]! });
  }
  for (const meeting of meetings) {
    const rows = agenda.filter((row) => row.meeting_id === meeting.id);
    for (const row of rows) {
      const outcome = meetingOutcome(row.result_text, itemId);
      if (outcome.completed || outcome.result.trim()) events.push({
        id: `meeting-${row.id}-${itemId}`, title: outcome.completed ? "Im Jour fixe besprochen" : "Jour-fixe-Ergebnis aktualisiert",
        note: [meeting.title, meeting.meeting_date, outcome.result].filter(Boolean).join(" · "), timestamp: row.updated_at,
      });
    }
    if (["archived", "completed"].includes(meeting.status)) events.push({ id: `meeting-${meeting.id}-closed`, title: "Jour fixe abgeschlossen", note: `${meeting.title} · ${meeting.meeting_date}`, timestamp: meeting.updated_at });
  }
  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/** Only consume pending Jour-fixe markers for newly completed case points. */
export function newlyCompletedMeetingCases(previous: string | null, next: string | null): string[] {
  try {
    const results: unknown = JSON.parse(next || "{}");
    if (!results || typeof results !== "object" || Array.isArray(results)) return [];
    return Object.keys(results).filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      && meetingOutcome(next, id).completed && !meetingOutcome(previous, id).completed);
  } catch { return []; }
}
