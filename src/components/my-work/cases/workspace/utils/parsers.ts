import type { CaseItemIntakePayload } from "@/features/cases/items/types";
import type { CaseItemInteractionDocument, TimelineInteractionType } from "@/components/my-work/hooks/useCaseItemEdit";

export const getContactName = (payload: CaseItemIntakePayload | null): string => {
  const value = payload?.contact_name;
  return typeof value === "string" ? value : "";
};

export const getContactDetail = (payload: CaseItemIntakePayload | null): string => {
  const value = payload?.contact_detail;
  return typeof value === "string" ? value : "";
};

export const parseContactPerson = (value: string): { contactName: string | null; contactDetail: string | null } => {
  const trimmed = value.trim();
  if (!trimmed) return { contactName: null, contactDetail: null };

  const separators = [" · ", "|", ","];
  for (const separator of separators) {
    if (!trimmed.includes(separator)) continue;
    const parts = trimmed.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return {
        contactName: parts[0] || null,
        contactDetail: parts.slice(1).join(" ").trim() || null,
      };
    }
  }

  return { contactName: trimmed, contactDetail: null };
};

export const parseInteractionDocuments = (payload: CaseItemIntakePayload | null): CaseItemInteractionDocument[] => {
  const rawPayload = payload as Record<string, unknown> | null;
  const raw = rawPayload?.interaction_documents;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      if (typeof value.id !== "string" || typeof value.filePath !== "string") return null;
      return {
        id: value.id,
        title: typeof value.title === "string" ? value.title : "Dokument",
        fileName: typeof value.fileName === "string" ? value.fileName : "",
        filePath: value.filePath,
        uploadedBy: typeof value.uploadedBy === "string" ? value.uploadedBy : null,
        uploadedByName: typeof value.uploadedByName === "string" ? value.uploadedByName : null,
        uploadedAt: typeof value.uploadedAt === "string" ? value.uploadedAt : new Date().toISOString(),
        documentDate: typeof value.documentDate === "string" ? value.documentDate : null,
        shortText: typeof value.shortText === "string" ? value.shortText : null,
      } satisfies CaseItemInteractionDocument;
    })
    .filter((doc): doc is CaseItemInteractionDocument => Boolean(doc))
    .sort((a, b) => a.title.localeCompare(b.title, "de", { sensitivity: "base" }));
};

export const parseTimelineInteractionType = (value: unknown): TimelineInteractionType | undefined => {
  return typeof value === "string" ? (value as TimelineInteractionType) : undefined;
};
