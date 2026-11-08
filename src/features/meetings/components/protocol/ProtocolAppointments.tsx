import { Star } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { StarredAppointment } from "./types";
export function ProtocolAppointments({
  starredAppointments,
}: {
  starredAppointments: StarredAppointment[];
}) {
  return (
    <>
      {starredAppointments.length > 0 && (
        <section
          id="protocol-appointments"
          className="scroll-mt-6 space-y-3 mt-8 border-t pt-6 print:break-inside-auto"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2 print:break-after-avoid">
            <Star className="h-5 w-5 fill-palette-amber text-palette-amber" />
            Markierte Termine
          </h2>
          <div className="space-y-2">
            {starredAppointments.map((apt) => (
              <div
                key={apt.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-border/60 last:border-0 break-inside-avoid"
              >
                <span className="font-medium">{apt.title}</span>
                <span className="text-sm text-muted-foreground">
                  (
                  {format(new Date(apt.start_time), "dd.MM.yyyy HH:mm", {
                    locale: de,
                  })}
                  )
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
