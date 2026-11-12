import type { AnnotationPatch } from "./types";
export interface AnnotationHistoryEntry { id: string; before: AnnotationPatch; after: AnnotationPatch }
export interface AnnotationHistoryState { undo: AnnotationHistoryEntry[]; redo: AnnotationHistoryEntry[] }
export const emptyAnnotationHistory = (): AnnotationHistoryState => ({ undo: [], redo: [] });
export function recordAnnotationChange(state: AnnotationHistoryState, entry: AnnotationHistoryEntry): AnnotationHistoryState {
  return { undo: [...state.undo, entry].slice(-50), redo: [] };
}
export function advanceAnnotationHistory(state: AnnotationHistoryState, direction: "undo" | "redo"): AnnotationHistoryState {
  const entry = state[direction][state[direction].length - 1];
  if (!entry) return state;
  return direction === "undo" ? { undo: state.undo.slice(0, -1), redo: [...state.redo, entry] }
    : { undo: [...state.undo, entry], redo: state.redo.slice(0, -1) };
}
