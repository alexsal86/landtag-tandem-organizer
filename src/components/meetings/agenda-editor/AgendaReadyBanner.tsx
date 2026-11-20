import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import type { agendaTiming } from "./agendaTiming";

export function AgendaReadyBanner({ timing, onStart, startDisabled, live }: {
  timing: ReturnType<typeof agendaTiming>;
  onStart?: () => void;
  startDisabled: boolean;
  live?: boolean;
}) {
  const count = timing.main.length;
  const completed = timing.main.filter((item) => item.is_completed).length;
  const progress = count ? (completed / count) * 100 : 0;
  return (
    <section className="space-y-4 rounded-2xl bg-gradient-to-r from-green-900 via-green-800 to-green-700 px-4 py-4 text-white shadow-sm sm:px-6 sm:py-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{live ? "Besprechung läuft" : "Meeting bereit"}</h3>
          <p className="text-sm text-white/85">
            {count} {count === 1 ? "Punkt" : "Punkte"}
            {timing.total > 0 && ` · geplant ${timing.total} Min.`}
            {timing.end && ` · Ende ca. ${timing.end} Uhr`}
          </p>
        </div>
        {onStart && (
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-mono text-3xl font-semibold tabular-nums" aria-label="Verstrichene Zeit: 0 Minuten">00:00</span>
            <Button className="bg-white text-green-950 hover:bg-green-50" disabled={startDisabled} onClick={onStart}>
              <Play className="mr-2 size-4 fill-current" /> Live starten
            </Button>
          </div>
        )}
      </div>
      <div
        role="progressbar"
        aria-label="Erledigte Tagesordnungspunkte"
        aria-valuenow={Math.round(progress)}
        aria-valuetext={`${completed} von ${count} erledigt`}
        className="h-1.5 overflow-hidden rounded-full bg-white/25"
      >
        <div className="h-full rounded-full bg-white/85" style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}
