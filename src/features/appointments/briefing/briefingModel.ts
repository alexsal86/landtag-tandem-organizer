// One briefing record, two zoom levels (compact one-pager / full 7-phase dossier) + live mode.
// Pure converters so every view reads and writes the same preparation_data.
import { asBriefingStatus } from "../briefing";

export type BriefingDepth = "compact" | "full";
export function briefingDepthLabel(depth: string | null | undefined): string {
  return depth === "compact" ? "Kurzbriefing" : depth === "full" ? "Langbriefing" : "Umfang nicht hinterlegt";
}
export type PrepData = Record<string, unknown>;

export const COMPACT_KEYS = ["compact_partners", "compact_goal", "compact_positions", "compact_documents", "compact_qa", "compact_facts", "compact_debrief"] as const;
export type CompactKey = (typeof COMPACT_KEYS)[number];
export type CompactValues = Record<CompactKey, string>;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const lines = (s: string) => s.split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);

/** Summarise full dossier fields as compact text (used when compact field is empty). */
export function fullToCompact(pd: PrepData): CompactValues {
  const partners = arr(pd.conversation_partners).map((p) => [str(p.name), str(p.role)].filter(Boolean).join(", ")).filter(Boolean);
  const talking = arr(pd.talking_point_items).map((t) => str(t.point) || str(t.text) || str(t.title)).filter(Boolean);
  const qa = arr(pd.qa_pairs).map((q) => `${str(q.question)} → ${str(q.answer)}`).filter((l) => l !== " → ");
  return {
    compact_partners: partners.join("\n"),
    compact_goal: [str(pd.objectives), str(pd.visit_reason_details)].filter(Boolean).join("\n"),
    compact_positions: [str(pd.position_statements), talking.length ? talking.join("\n") : str(pd.talking_points)].filter(Boolean).join("\n"),
    compact_documents: str(pd.materials_needed),
    compact_qa: qa.length ? qa.join("\n") : str(pd.questions_answers),
    compact_facts: str(pd.facts_figures) || str(pd.key_topics),
    compact_debrief: [str(pd.debrief_summary), str(pd.debrief_outcomes)].filter(Boolean).join("\n"),
  };
}

/** Map compact text into full dossier fields, only filling empty full fields (never overwrites richer data). */
export function compactToFull(c: Partial<CompactValues>, existing: PrepData = {}): PrepData {
  const out: PrepData = {};
  const empty = (k: string) => {
    const v = existing[k];
    return v == null || v === "" || (Array.isArray(v) && v.length === 0);
  };
  if (c.compact_partners && empty("conversation_partners"))
    out.conversation_partners = lines(c.compact_partners).map((l) => { const [name, ...role] = l.split(","); return { id: `c-${name.trim()}`, name: name.trim(), role: role.join(",").trim() }; });
  if (c.compact_goal && empty("objectives") && empty("visit_reason_details")) out.visit_reason_details = c.compact_goal;
  if (c.compact_positions && empty("talking_point_items"))
    out.talking_point_items = lines(c.compact_positions).map((text, i) => ({ id: `c-${i}`, point: text, text, background: "" }));
  if (c.compact_documents && empty("materials_needed")) out.materials_needed = c.compact_documents;
  if (c.compact_qa && empty("qa_pairs"))
    out.qa_pairs = lines(c.compact_qa).map((l, i) => { const [q, a = ""] = l.split(/\s*(?:→|->)\s*/); return { id: `c-${i}`, question: q, answer: a }; });
  if (c.compact_facts && empty("facts_figures") && empty("key_topics")) out.facts_figures = c.compact_facts;
  if (c.compact_debrief && empty("debrief_summary")) out.debrief_summary = c.compact_debrief;
  return out;
}

/** Read compact values from a record: explicit compact_* wins, otherwise derived from dossier fields (legacy merge). */
export function mergeLegacy(pd: PrepData): CompactValues {
  const derived = fullToCompact(pd);
  const out = {} as CompactValues;
  for (const k of COMPACT_KEYS) out[k] = str(pd[k]) || derived[k];
  return out;
}

/** Build the payload to save from the compact editor: compact values + synced dossier fields. */
export function saveCompact(pd: PrepData, c: CompactValues): PrepData {
  const previous = mergeLegacy(pd);
  const out: PrepData = { ...pd, ...c, ...compactToFull(c, pd) };
  // Explicit edits in the short view update the corresponding dossier fields.
  // Unchanged fields keep their richer metadata and structured items.
  if (c.compact_partners !== previous.compact_partners) {
    const existing = arr(pd.conversation_partners);
    out.conversation_partners = lines(c.compact_partners).map((line, i) => {
      const [name, ...role] = line.split(",");
      return { ...existing[i], id: existing[i]?.id ?? `c-${i}`, name: name.trim(), role: role.join(",").trim() };
    });
  }
  if (c.compact_goal !== previous.compact_goal) {
    out.visit_reason_details = c.compact_goal;
    out.objectives = "";
  }
  if (c.compact_positions !== previous.compact_positions) {
    const existing = arr(pd.talking_point_items);
    out.talking_point_items = lines(c.compact_positions).map((point, i) => ({ ...existing[i], id: existing[i]?.id ?? `c-${i}`, point, text: point }));
    out.talking_points = c.compact_positions;
    out.position_statements = "";
  }
  if (c.compact_documents !== previous.compact_documents) out.materials_needed = c.compact_documents;
  if (c.compact_qa !== previous.compact_qa) {
    const existing = arr(pd.qa_pairs);
    out.qa_pairs = lines(c.compact_qa).map((line, i) => {
      const [question, ...answer] = line.split(/\s*(?:→|->)\s*/);
      return { ...existing[i], id: existing[i]?.id ?? `c-${i}`, question, answer: answer.join(" → ") };
    });
    out.questions_answers = c.compact_qa;
  }
  if (c.compact_facts !== previous.compact_facts) out.facts_figures = c.compact_facts;
  if (c.compact_debrief !== previous.compact_debrief) {
    out.debrief_summary = c.compact_debrief;
    out.debrief_outcomes = "";
  }
  // Canonical fields are the source of truth after saving; compact_* remains a legacy input only.
  for (const key of COMPACT_KEYS) delete out[key];
  return out;
}

/** Short line of dossier-only extras shown in the one-pager, e.g. "Ablauf: 14:00 Begrüßung · …". */
export function dossierExtrasLine(pd: PrepData): string | null {
  const program = arr(pd.program).map((p) => [str(p.time), str(p.item) || str(p.title)].filter(Boolean).join(" ")).filter(Boolean);
  const companions = arr(pd.companions).map((p) => str(p.name)).filter(Boolean);
  const parts = [program.length ? `Ablauf: ${program.join(" · ")}` : "", companions.length ? `Begleitung: ${companions.join(", ")}` : ""].filter(Boolean);
  return parts.length ? parts.join(" — ") : null;
}

/** Live mode is offered for approved briefings on the appointment day (or later for debrief). */
export function canGoLive(a: { briefing_status?: string | null; start_time: string }, now: Date = new Date()): boolean {
  const s = asBriefingStatus(a.briefing_status);
  if (s !== "approved") return false;
  const d = new Date(a.start_time);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return d.getTime() >= startOfDay && d.getTime() < startOfDay + 86400_000;
}

export interface FollowUpInput { title: string; assigneeId?: string | null; due?: string | null; description?: string; priority?: "low" | "medium" | "high" }

/** Normalise a live quick-task into RPC args; null if invalid (empty title). */
export function followUpTaskFromLive(appointmentId: string, i: FollowUpInput, feedbackId?: string | null) {
  const title = i.title.trim();
  if (!title) return null;
  return {
    _appointment_id: appointmentId,
    _title: title,
    _assignee: i.assigneeId || undefined,
    _due: i.due || undefined,
    _description: i.description?.trim() || undefined,
    _priority: i.priority ?? "medium",
    _feedback_id: feedbackId || undefined,
  };
}

/** Briefing can be closed once debrief text exists and status is approved. */
export function canCompleteBriefing(status: string | null | undefined, debrief: string): boolean {
  return asBriefingStatus(status) === "approved" && debrief.trim().length > 0;
}
