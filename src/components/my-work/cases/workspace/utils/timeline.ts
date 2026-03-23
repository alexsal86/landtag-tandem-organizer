import { sanitizeRichHtml } from "@/utils/htmlSanitizer";
import type { CaseItemIntakePayload } from "@/features/cases/items/types";
import type { TimelineDocumentAttachment, TimelineEvent } from "@/components/my-work/hooks/useCaseItemEdit";
import { parseTimelineInteractionType } from "./parsers";

export const sanitizeTimelineNote = (note: string | undefined) => {
  if (!note) return undefined;
  return sanitizeRichHtml(note);
};

export function toTimeSafe(value: string | null | undefined) {
  if (!value) return 0;
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
}

export const parseTimelineEvents = (payload: CaseItemIntakePayload | null): TimelineEvent[] => {
  const raw = payload?.timeline_events;
  if (!Array.isArray(raw)) return [];
  const results: TimelineEvent[] = [];
  for (const event of raw) {
    if (!event || typeof event !== "object") continue;
    const item = event as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.type !== "string" || typeof item.title !== "string" || typeof item.timestamp !== "string") continue;
    const type = item.type as string;
    if (type !== "status" && type !== "interaktion" && type !== "entscheidung") continue;
    const documents = Array.isArray(item.documents)
      ? item.documents
          .map((doc) => {
            if (!doc || typeof doc !== "object") return null;
            const value = doc as Record<string, unknown>;
            if (typeof value.id !== "string" || typeof value.filePath !== "string") return null;
            return {
              id: value.id,
              title: typeof value.title === "string" ? value.title : "Dokument",
              fileName: typeof value.fileName === "string" ? value.fileName : "",
              filePath: value.filePath,
            } satisfies TimelineDocumentAttachment;
          })
          .filter((doc): doc is TimelineDocumentAttachment => Boolean(doc))
      : undefined;

    results.push({
      id: item.id,
      type: type as TimelineEvent["type"],
      title: item.title,
      note: typeof item.note === "string" ? item.note : undefined,
      documents,
      timestamp: item.timestamp,
      statusValue: typeof item.statusValue === "string" ? item.statusValue : undefined,
      interactionType: parseTimelineInteractionType(item.interactionType),
    });
  }
  return results.sort((a, b) => toTimeSafe(a.timestamp) - toTimeSafe(b.timestamp));
};
