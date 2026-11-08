import { PencilSparkles as StickyNote } from "@/components/icons/PencilSparkles";
import type { ProtocolQuickNote } from "./types";
export function ProtocolNotes({
  notesWithResults,
}: {
  notesWithResults: ProtocolQuickNote[];
}) {
  return (
    <>
      {notesWithResults.length > 0 && (
        <section
          id="protocol-notes"
          className="scroll-mt-6 space-y-3 mt-8 border-t pt-6 print:break-inside-auto"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2 print:break-after-avoid">
            <StickyNote className="h-5 w-5 text-palette-amber" />
            Besprochene Notizen
          </h2>
          <div className="space-y-3">
            {notesWithResults.map((note) => (
              <div
                key={note.id}
                className="py-3 border-b border-border/60 last:border-0 break-inside-avoid"
              >
                <p className="font-medium">
                  {note.title || note.content.substring(0, 80)}
                </p>
                {note.meeting_result?.trim() && (
                  <div className="mt-2 border-l-2 border-palette-amber/50 pl-3 break-inside-avoid">
                    <p className="text-sm font-medium text-palette-amber mb-1">
                      Ergebnis:
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {note.meeting_result}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
