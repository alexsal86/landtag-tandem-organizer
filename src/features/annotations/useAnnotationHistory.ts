import { useRef, useState } from "react";
import { advanceAnnotationHistory, emptyAnnotationHistory, recordAnnotationChange, type AnnotationHistoryEntry } from "./annotationHistory";
import type { AnnotationPatch } from "./types";
import { notify } from "@/lib/notify";

/** Only successful local edits enter history; replay checks the current persisted field values. */
export function useAnnotationHistory(apply: (id: string, patch: AnnotationPatch, expected: AnnotationPatch) => Promise<unknown>) {
  const [state, setState] = useState(emptyAnnotationHistory);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const replay = async (direction: "undo" | "redo") => {
    const entry = state[direction][state[direction].length - 1];
    if (!entry || locked.current) return;
    locked.current = true; setBusy(true);
    try {
      await apply(entry.id, direction === "undo" ? entry.before : entry.after, direction === "undo" ? entry.after : entry.before);
      setState(current => advanceAnnotationHistory(current, direction));
    } catch (error) { notify.error(error instanceof Error ? error.message : "Änderung konnte nicht rückgängig gemacht werden"); }
    finally { locked.current = false; setBusy(false); }
  };
  return { canUndo: !!state.undo.length, canRedo: !!state.redo.length, busy,
    undo: () => replay("undo"), redo: () => replay("redo"),
    record: (entry: AnnotationHistoryEntry) => setState(current => recordAnnotationChange(current, entry)),
    clear: () => setState(emptyAnnotationHistory()),
  };
}
