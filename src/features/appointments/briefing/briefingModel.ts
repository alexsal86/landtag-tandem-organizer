// One briefing record, two zoom levels (compact one-pager / full 7-phase dossier) + live mode.
// Pure converters so every view reads and writes the same preparation_data.
import { asBriefingStatus } from "../briefing";

export type BriefingDepth = "compact" | "full";
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
  const talking = arr(pd.talking_point_items).map((t) => str(t.text) || str(t.title)).filter(Boolean);
  const qa = arr(pd.qa_pairs).map((q) => `${str(q.question)} → ${str(q.answer)}`).filter((l) => l !== " → ");
  return {
    compact_partners: partners.join("\n"),
    compact_goal: [str(pd.objectives), str(pd.visit_reason_details)].filter(Boolean).join("\n"),
    compact_positions: talking.length ? talking.join("\n") : [str(pd.position_statements), str(pd.talking_points)].filter(Boolean).join("\n"),
    compact_documents: str(pd.materials_needed),
    compact_qa: qa.join("\n"),
    compact_facts: str(pd.key_topics),
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
  if (c.compact_goal && empty("objectives")) out.objectives = c.compact_goal;
  if (c.compact_positions && empty("talking_point_items"))
    out.talking_point_items = lines(c.compact_positions).map((text, i) => ({ id: `c-${i}`, text }));
  if (c.compact_documents && empty("materials_needed")) out.materials_needed = c.compact_documents;
  if (c.compact_qa && empty("qa_pairs"))
    out.qa_pairs = lines(c.compact_qa).map((l, i) => { const [q, a = ""] = l.split(/\s*(?:→|->)\s*/); return { id: `c-${i}`, question: q, answer: a }; });
  if (c.compact_facts && empty("key_topics")) out.key_topics = c.compact_facts;
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
  return { ...pd, ...c, ...compactToFull(c, pd) };
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
