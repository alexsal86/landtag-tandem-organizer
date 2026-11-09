/** Pure rules for the debrief quick actions (editorial hand-off, promises, contact insight, quick debrief). */

export function debriefTopic(title: string, debrief: string) {
  const text = debrief.trim();
  return {
    topic: `Termin: ${title.trim() || "Ohne Titel"}`,
    short_description: text ? text.slice(0, 500) : "Aus der Termin-Nachbereitung übernommen.",
    tags: ["termin", "nachbereitung"],
    status: "idea",
    priority: 1,
  };
}

export function promiseTask(promise: string, contactName?: string | null) {
  const text = promise.trim();
  if (!text) return null;
  return {
    title: `Zusage: ${text.slice(0, 120)}`,
    description: contactName ? `Zusage an ${contactName} aus der Termin-Nachbereitung.` : "Zusage aus der Termin-Nachbereitung.",
  };
}

export function quickDebriefNotes(result: string, nextStep: string) {
  const r = result.trim();
  const n = nextStep.trim();
  if (!r && !n) return null;
  return [r && `Ergebnis: ${r}`, n && `Nächster Schritt: ${n}`].filter(Boolean).join("\n");
}

/** Appointments of the previous day without any notes show up in the start-page hint. */
export function needsQuickDebrief(feedback: { notes: string | null; feedback_status: string } | null | undefined) {
  if (!feedback) return true;
  return feedback.feedback_status !== "completed" && !feedback.notes?.trim();
}
