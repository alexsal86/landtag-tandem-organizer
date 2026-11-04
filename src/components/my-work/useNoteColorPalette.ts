import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { QUICK_NOTE_COLORS } from "@/components/my-work/quickNoteColors";

export interface NoteColorDef {
  name: string;
  value: string;
  meaning?: string;
}

const EVENT = "quick-note-palette-changed";
const storageKey = (userId?: string) => `quick-note-palette:${userId ?? "anon"}`;

function read(userId?: string): NoteColorDef[] {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as NoteColorDef[];
    }
  } catch {
    /* blocked storage → defaults */
  }
  return QUICK_NOTE_COLORS.map((c) => ({ ...c }));
}

/** Personal note color palette with meanings, stored per user in the browser. */
export function useNoteColorPalette() {
  const { user } = useAuth();
  const [palette, setPalette] = useState<NoteColorDef[]>(() => read(user?.id));

  useEffect(() => {
    setPalette(read(user?.id));
    const sync = () => setPalette(read(user?.id));
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [user?.id]);

  const save = useCallback((next: NoteColorDef[]) => {
    try { window.localStorage.setItem(storageKey(user?.id), JSON.stringify(next)); } catch { /* ignore */ }
    setPalette(next);
    window.dispatchEvent(new Event(EVENT));
  }, [user?.id]);

  return { palette, save };
}

export const colorLabel = (c: NoteColorDef) => (c.meaning ? `${c.name}: ${c.meaning}` : c.name);
