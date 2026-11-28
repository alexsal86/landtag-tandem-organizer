import { useState } from "react";
import { MyWorkNotesList } from "@/components/my-work/MyWorkNotesList";
import { MyWorkQuickCapture } from "@/components/my-work/MyWorkQuickCapture";

/**
 * Gemeinsame Notiz-Oberfläche: Erfassung plus Liste.
 *
 * Wird von der eigenen Seite /notes und vom Quick-Notes-Einstieg in
 * „Meine Arbeit“ verwendet, damit beide Wege nie auseinanderlaufen.
 */
export function QuickNotesWorkspace() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="flex w-full flex-col gap-6">
      <MyWorkQuickCapture onNoteSaved={() => setRefreshTrigger(prev => prev + 1)} />
      <MyWorkNotesList refreshTrigger={refreshTrigger} />
    </div>
  );
}
