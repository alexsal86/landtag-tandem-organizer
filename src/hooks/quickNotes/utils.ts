import type { QuickNote } from "@/components/shared/QuickNotesList";
import { noteColors } from "./constants";

export const stripHtml = (value: string) => value.replace(/<[^>]*>/g, "").trim();

export const toEditorHtml = (value: string | null | undefined) => {
  if (!value) return "";
  if (/<[^>]+>/.test(value)) return value;
  return `<p>${value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</p>`;
};

export const getCardBackground = (color: string | null): string | undefined => {
  if (!color) return undefined;
  const found = noteColors.find((c) => c.value === color);
  return found?.bg || `${color}30`;
};

export const hasInactiveMeetingLink = (note: QuickNote) => {
  if (!note.meeting_id) return false;
  return !note.meetings || note.meetings.status === 'archived';
};

export const normalizeMeetingLink = (note: QuickNote): QuickNote => {
  if (!hasInactiveMeetingLink(note)) return note;
  return {
    ...note,
    meeting_id: undefined,
    meetings: null,
    pending_for_jour_fixe: false,
  };
};
