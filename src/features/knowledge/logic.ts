import type { Json } from "@/integrations/supabase/types";
import type {
  KnowledgeQuestion,
  ReviewStatus,
  KnowledgeView,
  KnowledgeFilters,
} from "./types";

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  unverified: "Ungeprüft",
  verified: "Geprüft",
  needs_review: "Überprüfung erforderlich",
};
export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;
export const ATTACHMENT_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export function effectiveReviewStatus(
  question: Pick<KnowledgeQuestion, "review_status" | "review_due_at">,
  now = Date.now(),
): ReviewStatus {
  if (
    question.review_status === "needs_review" ||
    (question.review_due_at && Date.parse(question.review_due_at) <= now)
  )
    return "needs_review";
  return question.review_status === "verified" ? "verified" : "unverified";
}
export function validateQuestion(
  title: string,
  description: string,
): string | null {
  if (!title.trim() || title.trim().length > 300)
    return "Bitte eine Frage mit höchstens 300 Zeichen eingeben.";
  if (description.length > 10000)
    return "Die Beschreibung darf höchstens 10.000 Zeichen enthalten.";
  return null;
}
export function validateAttachment(
  file: Pick<File, "name" | "size" | "type">,
): string | null {
  if (!file.name || file.name.length > 255) return "Der Dateiname ist zu lang.";
  if (!file.size || file.size > MAX_ATTACHMENT_SIZE)
    return "Dateien dürfen höchstens 20 MB groß und nicht leer sein.";
  if (!ATTACHMENT_TYPES.includes(file.type))
    return "Dieser Dateityp ist nicht erlaubt. Bitte PDF, Office-Datei, Text oder Bild verwenden.";
  return null;
}
export function asObject(
  value: Json | undefined,
): { [key: string]: Json | undefined } | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}
const NODE_TYPES = new Set([
  "root",
  "paragraph",
  "text",
  "linebreak",
  "heading",
  "quote",
  "list",
  "listitem",
  "link",
  "autolink",
]);
export function isSafeKnowledgeUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^(https?:\/\/|mailto:)[^\s]+$/i.test(value) &&
    !Array.from(value).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  );
}
export function answerText(content: Json): string {
  const root = asObject(content)?.root;
  const visit = (value: Json | undefined, depth: number): string => {
    const node = asObject(value);
    if (
      !node ||
      depth > 24 ||
      typeof node.type !== "string" ||
      !NODE_TYPES.has(node.type)
    )
      throw new Error("Ungültiger Antwortinhalt.");
    if (
      (node.type === "root" && depth !== 0) ||
      (node.style !== undefined && node.style !== "") ||
      (node.type === "heading" &&
        !["h1", "h2", "h3", "h4", "h5", "h6"].includes(String(node.tag))) ||
      (node.type === "list" &&
        !["bullet", "number"].includes(String(node.listType)))
    )
      throw new Error("Nicht unterstützte Formatierung.");
    if (
      ["link", "autolink"].includes(node.type) &&
      !isSafeKnowledgeUrl(node.url)
    )
      throw new Error("Nur https-, http- und mailto-Links sind erlaubt.");
    if (node.type === "text") {
      if (typeof node.text !== "string") throw new Error("Ungültiger Text.");
      return node.text;
    }
    if (node.type === "linebreak") return "\n";
    if (!Array.isArray(node.children))
      throw new Error("Ungültige Textstruktur.");
    return (
      node.children.map((child) => visit(child, depth + 1)).join("") +
      (["paragraph", "heading", "quote", "listitem"].includes(node.type)
        ? "\n"
        : "")
    );
  };
  if (
    asObject(root)?.type !== "root" ||
    JSON.stringify(content).length > 200000
  )
    throw new Error("Ungültiger oder zu langer Antwortinhalt.");
  return visit(root, 0).trim();
}
export function parseAnswer(nodesJson: string | undefined): Json {
  if (!nodesJson) throw new Error("Bitte eine Antwort eingeben.");
  // Pasted styling is irrelevant to the answer and must not become arbitrary CSS.
  const content: Json = JSON.parse(nodesJson, (key, value: Json) =>
    key === "style" ? "" : value,
  );
  const text = answerText(content);
  if (!text || text.length > 50000)
    throw new Error(
      "Bitte eine Antwort mit höchstens 50.000 Zeichen eingeben.",
    );
  return content;
}
export function answerExcerpt(text: string, query: string): string {
  const word =
    query
      .trim()
      .split(/\s+/)
      .find((part) => part.length > 2) ?? "";
  const match = word
    ? text.toLocaleLowerCase("de").indexOf(word.toLocaleLowerCase("de"))
    : 0;
  const start = Math.max(0, match - 55);
  return `${start ? "… " : ""}${text.slice(start, start + 220)}${text.length > start + 220 ? " …" : ""}`;
}

export function knowledgeUrlState(params: URLSearchParams): {
  view: KnowledgeView;
  filters: KnowledgeFilters;
} {
  const rawView = params.get("ansicht");
  const view: KnowledgeView =
    rawView === "open" ||
    rawView === "mine" ||
    rawView === "assigned" ||
    rawView === "review"
      ? rawView
      : "answers";
  const rawStatus = params.get("status");
  const status =
    rawStatus === "open" ||
    rawStatus === "unverified" ||
    rawStatus === "verified" ||
    rawStatus === "needs_review"
      ? rawStatus
      : "";
  const rawAssignee = params.get("zustaendig") ?? "";
  const assignee =
    rawAssignee === "unassigned" ||
    /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(rawAssignee)
      ? rawAssignee
      : "";
  return {
    view,
    filters: {
      status,
      assignee,
      ...(params.has('tag') ? { tag: params.get('tag') ?? '' } : {}),
      ...(params.has('schnell') ? { quick: params.get('schnell') ?? '' } : {}),
      sort: params.get("sortierung") === "oldest" ? "oldest" : "updated",
    },
  };
}

export function knowledgeQuestionPath(id: string | null | undefined): string {
  return id ? `/wissen?frage=${encodeURIComponent(id)}` : "/wissen";
}
