import type { QuickNote } from "@/components/shared/QuickNotesList";

export interface GroupedNotes {
  level: number;
  label: string;
  notes: QuickNote[];
}
