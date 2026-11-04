import { useCallback } from "react";
import { useUserPreference } from "@/hooks/useUserPreference";
import { QUICK_NOTE_COLORS } from "@/components/my-work/quickNoteColors";

export interface NoteColorDef {
  name: string;
  value: string;
  meaning?: string;
}

const DEFAULT_PALETTE: NoteColorDef[] = QUICK_NOTE_COLORS.map((c) => ({ ...c }));

/** Personal note color palette with meanings, synced to the user account (all devices). */
export function useNoteColorPalette() {
  const [stored, setStored] = useUserPreference<NoteColorDef[]>("quick_note_palette_v1", DEFAULT_PALETTE);
  const palette = Array.isArray(stored) && stored.length > 0 ? stored : DEFAULT_PALETTE;
  const save = useCallback((next: NoteColorDef[]) => setStored(next), [setStored]);
  return { palette, save };
}

export const colorLabel = (c: NoteColorDef) => (c.meaning ? `${c.name}: ${c.meaning}` : c.name);
